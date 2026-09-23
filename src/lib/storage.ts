import { Book, ReadingLog, Quote, Config, DB, DEFAULT_CONFIG } from "./types";

/**
 * Saqlash qatlami (storage layer).
 * - Agar UPSTASH env sozlangan bo'lsa -> Upstash Redis (Vercel / production).
 * - Aks holda -> lokal .data/db.json fayli (faqat ishlab chiqish uchun).
 */

const BOOKS_KEY = "kitob:books";
const LOGS_KEY = "kitob:logs";
const QUOTES_KEY = "kitob:quotes";
const CONFIG_KEY = "kitob:config";
const VIEWS_KEY = "kitob:views";
const VISITORS_KEY = "kitob:visitors";
const AVATAR_KEY = "kitob:avatar";
const REACTIONS_KEY = "kitob:reactions";
const PUSH_KEY = "kitob:push";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const REACTIONS = ["📚", "🔥", "👏", "❤️"] as const;
export type ReactionCounts = Record<string, number>;

export interface Counts {
  views: number; // umumiy ko'rishlar
  visitors: number; // unikal tashrifchilar
  today: number; // bugungi ko'rishlar
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// ---------- Redis backend ----------
async function redisClient() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function redisGetAll(): Promise<DB> {
  const redis = await redisClient();
  const [books, logs, quotes, config] = await Promise.all([
    redis.hgetall<Record<string, Book>>(BOOKS_KEY),
    redis.hgetall<Record<string, ReadingLog>>(LOGS_KEY),
    redis.hgetall<Record<string, Quote>>(QUOTES_KEY),
    redis.get<Config>(CONFIG_KEY),
  ]);
  return {
    books: books ?? {},
    logs: logs ?? {},
    quotes: quotes ?? {},
    config: { ...DEFAULT_CONFIG, ...(config ?? {}) },
  };
}

async function redisGetCounts(todayKey: string): Promise<Counts> {
  const redis = await redisClient();
  const [views, visitors, today] = await Promise.all([
    redis.get(VIEWS_KEY),
    redis.get(VISITORS_KEY),
    redis.get(`${VIEWS_KEY}:${todayKey}`),
  ]);
  return { views: num(views), visitors: num(visitors), today: num(today) };
}

async function redisRegisterView(
  newVisitor: boolean,
  todayKey: string,
): Promise<Counts> {
  const redis = await redisClient();
  const views = await redis.incr(VIEWS_KEY);
  const today = await redis.incr(`${VIEWS_KEY}:${todayKey}`);
  const visitors = newVisitor
    ? await redis.incr(VISITORS_KEY)
    : num(await redis.get(VISITORS_KEY));
  return { views: num(views), visitors: num(visitors), today: num(today) };
}

async function redisGetReactions(): Promise<ReactionCounts> {
  const redis = await redisClient();
  const h = await redis.hgetall<ReactionCounts>(REACTIONS_KEY);
  return normalizeReactions(h ?? {});
}

async function redisChangeReaction(
  emoji: string,
  delta: number,
): Promise<ReactionCounts> {
  const redis = await redisClient();
  const v = await redis.hincrby(REACTIONS_KEY, emoji, delta);
  if (v < 0) await redis.hset(REACTIONS_KEY, { [emoji]: 0 });
  return redisGetReactions();
}

function normalizeReactions(raw: Record<string, unknown>): ReactionCounts {
  const out: ReactionCounts = {};
  for (const e of REACTIONS) out[e] = num(raw[e]);
  return out;
}

async function redisGetPushSubs(): Promise<PushSub[]> {
  const redis = await redisClient();
  const h = await redis.hgetall<Record<string, PushSub>>(PUSH_KEY);
  return h ? Object.values(h) : [];
}

// ---------- Doc backend (bitta JSON hujjat) ----------
// Prod (Vercel) -> Vercel Blob; lokal -> .data/db.json fayli.
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

// Vercel'da BLOB_READ_WRITE_TOKEN mavjud bo'lsa Blob'ni ishlatamiz.
// Lokalda (VERCEL yo'q) fayl-baza ishlaydi -> prod ma'lumotiga tegmaydi.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN && !!process.env.VERCEL;
const BLOB_PATH = "db.json";

interface Meta {
  views: number;
  visitors: number;
  daily: Record<string, number>; // date -> views
}

interface RawFile {
  books: Record<string, Book>;
  logs: Record<string, ReadingLog>;
  quotes: Record<string, Quote>;
  config: Config;
  meta: Meta;
  reactions: ReactionCounts;
  avatar?: string; // dataURL
  push: Record<string, PushSub>; // endpoint -> subscription
}

function emptyRaw(): RawFile {
  return {
    books: {},
    logs: {},
    quotes: {},
    config: { ...DEFAULT_CONFIG },
    meta: { views: 0, visitors: 0, daily: {} },
    reactions: normalizeReactions({}),
    push: {},
  };
}

function parseRaw(parsed: Partial<RawFile>): RawFile {
  return {
    books: parsed.books ?? {},
    logs: parsed.logs ?? {},
    quotes: parsed.quotes ?? {},
    config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
    meta: {
      views: parsed.meta?.views ?? 0,
      visitors: parsed.meta?.visitors ?? 0,
      daily: parsed.meta?.daily ?? {},
    },
    reactions: normalizeReactions(parsed.reactions ?? {}),
    avatar: parsed.avatar,
    push: parsed.push ?? {},
  };
}

// --- Fayl backend (lokal dev) ---
async function fileReadRaw(): Promise<RawFile> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return parseRaw(JSON.parse(raw) as Partial<RawFile>);
  } catch {
    return emptyRaw();
  }
}

async function fileWriteRaw(data: RawFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Blob URL'ini token ichidagi store id'dan deterministik quramiz.
// Token format: vercel_blob_rw_<STOREID>_<secret>
function blobUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  const storeId = token.split("_")[3] ?? "";
  return `https://${storeId.toLowerCase()}.private.blob.vercel-storage.com/${BLOB_PATH}`;
}

// --- Blob backend (Vercel, private store) ---
// list() eventual-consistent bo'lgani uchun deterministik URL'ni to'g'ridan-to'g'ri
// (Authorization header bilan) o'qiymiz -> yozgandan keyin darrov ko'rinadi.
async function blobReadRaw(): Promise<RawFile> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  try {
    const res = await fetch(blobUrl(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return emptyRaw(); // 404 = hali hujjat yo'q
    return parseRaw((await res.json()) as Partial<RawFile>);
  } catch {
    return emptyRaw();
  }
}

async function blobWriteRaw(data: RawFile) {
  const { put } = await import("@vercel/blob");
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

// --- Umumiy doc read/write ---
async function docReadRaw(): Promise<RawFile> {
  return useBlob ? blobReadRaw() : fileReadRaw();
}

async function docWriteRaw(data: RawFile): Promise<void> {
  return useBlob ? blobWriteRaw(data) : fileWriteRaw(data);
}

async function docRead(): Promise<DB> {
  const raw = await docReadRaw();
  return {
    books: raw.books,
    logs: raw.logs,
    quotes: raw.quotes,
    config: raw.config,
  };
}

// ---------- Public API ----------
export async function getAll(): Promise<DB> {
  return hasRedis ? redisGetAll() : docRead();
}

// ----- Kitoblar -----
export async function setBook(book: Book): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hset(BOOKS_KEY, { [book.id]: book });
    return;
  }
  const raw = await docReadRaw();
  raw.books[book.id] = book;
  await docWriteRaw(raw);
}

// Kitobni o'chirsak, unga tegishli barcha log va iqtiboslar ham o'chadi.
export async function removeBook(id: string): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    const [logs, quotes] = await Promise.all([
      redis.hgetall<Record<string, ReadingLog>>(LOGS_KEY),
      redis.hgetall<Record<string, Quote>>(QUOTES_KEY),
    ]);
    const logIds = Object.values(logs ?? {})
      .filter((l) => l.bookId === id)
      .map((l) => l.id);
    const quoteIds = Object.values(quotes ?? {})
      .filter((q) => q.bookId === id)
      .map((q) => q.id);
    await Promise.all([
      redis.hdel(BOOKS_KEY, id),
      logIds.length ? redis.hdel(LOGS_KEY, ...logIds) : Promise.resolve(),
      quoteIds.length ? redis.hdel(QUOTES_KEY, ...quoteIds) : Promise.resolve(),
    ]);
    return;
  }
  const raw = await docReadRaw();
  delete raw.books[id];
  for (const lid of Object.keys(raw.logs)) {
    if (raw.logs[lid].bookId === id) delete raw.logs[lid];
  }
  for (const qid of Object.keys(raw.quotes)) {
    if (raw.quotes[qid].bookId === id) delete raw.quotes[qid];
  }
  await docWriteRaw(raw);
}

// ----- O'qish yozuvlari (logs) -----
export async function setLog(log: ReadingLog): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hset(LOGS_KEY, { [log.id]: log });
    return;
  }
  const raw = await docReadRaw();
  raw.logs[log.id] = log;
  await docWriteRaw(raw);
}

export async function removeLog(id: string): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hdel(LOGS_KEY, id);
    return;
  }
  const raw = await docReadRaw();
  delete raw.logs[id];
  await docWriteRaw(raw);
}

// ----- Iqtiboslar -----
export async function setQuote(quote: Quote): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hset(QUOTES_KEY, { [quote.id]: quote });
    return;
  }
  const raw = await docReadRaw();
  raw.quotes[quote.id] = quote;
  await docWriteRaw(raw);
}

export async function removeQuote(id: string): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hdel(QUOTES_KEY, id);
    return;
  }
  const raw = await docReadRaw();
  delete raw.quotes[id];
  await docWriteRaw(raw);
}

// ----- Sozlamalar -----
export async function setConfig(config: Config): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.set(CONFIG_KEY, config);
    return;
  }
  const raw = await docReadRaw();
  raw.config = config;
  await docWriteRaw(raw);
}

// ----- Ko'rishlar -----
export async function getCounts(todayKey: string): Promise<Counts> {
  if (hasRedis) return redisGetCounts(todayKey);
  const raw = await docReadRaw();
  return {
    views: raw.meta.views,
    visitors: raw.meta.visitors,
    today: raw.meta.daily[todayKey] ?? 0,
  };
}

export async function registerView(
  newVisitor: boolean,
  todayKey: string,
): Promise<Counts> {
  if (hasRedis) return redisRegisterView(newVisitor, todayKey);
  const raw = await docReadRaw();
  raw.meta.views += 1;
  raw.meta.daily[todayKey] = (raw.meta.daily[todayKey] ?? 0) + 1;
  if (newVisitor) raw.meta.visitors += 1;
  await docWriteRaw(raw);
  return {
    views: raw.meta.views,
    visitors: raw.meta.visitors,
    today: raw.meta.daily[todayKey],
  };
}

// ----- Avatar -----
export async function getAvatar(): Promise<string | null> {
  if (hasRedis) {
    const redis = await redisClient();
    return (await redis.get<string>(AVATAR_KEY)) ?? null;
  }
  const raw = await docReadRaw();
  return raw.avatar ?? null;
}

export async function setAvatar(dataUrl: string): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.set(AVATAR_KEY, dataUrl);
    return;
  }
  const raw = await docReadRaw();
  raw.avatar = dataUrl;
  await docWriteRaw(raw);
}

export async function removeAvatar(): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.del(AVATAR_KEY);
    return;
  }
  const raw = await docReadRaw();
  delete raw.avatar;
  await docWriteRaw(raw);
}

// ----- Reaksiyalar -----
export async function getReactions(): Promise<ReactionCounts> {
  if (hasRedis) return redisGetReactions();
  const raw = await docReadRaw();
  return normalizeReactions(raw.reactions);
}

export async function changeReaction(
  emoji: string,
  delta: number,
): Promise<ReactionCounts> {
  if (hasRedis) return redisChangeReaction(emoji, delta);
  const raw = await docReadRaw();
  raw.reactions[emoji] = Math.max(0, (raw.reactions[emoji] ?? 0) + delta);
  await docWriteRaw(raw);
  return normalizeReactions(raw.reactions);
}

// ----- Push obunalari -----
export async function getPushSubs(): Promise<PushSub[]> {
  if (hasRedis) return redisGetPushSubs();
  const raw = await docReadRaw();
  return Object.values(raw.push);
}

export async function addPushSub(sub: PushSub): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hset(PUSH_KEY, { [sub.endpoint]: sub });
    return;
  }
  const raw = await docReadRaw();
  raw.push[sub.endpoint] = sub;
  await docWriteRaw(raw);
}

export async function removePushSub(endpoint: string): Promise<void> {
  if (hasRedis) {
    const redis = await redisClient();
    await redis.hdel(PUSH_KEY, endpoint);
    return;
  }
  const raw = await docReadRaw();
  delete raw.push[endpoint];
  await docWriteRaw(raw);
}

export function usingRedis() {
  return hasRedis;
}

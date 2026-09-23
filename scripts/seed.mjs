// Namuna kitoblar va o'qish yozuvlarini to'ldiradi.
// - Upstash env bo'lsa -> Redis'ga yozadi (deploy uchun).
// - Aks holda -> lokal .data/db.json ga yozadi.
//
// Ishlatish (lokal):   node scripts/seed.mjs
// Ishlatish (Upstash): UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/seed.mjs

import { promises as fs } from "fs";
import path from "path";

function key(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// So'nggi N kun uchun sana kalitlarini beradi (bugundan orqaga).
function lastDays(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(key(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }
  return out.reverse();
}

const days = lastDays(14);

const books = {
  b_otkan: {
    id: "b_otkan",
    title: "O'tkan kunlar",
    author: "Abdulla Qodiriy",
    totalPages: 400,
    startDate: days[0],
    status: "reading",
  },
  b_atomic: {
    id: "b_atomic",
    title: "Atomic Habits",
    author: "James Clear",
    totalPages: 320,
    startDate: days[0],
    status: "finished",
    finishDate: days[9],
    rating: 5,
    review: "Kichik odatlar katta natija berishini ajoyib tushuntiradi.",
  },
};

// Yozuvlar: Atomic Habits 10 kunda tugadi (~32 bet/kun), O'tkan kunlar davom etmoqda.
const logs = {};
let li = 0;
function addLog(bookId, date, pages, minutes) {
  const id = `l_${String(++li).padStart(3, "0")}`;
  logs[id] = { id, bookId, date, pages, minutes };
}

// Atomic Habits — birinchi 10 kun
for (let i = 0; i < 10; i++) addLog("b_atomic", days[i], 32, 40);
// O'tkan kunlar — so'nggi 5 kun
[22, 18, 25, 20, 30].forEach((p, i) =>
  addLog("b_otkan", days[9 + i], p, 25 + i * 2),
);

const quotes = {
  q_1: {
    id: "q_1",
    bookId: "b_atomic",
    text: "Siz maqsadlaringiz darajasiga emas, tizimlaringiz darajasiga tushasiz.",
    page: 27,
  },
};

const config = { dailyGoal: 20, ownerName: "ABRHAM" };

const hasRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

if (hasRedis) {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  await redis.del("kitob:books", "kitob:logs", "kitob:quotes");
  await redis.hset("kitob:books", books);
  await redis.hset("kitob:logs", logs);
  await redis.hset("kitob:quotes", quotes);
  await redis.set("kitob:config", config);
  console.log(
    `Upstash'ga ${Object.keys(books).length} kitob, ${Object.keys(logs).length} yozuv yozildi.`,
  );
} else {
  const dir = path.join(process.cwd(), ".data");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "db.json");
  await fs.writeFile(
    file,
    JSON.stringify({ books, logs, quotes, config }, null, 2),
    "utf8",
  );
  console.log(
    `Fayl-bazaga ${Object.keys(books).length} kitob, ${Object.keys(logs).length} yozuv yozildi: ${file}`,
  );
}

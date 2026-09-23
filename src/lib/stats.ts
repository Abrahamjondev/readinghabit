import { Book, ReadingLog, Config } from "./types";

// Sana yordamchilari — barchasi lokal vaqt bo'yicha "YYYY-MM-DD" formatida ishlaydi.

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Bir kunni orqaga/oldinga suradi va kalitini qaytaradi.
export function shiftKey(key: string, deltaDays: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + deltaDays);
  return toKey(d);
}

// Har kitob uchun jami o'qilgan bet sonini hisoblaydi. { bookId -> pages }
export function pagesByBook(
  logs: Record<string, ReadingLog>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of Object.values(logs)) {
    out[l.bookId] = (out[l.bookId] ?? 0) + Math.max(0, l.pages);
  }
  return out;
}

// Har kun uchun jami o'qilgan bet sonini hisoblaydi. { "YYYY-MM-DD" -> pages }
export function pagesByDate(
  logs: Record<string, ReadingLog>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of Object.values(logs)) {
    if (l.pages > 0) out[l.date] = (out[l.date] ?? 0) + l.pages;
  }
  return out;
}

export interface Achievement {
  id: string;
  label: string;
  threshold: number;
  unlocked: boolean;
}

// Nishonlar — tugatilgan kitoblar soni bo'yicha.
const ACHIEVEMENT_DEFS: Omit<Achievement, "unlocked">[] = [
  { id: "first", label: "Birinchi kitob", threshold: 1 },
  { id: "three", label: "3 kitob", threshold: 3 },
  { id: "five", label: "5 kitob", threshold: 5 },
  { id: "ten", label: "10 kitob", threshold: 10 },
  { id: "twentyfive", label: "25 kitob", threshold: 25 },
];

export interface Stats {
  booksReading: number; // hozir o'qilayotgan kitoblar
  booksFinished: number; // jami tugatilgan
  booksFinishedThisYear: number; // shu yilda tugatilgan
  pagesToday: number; // bugun o'qilgan bet
  pagesThisMonth: number;
  pagesThisYear: number;
  pagesTotal: number;
  minutesTotal: number; // jami o'qilgan vaqt (daqiqa)
  daysRead: number; // umuman o'qilgan kunlar soni
  currentStreak: number; // ketma-ket o'qilgan kunlar (bugungacha)
  bestStreak: number; // eng uzun streak
  avgPagesPerDay: number | null; // o'qilgan kunlar bo'yicha o'rtacha
  achievements: Achievement[];
}

export function computeStats(
  books: Record<string, Book>,
  logs: Record<string, ReadingLog>,
  _config: Config,
  today: Date = new Date(),
): Stats {
  const todayKey = toKey(today);
  const ymNow = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const yNow = String(today.getFullYear());

  const byDate = pagesByDate(logs);

  let pagesTotal = 0;
  let pagesThisMonth = 0;
  let pagesThisYear = 0;
  for (const [date, pages] of Object.entries(byDate)) {
    pagesTotal += pages;
    if (date.startsWith(ymNow)) pagesThisMonth += pages;
    if (date.startsWith(yNow)) pagesThisYear += pages;
  }
  const pagesToday = byDate[todayKey] ?? 0;

  let minutesTotal = 0;
  for (const l of Object.values(logs)) minutesTotal += l.minutes ?? 0;

  const readDates = new Set(Object.keys(byDate));
  const daysRead = readDates.size;
  const avgPagesPerDay =
    daysRead > 0 ? Math.round((pagesTotal / daysRead) * 10) / 10 : null;

  const currentStreak = countCurrentStreak(readDates, todayKey);
  const bestStreak = countBestStreak(readDates);

  let booksReading = 0;
  let booksFinished = 0;
  let booksFinishedThisYear = 0;
  for (const b of Object.values(books)) {
    if (b.status === "reading") booksReading++;
    if (b.status === "finished") {
      booksFinished++;
      if (b.finishDate?.startsWith(yNow)) booksFinishedThisYear++;
    }
  }

  const achievements: Achievement[] = ACHIEVEMENT_DEFS.map((a) => ({
    ...a,
    unlocked: booksFinished >= a.threshold,
  }));

  return {
    booksReading,
    booksFinished,
    booksFinishedThisYear,
    pagesToday,
    pagesThisMonth,
    pagesThisYear,
    pagesTotal,
    minutesTotal,
    daysRead,
    currentStreak,
    bestStreak,
    avgPagesPerDay,
    achievements,
  };
}

// Joriy streak: bugundan orqaga qarab ketma-ket o'qilgan kunlar.
// Bugun hali o'qilmagan bo'lsa ham streak buzilmaydi — kechadan boshlab sanaymiz.
function countCurrentStreak(readDates: Set<string>, todayKey: string): number {
  let streak = 0;
  let cursor = todayKey;
  if (!readDates.has(cursor)) {
    cursor = shiftKey(cursor, -1); // bugun uchun imtiyoz
  }
  while (readDates.has(cursor)) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}

// Eng uzun ketma-ket o'qilgan kunlar seriyasi.
function countBestStreak(readDates: Set<string>): number {
  const dates = [...readDates].sort();
  if (dates.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    if (shiftKey(dates[i - 1], 1) === dates[i]) {
      cur++;
    } else {
      cur = 1;
    }
    best = Math.max(best, cur);
  }
  return best;
}

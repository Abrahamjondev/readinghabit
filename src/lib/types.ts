// Kitob o'qish kuzatuvchisi uchun ma'lumot turlari.

export type BookStatus = "reading" | "finished" | "paused";

// Bitta kitob.
export interface Book {
  id: string; // barqaror id (masalan "b_xxx")
  title: string; // kitob nomi
  author?: string; // muallif
  totalPages: number; // jami bet soni
  startDate: string; // boshlangan sana "YYYY-MM-DD"
  status: BookStatus; // o'qiyapman / tugatdim / to'xtatdim
  finishDate?: string; // tugatilgan sana "YYYY-MM-DD"
  rating?: number; // 1..5 yulduz (tugatganda)
  review?: string; // qisqa taqriz (tugatganda)
}

// Bitta o'qish yozuvi — bir kunda bir kitobga qo'shilgan betlar.
export interface ReadingLog {
  id: string; // barqaror id
  bookId: string; // qaysi kitob
  date: string; // "YYYY-MM-DD"
  pages: number; // shu kuni o'qilgan bet soni
  minutes?: number; // ixtiyoriy: qancha vaqt o'qildi (daqiqa)
  note?: string; // qisqa izoh
}

// Kitobdan olingan sevimli iqtibos.
export interface Quote {
  id: string;
  bookId: string;
  text: string; // iqtibos matni
  page?: number; // qaysi bet
}

export interface Config {
  dailyGoal: number; // kuniga necha bet o'qish maqsadi
  ownerName: string; // sahifada ko'rinadigan ism
}

export interface DB {
  books: Record<string, Book>; // kalit = book.id
  logs: Record<string, ReadingLog>; // kalit = log.id
  quotes: Record<string, Quote>; // kalit = quote.id
  config: Config;
}

export const DEFAULT_CONFIG: Config = {
  dailyGoal: 20,
  ownerName: "ABRHAM",
};

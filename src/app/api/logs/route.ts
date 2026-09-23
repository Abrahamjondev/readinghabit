import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAll, setLog, removeLog, setBook } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { ReadingLog } from "@/lib/types";
import { toKey, pagesByBook } from "@/lib/stats";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// O'qish yozuvi qo'shish / yangilash — FAQAT egasi.
// Kitob to'liq o'qib bo'lingach avtomatik "finished" holatiga o'tadi.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);

  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const pages = Number(body?.pages);
  if (!bookId) {
    return NextResponse.json({ error: "bookId kerak" }, { status: 400 });
  }
  if (!Number.isFinite(pages) || pages < 1) {
    return NextResponse.json({ error: "Bet soni noto'g'ri" }, { status: 400 });
  }

  const db = await getAll();
  const book = db.books[bookId];
  if (!book) {
    return NextResponse.json({ error: "Kitob topilmadi" }, { status: 404 });
  }

  const date =
    typeof body?.date === "string" && DATE_RE.test(body.date)
      ? body.date
      : toKey(new Date());

  const minutes =
    Number.isFinite(Number(body?.minutes)) && Number(body.minutes) > 0
      ? Math.round(Number(body.minutes))
      : undefined;

  const existing =
    typeof body?.id === "string" ? db.logs[body.id] : undefined;

  const log: ReadingLog = {
    id: existing?.id ?? `l_${randomUUID().slice(0, 8)}`,
    bookId,
    date,
    pages: Math.round(pages),
    minutes,
    note:
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 300)
        : undefined,
  };

  await setLog(log);

  // Avtomatik tugatish: jami o'qilgan bet >= kitob betlari bo'lsa.
  let finished = false;
  if (book.status !== "finished") {
    const totals = pagesByBook({ ...db.logs, [log.id]: log });
    if ((totals[bookId] ?? 0) >= book.totalPages) {
      await setBook({
        ...book,
        status: "finished",
        finishDate: date,
      });
      finished = true;
    }
  }

  return NextResponse.json({ ok: true, log, finished });
}

// O'qish yozuvini o'chirish — FAQAT egasi.
export async function DELETE(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id kerak" }, { status: 400 });
  }
  await removeLog(id);
  return NextResponse.json({ ok: true });
}

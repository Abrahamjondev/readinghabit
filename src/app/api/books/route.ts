import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAll, setBook, removeBook } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { Book, BookStatus } from "@/lib/types";
import { toKey } from "@/lib/stats";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: BookStatus[] = ["reading", "finished", "paused"];

// Kitob qo'shish / yangilash — FAQAT egasi.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const totalPages = Number(body?.totalPages);
  if (!title) {
    return NextResponse.json({ error: "Kitob nomi kerak" }, { status: 400 });
  }
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    return NextResponse.json({ error: "Bet soni noto'g'ri" }, { status: 400 });
  }

  const { books } = await getAll();
  const existing = typeof body?.id === "string" ? books[body.id] : undefined;

  const status: BookStatus = STATUSES.includes(body?.status)
    ? body.status
    : (existing?.status ?? "reading");

  const startDate =
    typeof body?.startDate === "string" && DATE_RE.test(body.startDate)
      ? body.startDate
      : (existing?.startDate ?? toKey(new Date()));

  // finishDate: tugatilgan bo'lsa saqlanadi, aks holda o'chiriladi.
  let finishDate: string | undefined = existing?.finishDate;
  if (status === "finished") {
    finishDate =
      typeof body?.finishDate === "string" && DATE_RE.test(body.finishDate)
        ? body.finishDate
        : (finishDate ?? toKey(new Date()));
  } else {
    finishDate = undefined;
  }

  const rating =
    Number.isFinite(Number(body?.rating)) && Number(body.rating) > 0
      ? Math.min(5, Math.max(1, Math.round(Number(body.rating))))
      : status === "finished"
        ? existing?.rating
        : undefined;

  const book: Book = {
    id: existing?.id ?? (typeof body?.id === "string" ? body.id : `b_${randomUUID().slice(0, 8)}`),
    title: title.slice(0, 200),
    author:
      typeof body?.author === "string" && body.author.trim()
        ? body.author.trim().slice(0, 120)
        : undefined,
    totalPages: Math.round(totalPages),
    startDate,
    status,
    finishDate,
    rating,
    review:
      typeof body?.review === "string" && body.review.trim()
        ? body.review.trim().slice(0, 500)
        : status === "finished"
          ? existing?.review
          : undefined,
  };

  await setBook(book);
  return NextResponse.json({ ok: true, book });
}

// Kitobni o'chirish (log va iqtiboslari bilan) — FAQAT egasi.
export async function DELETE(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id kerak" }, { status: 400 });
  }
  await removeBook(id);
  return NextResponse.json({ ok: true });
}

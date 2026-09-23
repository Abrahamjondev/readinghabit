import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAll, setQuote, removeQuote } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

// Sevimli iqtibos qo'shish — FAQAT egasi.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);

  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!bookId) {
    return NextResponse.json({ error: "bookId kerak" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Iqtibos matni kerak" }, { status: 400 });
  }

  const { books } = await getAll();
  if (!books[bookId]) {
    return NextResponse.json({ error: "Kitob topilmadi" }, { status: 404 });
  }

  const page =
    Number.isFinite(Number(body?.page)) && Number(body.page) > 0
      ? Math.round(Number(body.page))
      : undefined;

  const quote: Quote = {
    id: typeof body?.id === "string" ? body.id : `q_${randomUUID().slice(0, 8)}`,
    bookId,
    text: text.slice(0, 1000),
    page,
  };

  await setQuote(quote);
  return NextResponse.json({ ok: true, quote });
}

// Iqtibosni o'chirish — FAQAT egasi.
export async function DELETE(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id kerak" }, { status: 400 });
  }
  await removeQuote(id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCounts, registerView } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { toKey } from "@/lib/stats";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "kitob_visitor";

// Har bir tashrifni hisoblaydi. Egasi hisobga olinmaydi (faqat ko'radi).
export async function POST() {
  const store = await cookies();
  const seen = store.get(VISITOR_COOKIE)?.value;
  const owner = await isOwner();
  const todayKey = toKey(new Date());

  // Egasi o'zi kirsa hisoblanmaydi — faqat joriy sonlarni qaytaramiz.
  if (owner) {
    return NextResponse.json(await getCounts(todayKey));
  }

  const newVisitor = !seen;
  const counts = await registerView(newVisitor, todayKey);

  if (newVisitor) {
    store.set(VISITOR_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 yil
    });
  }

  return NextResponse.json(counts);
}

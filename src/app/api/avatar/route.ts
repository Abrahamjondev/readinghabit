import { NextRequest, NextResponse } from "next/server";
import { setAvatar, removeAvatar } from "@/lib/storage";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Profil rasmini o'rnatish — FAQAT egasi.
export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const avatar = body?.avatar;
  if (typeof avatar !== "string" || !avatar.startsWith("data:image/")) {
    return NextResponse.json({ error: "Noto'g'ri rasm" }, { status: 400 });
  }
  if (avatar.length > 2_000_000) {
    return NextResponse.json({ error: "Rasm juda katta" }, { status: 413 });
  }
  await setAvatar(avatar);
  return NextResponse.json({ ok: true });
}

// Profil rasmini o'chirish — FAQAT egasi.
export async function DELETE() {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  await removeAvatar();
  return NextResponse.json({ ok: true });
}

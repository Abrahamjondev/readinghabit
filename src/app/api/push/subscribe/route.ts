import { NextRequest, NextResponse } from "next/server";
import { addPushSub, removePushSub, PushSub } from "@/lib/storage";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Bildirishnomaga obuna bo'lish — FAQAT egasi (eslatma egasiga keladi).
export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const sub = body?.subscription as PushSub | undefined;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Noto'g'ri obuna" }, { status: 400 });
  }
  await addPushSub({ endpoint: sub.endpoint, keys: sub.keys });
  return NextResponse.json({ ok: true });
}

// Obunani bekor qilish.
export async function DELETE(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint === "string") await removePushSub(endpoint);
  return NextResponse.json({ ok: true });
}

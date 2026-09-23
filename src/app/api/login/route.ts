import { NextRequest, NextResponse } from "next/server";
import { checkPin, setOwnerCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PIN bilan kirish. To'g'ri bo'lsa egasi cookie'si o'rnatiladi.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const pin = String(body?.pin ?? "");
  if (!checkPin(pin)) {
    return NextResponse.json({ error: "PIN noto'g'ri" }, { status: 401 });
  }
  await setOwnerCookie();
  return NextResponse.json({ ok: true });
}

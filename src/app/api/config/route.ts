import { NextRequest, NextResponse } from "next/server";
import { getAll, setConfig } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { Config } from "@/lib/types";

export const dynamic = "force-dynamic";

// Sozlamalarni yangilash (kunlik bet maqsadi, ism) — FAQAT egasi.
export async function PUT(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { config } = await getAll();
  const next: Config = { ...config };
  if (typeof body?.dailyGoal === "number") {
    next.dailyGoal = Math.min(300, Math.max(1, Math.round(body.dailyGoal)));
  }
  if (typeof body?.ownerName === "string" && body.ownerName.trim()) {
    next.ownerName = body.ownerName.trim().slice(0, 40);
  }
  await setConfig(next);
  return NextResponse.json({ ok: true, config: next });
}

import { NextResponse } from "next/server";
import { clearOwnerCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Chiqish.
export async function POST() {
  await clearOwnerCookie();
  return NextResponse.json({ ok: true });
}

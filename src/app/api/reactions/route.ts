import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { changeReaction, getReactions, REACTIONS } from "@/lib/storage";

export const dynamic = "force-dynamic";

const REACTED_COOKIE = "kitob_reacted";

function readMine(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((e) => REACTIONS.includes(e)) : [];
  } catch {
    return [];
  }
}

// Reaksiya bosish/bekor qilish — har tashrifchi har reaksiyani FAQAT bir marta.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const emoji = body?.emoji;
  if (typeof emoji !== "string" || !REACTIONS.includes(emoji as never)) {
    return NextResponse.json({ error: "Noto'g'ri reaksiya" }, { status: 400 });
  }

  const store = await cookies();
  let mine = readMine(store.get(REACTED_COOKIE)?.value);

  let reactions;
  if (mine.includes(emoji)) {
    // Ikkinchi marta bosildi -> bekor qilamiz.
    reactions = await changeReaction(emoji, -1);
    mine = mine.filter((e) => e !== emoji);
  } else {
    reactions = await changeReaction(emoji, +1);
    mine = [...mine, emoji];
  }

  store.set(REACTED_COOKIE, JSON.stringify(mine), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ reactions, mine });
}

export async function GET() {
  const store = await cookies();
  const mine = readMine(store.get(REACTED_COOKIE)?.value);
  return NextResponse.json({ reactions: await getReactions(), mine });
}

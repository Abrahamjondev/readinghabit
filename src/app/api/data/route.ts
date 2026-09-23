import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAll, getAvatar, getReactions, REACTIONS } from "@/lib/storage";
import { isOwner } from "@/lib/auth";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

function readMine(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((e) => REACTIONS.includes(e)) : [];
  } catch {
    return [];
  }
}

// Ommaviy (public) o'qish. Hamma ko'ra oladi.
export async function GET() {
  const [db, owner, avatar, reactions, store] = await Promise.all([
    getAll(),
    isOwner(),
    getAvatar(),
    getReactions(),
    cookies(),
  ]);
  const stats = computeStats(db.books, db.logs, db.config);
  const myReactions = readMine(store.get("kitob_reacted")?.value);
  return NextResponse.json({
    books: db.books,
    logs: db.logs,
    quotes: db.quotes,
    config: db.config,
    stats,
    isOwner: owner,
    avatar,
    reactions,
    myReactions,
  });
}

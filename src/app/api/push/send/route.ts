import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getAll, getPushSubs, removePushSub } from "@/lib/storage";
import { toKey, pagesByDate } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Vercel Cron har kuni chaqiradi. Egasi bugun o'qimagan bo'lsa eslatma yuboradi.
export async function GET(req: NextRequest) {
  // Cron himoyasi: Vercel `Authorization: Bearer <CRON_SECRET>` qo'shadi.
  const auth = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 401 });
  }

  const { logs, config } = await getAll();
  const now = new Date();
  const todayKey = toKey(now);

  const byDate = pagesByDate(logs);
  const readToday = byDate[todayKey] ?? 0;

  // Kunlik maqsadga yetilgan bo'lsa — eslatma kerak emas.
  if (readToday >= Math.max(1, config.dailyGoal)) {
    return NextResponse.json({ sent: 0, reason: "goal-met" });
  }

  const subs = await getPushSubs();
  if (subs.length === 0) return NextResponse.json({ sent: 0, reason: "no-subs" });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:example@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const left = Math.max(0, config.dailyGoal - readToday);
  const payload = JSON.stringify({
    title: "Kitob vaqti! 📚",
    body:
      readToday > 0
        ? `Bugun ${readToday} bet o'qildi. Maqsadga ${left} bet qoldi!`
        : `Bugun hali o'qimadingiz. Kuniga ${config.dailyGoal} bet — boshlab qo'ying!`,
    url: "/",
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await removePushSub(sub.endpoint);
      }
    }),
  );

  return NextResponse.json({ sent });
}

"use client";

import { toKey } from "@/lib/stats";

interface Props {
  year: number;
  pages: Record<string, number>; // "YYYY-MM-DD" -> shu kuni o'qilgan bet
  todayKey: string;
}

const MONTH_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

// Bir kundagi betlar soniga qarab quyuqlik darajasi (0..4).
function level(pages: number): number {
  if (pages <= 0) return 0;
  if (pages < 10) return 1;
  if (pages < 25) return 2;
  if (pages < 50) return 3;
  return 4;
}

const LEVEL_OPACITY = [0, 0.28, 0.5, 0.75, 1];

// Bir yilni haftalarga (ustunlar) ajratadi. Har ustun 7 kun (Du..Ya).
export default function ReadingHeatmap({ year, pages, todayKey }: Props) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  // Birinchi ustun yil boshidagi haftaning dushanbasidan boshlanadi.
  const start = new Date(jan1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= dec31 || cursor.getDay() !== 1) {
    const col: Date[] = [];
    for (let i = 0; i < 7; i++) {
      col.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
    if (cursor > dec31 && cursor.getDay() === 1) break;
  }

  const monthLabels = weeks.map((col) => {
    const firstOfMonth = col.find(
      (d) => d.getFullYear() === year && d.getDate() <= 7,
    );
    return firstOfMonth ? MONTH_SHORT[firstOfMonth.getMonth()] : "";
  });

  return (
    <div className="rounded-2xl border border-border-soft bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">
          O&apos;qish yili{" "}
          <span className="font-normal text-muted">{year}</span>
        </h2>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span>Kam</span>
          {LEVEL_OPACITY.map((op, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-[3px]"
              style={{
                background:
                  op === 0 ? "var(--surface-2)" : "var(--accent)",
                opacity: op === 0 ? 1 : op,
              }}
            />
          ))}
          <span>Ko&apos;p</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1 pl-0">
            {monthLabels.map((label, i) => (
              <div
                key={i}
                className="w-3 text-[9px] leading-3 text-muted"
                style={{ minWidth: "0.75rem" }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {col.map((d, ri) => {
                  const inYear = d.getFullYear() === year;
                  if (!inYear) return <div key={ri} className="h-3 w-3" />;
                  const key = toKey(d);
                  const p = pages[key] ?? 0;
                  const lv = level(p);
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={ri}
                      title={p > 0 ? `${key}: ${p} bet` : key}
                      className={[
                        "h-3 w-3 rounded-[3px]",
                        isToday
                          ? "ring-1 ring-accent ring-offset-1 ring-offset-card"
                          : "",
                      ].join(" ")}
                      style={{
                        background:
                          lv === 0 ? "var(--surface-2)" : "var(--accent)",
                        opacity: lv === 0 ? 1 : LEVEL_OPACITY[lv],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

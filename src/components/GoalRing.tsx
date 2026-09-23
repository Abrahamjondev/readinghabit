"use client";

interface Props {
  value: number;
  max: number;
  title?: string;
  unit?: string; // "bet", "marta" ...
}

// Dumaloq progress halqasi (kunlik maqsad uchun).
export default function GoalRing({
  value,
  max,
  title = "Kunlik maqsad",
  unit = "bet",
}: Props) {
  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const done = value >= max && max > 0;

  return (
    <div className="fade-up flex items-center gap-4 rounded-2xl border border-border-soft bg-card p-4 sm:p-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            style={{ stroke: "var(--surface-2)" }}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              stroke: "var(--accent)",
              strokeDasharray: c,
              strokeDashoffset: c * (1 - pct),
              transition: "stroke-dashoffset 0.6s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          <span className="text-xs text-muted">/ {max}</span>
        </div>
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">
          {done
            ? "Bajarildi! 🎉 Zo'r ish!"
            : `Maqsadga ${Math.max(0, max - value)} ${unit} qoldi`}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Book, ReadingLog, Quote, Config } from "@/lib/types";
import { Stats, toKey, pagesByBook, pagesByDate } from "@/lib/stats";
import { quoteOfDay } from "@/lib/quotes";
import GoalRing from "./GoalRing";
import ReadingHeatmap from "./ReadingHeatmap";
import AvatarCropper from "./AvatarCropper";
import {
  pushSupported,
  getSubscription,
  enablePush,
  disablePush,
} from "@/lib/push";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const REACTIONS = ["📚", "🔥", "👏", "❤️"];

interface ApiData {
  books: Record<string, Book>;
  logs: Record<string, ReadingLog>;
  quotes: Record<string, Quote>;
  config: Config;
  stats: Stats;
  isOwner: boolean;
  avatar: string | null;
  reactions: Record<string, number>;
  myReactions: string[];
}

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const todayKey = toKey(now);

  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookForm, setBookForm] = useState<{ book?: Book } | null>(null);
  const [logModal, setLogModal] = useState<{
    bookId: string;
    log?: ReadingLog;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [finishBook, setFinishBook] = useState<Book | null>(null);
  const [counts, setCounts] = useState<{
    views: number;
    visitors: number;
    today: number;
  } | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // e'tiborsiz
    }
    setDark(next);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    const json = (await res.json()) as ApiData;
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/view", { method: "POST" })
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {});
  }, []);

  const [installEvt, setInstallEvt] =
    useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const doInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    setInstallEvt(null);
  };

  const isOwner = data?.isOwner ?? false;

  const fireConfetti = () => {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.7 },
      colors: ["#525252", "#404040", "#737373", "#a3a3a3"],
      scalar: 0.9,
    });
  };

  // ----- Owner amallari -----
  const saveBook = async (payload: Partial<Book>) => {
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
    return res.ok ? ((await res.json()).book as Book) : null;
  };

  const deleteBook = async (id: string) => {
    await fetch(`/api/books?id=${id}`, { method: "DELETE" });
    await load();
  };

  const saveLog = async (payload: Partial<ReadingLog>) => {
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    await load();
    return json as { finished?: boolean } | null;
  };

  const deleteLog = async (id: string) => {
    await fetch(`/api/logs?id=${id}`, { method: "DELETE" });
    await load();
  };

  const saveQuote = async (payload: Partial<Quote>) => {
    await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
  };

  const deleteQuote = async (id: string) => {
    await fetch(`/api/quotes?id=${id}`, { method: "DELETE" });
    await load();
  };

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => alert("Rasmni o'qib bo'lmadi. Boshqa rasm tanlang.");
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (dataUrl: string) => {
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      if (!res.ok) throw new Error();
      setCropSrc(null);
      await load();
    } catch {
      alert("Rasm saqlanmadi. Qayta urinib ko'ring.");
    }
    setAvatarBusy(false);
  };

  const removeAvatar = async () => {
    await fetch("/api/avatar", { method: "DELETE" });
    await load();
  };

  // Reaksiya
  const react = async (emoji: string) => {
    const mine = data?.myReactions ?? [];
    const has = mine.includes(emoji);
    setData((d) =>
      d
        ? {
            ...d,
            reactions: {
              ...d.reactions,
              [emoji]: Math.max(0, (d.reactions[emoji] ?? 0) + (has ? -1 : 1)),
            },
            myReactions: has
              ? mine.filter((e) => e !== emoji)
              : [...mine, emoji],
          }
        : d,
    );
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const json = await res.json();
      if (json?.reactions)
        setData((d) =>
          d
            ? {
                ...d,
                reactions: json.reactions,
                myReactions: json.mine ?? d.myReactions,
              }
            : d,
        );
    } catch {
      // e'tiborsiz
    }
  };

  const requireOwner = (fn: () => void) => {
    if (!isOwner) {
      setLoginOpen(true);
      return;
    }
    fn();
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        <div className="animate-pulse text-sm">Yuklanmoqda…</div>
      </div>
    );
  }

  const { config, stats, books, logs, quotes } = data!;
  const readByBook = pagesByBook(logs);
  const byDate = pagesByDate(logs);

  const bookList = Object.values(books);
  const reading = bookList
    .filter((b) => b.status !== "finished")
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const finished = bookList
    .filter((b) => b.status === "finished")
    .sort((a, b) => ((a.finishDate ?? "") < (b.finishDate ?? "") ? 1 : -1));

  const detailBook = detailId ? books[detailId] : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
      {/* Header */}
      <header className="fade-up mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isOwner && avatarInputRef.current?.click()}
            disabled={!isOwner || avatarBusy}
            className={[
              "relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border-soft bg-surface-2 sm:h-16 sm:w-16",
              isOwner ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
            title={isOwner ? "Rasmni o'zgartirish" : config.ownerName}
          >
            {data!.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data!.avatar}
                alt={config.ownerName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-xl font-bold text-muted">
                {config.ownerName.charAt(0).toUpperCase()}
              </span>
            )}
            {isOwner && (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white">
                {avatarBusy ? "..." : "📷"}
              </span>
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickAvatar}
          />

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              Kitob Davomat
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
              {config.ownerName}
            </h1>
            <p className="mt-1 text-sm text-muted">{quoteOfDay(now)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Rejimni almashtirish"
            className="grid h-8 w-8 place-items-center rounded-full border border-border-soft bg-card text-sm transition hover:border-strong"
          >
            {dark ? "☀️" : "🌙"}
          </button>
          {isOwner ? (
            <>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg">
                Egasi
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="text-xs text-muted underline-offset-2 hover:underline"
                >
                  Sozlama
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    await load();
                  }}
                  className="text-xs text-muted underline-offset-2 hover:underline"
                >
                  Chiqish
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="rounded-full border border-border-soft bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:border-strong"
            >
              Egasi kirishi
            </button>
          )}
        </div>
      </header>

      {/* Tashrifchilar */}
      {counts && (
        <div className="fade-up mb-5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-card px-3 py-1.5">
            👁 <b className="text-foreground">{counts.views.toLocaleString()}</b>{" "}
            ko&apos;rish
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-card px-3 py-1.5">
            🧑{" "}
            <b className="text-foreground">
              {counts.visitors.toLocaleString()}
            </b>{" "}
            tashrifchi
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-card px-3 py-1.5">
            📅 bugun{" "}
            <b className="text-foreground">{counts.today.toLocaleString()}</b>
          </span>
        </div>
      )}

      {/* Ilova o'rnatish */}
      {installEvt && (
        <button
          onClick={doInstall}
          className="fade-up mb-5 flex w-full items-center justify-between rounded-2xl border border-accent bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition active:scale-[0.99]"
        >
          <span>📲 Ilovani telefonga o&apos;rnatish</span>
          <span className="text-xs opacity-70">o&apos;rnatish ›</span>
        </button>
      )}

      {/* Kunlik maqsad */}
      <div className="mb-5">
        <GoalRing value={stats.pagesToday} max={config.dailyGoal} unit="bet" />
      </div>

      {/* Statistika */}
      <StatsGrid stats={stats} />

      {/* Nishonlar */}
      <Achievements stats={stats} />

      {/* Hozir o'qilayotgan kitoblar */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">
            Hozir o&apos;qiyapman
          </h2>
          {isOwner && (
            <button
              onClick={() => setBookForm({})}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:opacity-90 active:scale-95"
            >
              + Kitob qo&apos;shish
            </button>
          )}
        </div>
        {reading.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-soft bg-card p-6 text-center text-sm text-muted">
            {isOwner
              ? "Hali kitob yo'q. “+ Kitob qo'shish”ni bosing."
              : "Hozircha o'qilayotgan kitob yo'q."}
          </div>
        ) : (
          <div className="space-y-3">
            {reading.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                read={readByBook[b.id] ?? 0}
                isOwner={isOwner}
                onOpen={() => setDetailId(b.id)}
                onQuickLog={() =>
                  requireOwner(() => setLogModal({ bookId: b.id }))
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Tugatilgan kitoblar */}
      {finished.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold tracking-tight">
            Tugatilgan{" "}
            <span className="font-normal text-muted">({finished.length})</span>
          </h2>
          <div className="space-y-3">
            {finished.map((b) => (
              <FinishedCard
                key={b.id}
                book={b}
                read={readByBook[b.id] ?? 0}
                onOpen={() => setDetailId(b.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Heatmap */}
      <div className="mt-6">
        <ReadingHeatmap
          year={now.getFullYear()}
          pages={byDate}
          todayKey={todayKey}
        />
      </div>

      {/* Reaksiyalar */}
      <ReactionsBar
        reactions={data!.reactions}
        mine={data!.myReactions}
        onReact={react}
      />

      <footer className="mt-10 text-center text-xs text-muted">
        {isOwner
          ? "Har kuni o'qiganingni yozib bor — qolgan betlar avtomatik hisoblanadi."
          : "Bu sahifa faqat ko'rish uchun. O'zgartirish egasida."}
      </footer>

      {/* ---- Modallar ---- */}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          read={readByBook[detailBook.id] ?? 0}
          logs={Object.values(logs)
            .filter((l) => l.bookId === detailBook.id)
            .sort((a, b) => (a.date < b.date ? 1 : -1))}
          quotes={Object.values(quotes).filter(
            (q) => q.bookId === detailBook.id,
          )}
          isOwner={isOwner}
          onClose={() => setDetailId(null)}
          onAddLog={() => setLogModal({ bookId: detailBook.id })}
          onEditLog={(l) => setLogModal({ bookId: detailBook.id, log: l })}
          onDeleteLog={deleteLog}
          onEditBook={() => setBookForm({ book: detailBook })}
          onFinish={() => setFinishBook(detailBook)}
          onReopen={async () => {
            await saveBook({ ...detailBook, status: "reading" });
          }}
          onDeleteBook={async () => {
            if (confirm(`"${detailBook.title}" o'chirilsinmi?`)) {
              await deleteBook(detailBook.id);
              setDetailId(null);
            }
          }}
          onAddQuote={saveQuote}
          onDeleteQuote={deleteQuote}
        />
      )}

      {bookForm && (
        <BookFormModal
          book={bookForm.book}
          onClose={() => setBookForm(null)}
          onSave={async (payload) => {
            await saveBook(payload);
            setBookForm(null);
          }}
        />
      )}

      {logModal && (
        <LogModal
          book={books[logModal.bookId]}
          log={logModal.log}
          todayKey={todayKey}
          onClose={() => setLogModal(null)}
          onSave={async (payload) => {
            const res = await saveLog(payload);
            setLogModal(null);
            if (res?.finished) {
              fireConfetti();
              setFinishBook(books[logModal.bookId]);
            }
          }}
        />
      )}

      {finishBook && (
        <FinishModal
          book={finishBook}
          onClose={() => setFinishBook(null)}
          onSave={async (rating, review) => {
            await saveBook({
              ...finishBook,
              status: "finished",
              finishDate: finishBook.finishDate ?? todayKey,
              rating,
              review,
            });
            setFinishBook(null);
            fireConfetti();
          }}
        />
      )}

      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={async () => {
            setLoginOpen(false);
            await load();
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          config={config}
          hasAvatar={!!data!.avatar}
          onChangeAvatar={() => {
            setSettingsOpen(false);
            avatarInputRef.current?.click();
          }}
          onRemoveAvatar={async () => {
            await removeAvatar();
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
          onSaved={async () => {
            setSettingsOpen(false);
            await load();
          }}
        />
      )}

      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          saving={avatarBusy}
          onCancel={() => setCropSrc(null)}
          onSave={uploadAvatar}
        />
      )}
    </main>
  );
}

/* ---------- Progress bar ---------- */
function Progress({ read, total }: { read: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((read / total) * 100)) : 0;
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>
          {read} / {total} bet
        </span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
    </div>
  );
}

/* ---------- Kitob kartasi (o'qilayotgan) ---------- */
function BookCard({
  book,
  read,
  isOwner,
  onOpen,
  onQuickLog,
}: {
  book: Book;
  read: number;
  isOwner: boolean;
  onOpen: () => void;
  onQuickLog: () => void;
}) {
  const remaining = Math.max(0, book.totalPages - read);
  return (
    <div className="fade-up rounded-2xl border border-border-soft bg-card p-4">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {book.title}
            </h3>
            {book.author && (
              <p className="truncate text-xs text-muted">{book.author}</p>
            )}
          </div>
          {book.status === "paused" && (
            <span className="shrink-0 rounded-full border border-border-soft px-2 py-0.5 text-[10px] text-muted">
              to&apos;xtatilgan
            </span>
          )}
        </div>
        <div className="mt-3">
          <Progress read={read} total={book.totalPages} />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {remaining > 0
            ? `Yana ${remaining} bet qoldi`
            : "O'qib tugatildi 🎉"}
        </p>
      </button>
      {isOwner && (
        <button
          onClick={onQuickLog}
          className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95"
        >
          + Bugun o&apos;qidim
        </button>
      )}
    </div>
  );
}

/* ---------- Tugatilgan kitob kartasi ---------- */
function FinishedCard({
  book,
  read,
  onOpen,
}: {
  book: Book;
  read: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="fade-up w-full rounded-2xl border border-border-soft bg-card p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">
            ✅ {book.title}
          </h3>
          {book.author && (
            <p className="truncate text-xs text-muted">{book.author}</p>
          )}
        </div>
        {book.rating ? <Stars value={book.rating} /> : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        {book.totalPages} bet · o&apos;qildi {read} bet
        {book.finishDate ? ` · ${book.finishDate}` : ""}
      </p>
      {book.review && (
        <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">
          “{book.review}”
        </p>
      )}
    </button>
  );
}

/* ---------- Yulduzlar ---------- */
function Stars({ value }: { value: number }) {
  return (
    <span className="shrink-0 text-sm" title={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-muted">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={[
            "text-3xl transition active:scale-90",
            n <= value ? "text-foreground" : "text-muted/40",
          ].join(" ")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/* ---------- Statistika ---------- */
function StatsGrid({ stats }: { stats: Stats }) {
  const items = [
    {
      label: "O'qish streak 🔥",
      value: `${stats.currentStreak} kun`,
      sub: `eng uzun: ${stats.bestStreak}`,
    },
    { label: "Bu yil tugatilgan", value: stats.booksFinishedThisYear },
    { label: "Jami tugatilgan", value: stats.booksFinished },
    { label: "Hozir o'qiyapman", value: stats.booksReading },
    { label: "Bu yil o'qilgan", value: `${stats.pagesThisYear} bet` },
    { label: "Jami betlar", value: stats.pagesTotal },
    {
      label: "O'rtacha / kun",
      value:
        stats.avgPagesPerDay !== null ? `${stats.avgPagesPerDay} bet` : "—",
    },
    {
      label: "Jami vaqt",
      value:
        stats.minutesTotal >= 60
          ? `${Math.round(stats.minutesTotal / 60)} soat`
          : `${stats.minutesTotal} daq`,
    },
  ];
  return (
    <section className="fade-up mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-border-soft bg-card p-3"
        >
          <p className="text-[11px] font-medium text-muted">{it.label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{it.value}</p>
          {"sub" in it && it.sub && (
            <p className="text-[10px] text-muted">{it.sub}</p>
          )}
        </div>
      ))}
    </section>
  );
}

/* ---------- Nishonlar ---------- */
function Achievements({ stats }: { stats: Stats }) {
  return (
    <section className="fade-up mb-1">
      <div className="flex flex-wrap gap-2">
        {stats.achievements.map((a) => (
          <div
            key={a.id}
            title={`${a.threshold} kitob`}
            className={[
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              a.unlocked
                ? "border-accent bg-surface-2 text-foreground"
                : "border-dashed border-border-soft bg-transparent text-muted",
            ].join(" ")}
          >
            <span>{a.unlocked ? "🏅" : "🔒"}</span>
            {a.label}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Reaksiyalar ---------- */
function ReactionsBar({
  reactions,
  mine,
  onReact,
}: {
  reactions: Record<string, number>;
  mine: string[];
  onReact: (emoji: string) => void;
}) {
  const [popped, setPopped] = useState<string | null>(null);
  const total = REACTIONS.reduce((s, e) => s + (reactions[e] ?? 0), 0);

  const tap = (e: string) => {
    setPopped(e);
    setTimeout(() => setPopped(null), 400);
    onReact(e);
  };

  return (
    <div className="fade-up mt-6 rounded-2xl border border-border-soft bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">
          Qo&apos;llab-quvvatlash
        </h2>
        <span className="text-xs text-muted">
          {total.toLocaleString()} reaksiya
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {REACTIONS.map((e) => {
          const active = mine.includes(e);
          return (
            <button
              key={e}
              onClick={() => tap(e)}
              className={[
                "flex flex-col items-center gap-1 rounded-xl border py-3 transition active:scale-90",
                active
                  ? "border-accent bg-surface-2"
                  : "border-border-soft hover:border-strong",
              ].join(" ")}
            >
              <span className={popped === e ? "mark-pop text-2xl" : "text-2xl"}>
                {e}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {(reactions[e] ?? 0).toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        Har bir reaksiyani bir marta bosish mumkin
      </p>
    </div>
  );
}

/* ---------- Kitob detali ---------- */
function BookDetailModal({
  book,
  read,
  logs,
  quotes,
  isOwner,
  onClose,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onEditBook,
  onFinish,
  onReopen,
  onDeleteBook,
  onAddQuote,
  onDeleteQuote,
}: {
  book: Book;
  read: number;
  logs: ReadingLog[];
  quotes: Quote[];
  isOwner: boolean;
  onClose: () => void;
  onAddLog: () => void;
  onEditLog: (l: ReadingLog) => void;
  onDeleteLog: (id: string) => void;
  onEditBook: () => void;
  onFinish: () => void;
  onReopen: () => void;
  onDeleteBook: () => void;
  onAddQuote: (payload: Partial<Quote>) => Promise<void>;
  onDeleteQuote: (id: string) => void;
}) {
  const [qText, setQText] = useState("");
  const [qPage, setQPage] = useState("");
  const remaining = Math.max(0, book.totalPages - read);
  const isFinished = book.status === "finished";

  const addQuote = async () => {
    if (!qText.trim()) return;
    await onAddQuote({
      bookId: book.id,
      text: qText.trim(),
      page: qPage ? Number(qPage) : undefined,
    });
    setQText("");
    setQPage("");
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{book.title}</h3>
          {book.author && <p className="text-sm text-muted">{book.author}</p>}
        </div>
        {book.rating ? <Stars value={book.rating} /> : null}
      </div>

      <div className="mt-4">
        <Progress read={read} total={book.totalPages} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {isFinished
          ? `Tugatilgan${book.finishDate ? ` · ${book.finishDate}` : ""}`
          : remaining > 0
            ? `Yana ${remaining} bet qoldi · boshlangan ${book.startDate}`
            : "O'qib tugatildi 🎉"}
      </p>

      {book.review && (
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-foreground/80">
          “{book.review}”
        </p>
      )}

      {isOwner && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!isFinished ? (
            <>
              <button
                onClick={onAddLog}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95"
              >
                + O&apos;qish qo&apos;shish
              </button>
              <button
                onClick={onFinish}
                className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium transition hover:border-strong"
              >
                🏁 Tugatdim
              </button>
            </>
          ) : (
            <button
              onClick={onReopen}
              className="flex-1 rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium transition hover:border-strong"
            >
              ↩︎ Qayta o&apos;qishga ochish
            </button>
          )}
          <button
            onClick={onEditBook}
            className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium transition hover:border-strong"
          >
            ✎ Tahrir
          </button>
          <button
            onClick={onDeleteBook}
            className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-500"
          >
            🗑
          </button>
        </div>
      )}

      {/* Iqtiboslar */}
      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold">Sevimli iqtiboslar</h4>
        {quotes.length === 0 && !isOwner && (
          <p className="text-xs text-muted">Hozircha iqtibos yo&apos;q.</p>
        )}
        <div className="space-y-2">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-border-soft bg-surface p-3"
            >
              <p className="text-sm text-foreground/90">
                “{q.text}”
                {q.page ? (
                  <span className="text-muted"> — {q.page}-bet</span>
                ) : null}
              </p>
              {isOwner && (
                <button
                  onClick={() => onDeleteQuote(q.id)}
                  className="shrink-0 text-xs text-muted hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <div className="mt-2 space-y-2">
            <textarea
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={2}
              placeholder="Yoqqan gapni yozib qo'ying…"
              className="w-full resize-none rounded-lg border border-border-soft bg-card px-3 py-2 text-sm outline-none focus:border-strong"
            />
            <div className="flex gap-2">
              <input
                value={qPage}
                onChange={(e) => setQPage(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="bet"
                className="w-20 rounded-lg border border-border-soft bg-card px-3 py-2 text-sm outline-none focus:border-strong"
              />
              <button
                onClick={addQuote}
                disabled={!qText.trim()}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                Iqtibos qo&apos;shish
              </button>
            </div>
          </div>
        )}
      </div>

      {/* O'qish tarixi */}
      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold">
          O&apos;qish tarixi{" "}
          <span className="font-normal text-muted">({logs.length})</span>
        </h4>
        {logs.length === 0 ? (
          <p className="text-xs text-muted">Hali yozuv yo&apos;q.</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 border-b border-border-soft py-1.5 text-sm last:border-0"
              >
                <span className="text-muted">{l.date}</span>
                <span className="flex-1 px-2 font-medium">
                  {l.pages} bet
                  {l.minutes ? (
                    <span className="text-muted"> · {l.minutes} daq</span>
                  ) : null}
                  {l.note ? (
                    <span className="text-muted"> · {l.note}</span>
                  ) : null}
                </span>
                {isOwner && (
                  <span className="flex shrink-0 gap-2">
                    <button
                      onClick={() => onEditLog(l)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDeleteLog(l.id)}
                      className="text-xs text-muted hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}

/* ---------- Kitob qo'shish / tahrir ---------- */
function BookFormModal({
  book,
  onClose,
  onSave,
}: {
  book?: Book;
  onClose: () => void;
  onSave: (payload: Partial<Book>) => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [pages, setPages] = useState(book ? String(book.totalPages) : "");
  const [start, setStart] = useState(book?.startDate ?? toKey(new Date()));
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!title.trim() || !pages) return;
    setSaving(true);
    onSave({
      id: book?.id,
      title: title.trim(),
      author: author.trim() || undefined,
      totalPages: Number(pages),
      startDate: start,
      status: book?.status,
    });
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold">
        {book ? "Kitobni tahrirlash" : "Yangi kitob"}
      </h3>
      <div className="mt-4 space-y-4">
        <Field label="Kitob nomi">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="masalan: O'tkan kunlar"
            className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
          />
        </Field>
        <Field label="Muallif (ixtiyoriy)">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="masalan: Abdulla Qodiriy"
            className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Jami bet" className="flex-1">
            <input
              value={pages}
              onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="320"
              className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
            />
          </Field>
          <Field label="Boshlangan sana" className="flex-1">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
            />
          </Field>
        </div>
        <button
          onClick={save}
          disabled={saving || !title.trim() || !pages}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- O'qish yozuvi ---------- */
function LogModal({
  book,
  log,
  todayKey,
  onClose,
  onSave,
}: {
  book: Book;
  log?: ReadingLog;
  todayKey: string;
  onClose: () => void;
  onSave: (payload: Partial<ReadingLog>) => void;
}) {
  const [pages, setPages] = useState(log ? String(log.pages) : "");
  const [minutes, setMinutes] = useState(
    log?.minutes ? String(log.minutes) : "",
  );
  const [date, setDate] = useState(log?.date ?? todayKey);
  const [note, setNote] = useState(log?.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!pages) return;
    setSaving(true);
    onSave({
      id: log?.id,
      bookId: book.id,
      date,
      pages: Number(pages),
      minutes: minutes ? Number(minutes) : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Overlay onClose={onClose}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        {book.title}
      </p>
      <h3 className="mt-1 text-lg font-semibold">
        {log ? "Yozuvni tahrirlash" : "Bugun necha bet o'qidingiz?"}
      </h3>
      <div className="mt-4 space-y-4">
        <div className="flex gap-3">
          <Field label="Bet soni" className="flex-1">
            <input
              value={pages}
              onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoFocus
              placeholder="25"
              className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
            />
          </Field>
          <Field label="Vaqt (daq, ixtiyoriy)" className="flex-1">
            <input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="30"
              className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
            />
          </Field>
        </div>
        <Field label="Sana">
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
          />
        </Field>
        <Field label="Izoh (ixtiyoriy)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Nima esda qoldi?"
            className="w-full resize-none rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
          />
        </Field>
        <button
          onClick={save}
          disabled={saving || !pages}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- Tugatish (baho + taqriz) ---------- */
function FinishModal({
  book,
  onClose,
  onSave,
}: {
  book: Book;
  onClose: () => void;
  onSave: (rating: number, review: string) => void;
}) {
  const [rating, setRating] = useState(book.rating ?? 0);
  const [review, setReview] = useState(book.review ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold">🏁 “{book.title}” tugatildi!</h3>
      <p className="mt-1 text-sm text-muted">Bahoyingiz va fikringiz?</p>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 py-4">
          <StarPicker value={rating} onChange={setRating} />
          <span className="text-xs text-muted">
            {rating ? `${rating}/5` : "yulduz tanlang"}
          </span>
        </div>
        <Field label="Qisqa taqriz (ixtiyoriy)">
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            placeholder="Kitob haqida fikringiz…"
            className="w-full resize-none rounded-lg border border-border-soft bg-card px-3 py-2.5 text-base outline-none focus:border-strong"
          />
        </Field>
        <button
          onClick={() => {
            setSaving(true);
            onSave(rating || 5, review.trim());
          }}
          disabled={saving}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash 🎉"}
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- Login ---------- */
function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (res.ok) onSuccess();
    else setError("PIN noto'g'ri");
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold">Egasi sifatida kirish</h3>
      <p className="mt-1 text-sm text-muted">
        O&apos;qishni belgilash uchun PIN kiriting.
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="PIN"
        className="mt-4 w-full rounded-lg border border-border-soft bg-card px-3 py-2.5 text-sm outline-none focus:border-strong"
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !pin}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95 disabled:opacity-40"
      >
        {busy ? "Tekshirilmoqda…" : "Kirish"}
      </button>
    </Overlay>
  );
}

/* ---------- Sozlamalar ---------- */
function SettingsModal({
  config,
  hasAvatar,
  onChangeAvatar,
  onRemoveAvatar,
  onClose,
  onSaved,
}: {
  config: Config;
  hasAvatar: boolean;
  onChangeAvatar: () => void;
  onRemoveAvatar: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [goal, setGoal] = useState(config.dailyGoal);
  const [name, setName] = useState(config.ownerName);
  const [notifOn, setNotifOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const canNotify = pushSupported();

  useEffect(() => {
    getSubscription().then((s) => setNotifOn(!!s));
  }, []);

  const toggleNotif = async () => {
    setNotifBusy(true);
    try {
      if (notifOn) {
        await disablePush();
        setNotifOn(false);
      } else {
        const ok = await enablePush();
        setNotifOn(ok);
        if (!ok) alert("Bildirishnomaga ruxsat berilmadi.");
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const save = async () => {
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyGoal: goal, ownerName: name }),
    });
    onSaved();
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold">Sozlamalar</h3>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Profil rasmi
          </label>
          <div className="flex gap-2">
            <button
              onClick={onChangeAvatar}
              className="flex-1 rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium transition hover:border-strong"
            >
              📷 Rasm tanlash
            </button>
            {hasAvatar && (
              <button
                onClick={onRemoveAvatar}
                className="rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-500"
              >
                O&apos;chirish
              </button>
            )}
          </div>
        </div>
        <Field label="Ism">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border-soft bg-card px-3 py-2 text-sm outline-none focus:border-strong"
          />
        </Field>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Kunlik maqsad: {goal} bet
          </label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-full accent-neutral-500"
          />
        </div>
        {canNotify && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Eslatma (bildirishnoma)
            </label>
            <button
              onClick={toggleNotif}
              disabled={notifBusy}
              className={[
                "w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
                notifOn
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border-soft hover:border-strong",
              ].join(" ")}
            >
              {notifBusy
                ? "..."
                : notifOn
                  ? "🔔 Eslatma yoqilgan (o'chirish)"
                  : "🔕 Eslatmani yoqish"}
            </button>
            <p className="mt-1 text-[11px] text-muted">
              Kunlik maqsadga yetmasangiz, kuniga bir marta eslatib turadi.
              (iPhone&apos;da avval ilovani ekranga o&apos;rnating.)
            </p>
          </div>
        )}
        <button
          onClick={save}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95"
        >
          Saqlash
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- Yordamchi maydon ---------- */
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------- Umumiy overlay ---------- */
function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="sheet-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border-soft bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-h-[88vh] sm:rounded-3xl sm:p-6 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

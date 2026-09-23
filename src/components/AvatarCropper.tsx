"use client";

import { useEffect, useRef, useState } from "react";

const FRAME = 260; // kesish oynasi (px)
const OUT = 320; // chiqadigan rasm o'lchami (px)

interface Props {
  src: string; // tanlangan rasm (dataURL)
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
  saving?: boolean;
}

// Dumaloq avatar uchun surib/kattalashtirib kesish oynasi (mobil + sichqoncha).
export default function AvatarCropper({ src, onCancel, onSave, saving }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const cover = FRAME / Math.min(nat.w, nat.h);
  const dispW = nat.w * cover * scale;
  const dispH = nat.h * cover * scale;

  const clamp = (o: { x: number; y: number }, w = dispW, h = dispH) => ({
    x: Math.min(0, Math.max(FRAME - w, o.x)),
    y: Math.min(0, Math.max(FRAME - h, o.y)),
  });

  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setNat({ w: im.naturalWidth, h: im.naturalHeight });
      const c = FRAME / Math.min(im.naturalWidth, im.naturalHeight);
      const w = im.naturalWidth * c;
      const h = im.naturalHeight * c;
      setOff({ x: (FRAME - w) / 2, y: (FRAME - h) / 2 });
      setScale(1);
      setError(false);
    };
    im.onerror = () => setError(true);
    im.src = src;
  }, [src]);

  const applyScale = (ns: number) => {
    const oldW = nat.w * cover * scale;
    const oldH = nat.h * cover * scale;
    const newW = nat.w * cover * ns;
    const newH = nat.h * cover * ns;
    const cx = FRAME / 2;
    const nx = cx - (cx - off.x) * (newW / oldW);
    const ny = cx - (cx - off.y) * (newH / oldH);
    setScale(ns);
    setOff(clamp({ x: nx, y: ny }, newW, newH));
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setOff(clamp({ x: drag.current.ox + dx, y: drag.current.oy + dy }));
  };
  const onUp = () => {
    drag.current = null;
  };

  const save = () => {
    if (!img) return;
    const dScale = cover * scale;
    const srcSize = FRAME / dScale;
    const srcX = -off.x / dScale;
    const srcY = -off.y / dScale;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
    onSave(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div
      className="overlay-in fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="sheet-in w-full max-w-sm rounded-3xl bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold">Rasmni moslang</h3>
        <p className="mb-4 text-xs text-muted">
          Surib joylashtiring, kattalashtiring — yuzingiz to&apos;liq tushsin.
        </p>

        {error ? (
          <p className="py-8 text-center text-sm text-red-500">
            Rasmni ochib bo&apos;lmadi. Boshqa rasm tanlang.
          </p>
        ) : (
          <>
            <div className="mx-auto" style={{ width: FRAME }}>
              <div
                className="relative overflow-hidden rounded-full border-2 border-border-soft bg-surface-2"
                style={{ width: FRAME, height: FRAME, touchAction: "none" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute select-none"
                    style={{
                      width: dispW,
                      height: dispH,
                      left: off.x,
                      top: off.y,
                      maxWidth: "none",
                    }}
                  />
                )}
                <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.04)]" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-muted">➖</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={scale}
                  onChange={(e) => applyScale(Number(e.target.value))}
                  className="w-full accent-neutral-500"
                />
                <span className="text-xs text-muted">➕</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-xl border border-border-soft px-4 py-3 text-sm font-medium text-muted transition hover:border-strong"
              >
                Bekor
              </button>
              <button
                onClick={save}
                disabled={saving || !img}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

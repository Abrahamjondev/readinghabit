import { cookies } from "next/headers";
import { createHash } from "crypto";

/**
 * Oddiy egasi (owner) autentifikatsiyasi.
 * - OWNER_PIN env: siz kiritadigan maxfiy PIN.
 * - Login qilinganda httpOnly cookie o'rnatiladi (token = hash(PIN + SECRET)).
 * - O'zgartirish (POST/DELETE) so'rovlarida shu cookie tekshiriladi.
 * Boshqalar PIN'ni bilmaydi -> faqat ko'ra oladi, o'zgartira olmaydi.
 */

const COOKIE_NAME = "kitob_owner";

function ownerPin(): string {
  return process.env.OWNER_PIN || "1234"; // dev uchun standart; Vercel'da o'zgartiring
}

function secret(): string {
  return process.env.AUTH_SECRET || "dev-secret-change-me";
}

export function expectedToken(): string {
  return createHash("sha256")
    .update(ownerPin() + ":" + secret())
    .digest("hex");
}

export function checkPin(pin: string): boolean {
  return pin === ownerPin();
}

export async function setOwnerCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 yil
  });
}

export async function clearOwnerCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isOwner(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return !!token && token === expectedToken();
}

# Kitob Davomat 📚

Shaxsiy kitob o'qish kundaligi. **Hamma ko'ra oladi**, lekin **faqat egasi** (PIN bilan) belgilay oladi.

## Qanday ishlaydi
1. Kitob qo'shasiz — nomi, muallifi va **jami bet sonini** yozasiz.
2. Har kuni "bugun **N bet** o'qidim" deb belgilaysiz (ixtiyoriy: qancha vaqt + izoh).
3. Dastur avtomatik hisoblaydi: **o'qilgan**, **qolgan bet**, **necha foiz**.
4. Kitob to'liq o'qilganda avtomatik "tugatilgan"ga o'tadi — **baho (yulduz) + taqriz** qo'yasiz.

## Xususiyatlar
- Har kitob uchun progress bar (o'qilgan / qolgan / %)
- **Kunlik bet maqsadi** + progress halqasi
- **O'qish streak'i** (ketma-ket o'qigan kunlar) + eng uzun streak
- Yillik **o'qish heatmap'i** (betlar soniga qarab quyuqlik)
- Statistika: bu yil/jami tugatilgan kitoblar, o'qilgan betlar, o'rtacha bet/kun, jami vaqt
- Nishonlar (1 / 3 / 5 / 10 / 25 kitob)
- Tugatganda **baho + taqriz**, har kitobga **sevimli iqtiboslar** (bet raqami bilan)
- Kunlik eslatma (push-bildirishnoma), confetti animatsiyasi
- Mehmonlar faqat ko'radi — hech narsani o'zgartira olmaydi

## Texnologiya
Next.js 16 (App Router) · React 19 · Tailwind v4 · Upstash Redis

## Lokal ishga tushirish
```bash
npm install
node scripts/seed.mjs   # namuna ma'lumot (ixtiyoriy)
npm run dev
```
`.env.local` da `OWNER_PIN` ni o'zgartiring. Upstash sozlanmagan bo'lsa, ma'lumot lokal `.data/db.json` ga yoziladi.

## Vercel'ga deploy
1. Loyihani GitHub'ga push qiling.
2. [vercel.com](https://vercel.com) da "New Project" → repozitoriyni tanlang.
3. [Upstash](https://console.upstash.com) da bepul Redis bazasi oching → REST URL va TOKEN oling.
4. Vercel'da **Environment Variables** ga qo'shing:
   - `OWNER_PIN` — maxfiy PIN
   - `AUTH_SECRET` — uzun tasodifiy satr
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - (ixtiyoriy) push uchun: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`
5. Deploy. Tayyor!

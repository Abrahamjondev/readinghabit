// Kitobxonlik haqidagi iqtiboslar (o'zbekcha). Kuniga bittasi ko'rsatiladi.
export const QUOTES: string[] = [
  "Bugun o'qigan bir bet — ertangi bir fikr.",
  "Kitob o'qigan odam ming hayot yashaydi.",
  "Har kun bir necha bet — bir yilda o'nlab kitob.",
  "Kitob — eng sabrli ustoz.",
  "Ozgina, lekin har kuni. Sir shu.",
  "O'qigan sari dunyoning kengayadi.",
  "Kitob javondagi eng arzon sayohat.",
  "Bugun boshlagan kitobing — kelajakdagi o'zgaring.",
  "Bilim to'plagan boylik hech qachon tugamaydi.",
  "Bir bet ham — bet emasdan yaxshi.",
  "Sekin o'qigan tez tushunadi.",
  "Kitob yopilganda ham fikr davom etadi.",
];

// Kunning indeksiga qarab barqaror iqtibos tanlaydi (har kuni bir xil).
export function quoteOfDay(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

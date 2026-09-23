// PWA ikonkalarini SVG'dan PNG'ga aylantiradi.
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0a0a0a"/>
  <g fill="#ffffff">
    <rect x="176" y="238" width="160" height="36" rx="10"/>
    <rect x="120" y="206" width="34" height="100" rx="12"/>
    <rect x="150" y="222" width="26" height="68" rx="10"/>
    <rect x="358" y="206" width="34" height="100" rx="12"/>
    <rect x="336" y="222" width="26" height="68" rx="10"/>
  </g>
</svg>`;

const pub = path.join(process.cwd(), "public");
await fs.mkdir(pub, { recursive: true });
const buf = Buffer.from(svg);

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(buf).resize(t.size, t.size).png().toFile(path.join(pub, t.name));
  console.log("yozildi:", t.name);
}
await fs.writeFile(path.join(pub, "icon.svg"), svg, "utf8");
console.log("yozildi: icon.svg");

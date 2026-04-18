import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());
const svg = readFileSync(resolve(ROOT, 'public/icon-512.svg'));

// 1024x1024 icon (solid bg, with 戶)
await sharp(svg, { density: 400 })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(ROOT, 'assets/icon-only.png'));

// foreground: transparent bg, just 戶 — reuse same (has bg, but capacitor layers it)
// Build a foreground-only svg
const fgSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
    <text x="512" y="680" text-anchor="middle" font-family="serif" font-weight="700" font-size="520" fill="#2D2D2D">戶</text>
  </svg>`
);
await sharp(fgSvg, { density: 400 })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(ROOT, 'assets/icon-foreground.png'));

// background: solid color
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: '#F5F1EB' },
})
  .png()
  .toFile(resolve(ROOT, 'assets/icon-background.png'));

// splash 2732x2732
const splashSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="#F5F1EB"/>
    <text x="1366" y="1500" text-anchor="middle" font-family="serif" font-weight="700" font-size="800" fill="#2D2D2D">戶</text>
  </svg>`
);
await sharp(splashSvg, { density: 200 })
  .png()
  .toFile(resolve(ROOT, 'assets/splash.png'));

// splash dark
const splashDarkSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="#2D2D2D"/>
    <text x="1366" y="1500" text-anchor="middle" font-family="serif" font-weight="700" font-size="800" fill="#F5F1EB">戶</text>
  </svg>`
);
await sharp(splashDarkSvg, { density: 200 })
  .png()
  .toFile(resolve(ROOT, 'assets/splash-dark.png'));

console.log('Assets generated in /assets');

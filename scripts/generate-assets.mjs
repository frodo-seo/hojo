import sharp from 'sharp';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());
const BG = '#0A0A0B';
const FG = '#F5B32E';

const iconSvg = (size) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <text x="${size / 2}" y="${size * 0.66}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${size * 0.56}" fill="${FG}" letter-spacing="${-size * 0.02}">H</text>
  </svg>`,
);

await sharp(iconSvg(1024), { density: 400 })
  .png()
  .toFile(resolve(ROOT, 'assets/icon-only.png'));

const fgSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <text x="512" y="680" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="560" fill="${FG}" letter-spacing="-20">H</text>
  </svg>`,
);
await sharp(fgSvg, { density: 400 })
  .png()
  .toFile(resolve(ROOT, 'assets/icon-foreground.png'));

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: BG },
})
  .png()
  .toFile(resolve(ROOT, 'assets/icon-background.png'));

const splashSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="${BG}"/>
    <text x="1366" y="1500" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="860" fill="${FG}" letter-spacing="-30">H</text>
  </svg>`,
);
await sharp(splashSvg, { density: 200 })
  .png()
  .toFile(resolve(ROOT, 'assets/splash.png'));

await sharp(splashSvg, { density: 200 })
  .png()
  .toFile(resolve(ROOT, 'assets/splash-dark.png'));

console.log('Assets generated in /assets');

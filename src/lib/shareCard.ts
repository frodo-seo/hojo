import type { Receipt } from "../types";
import { won } from "./format";

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function drawGradient(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#ff9a3c");
  g.addColorStop(0.5, "#ff7a1a");
  g.addColorStop(1, "#b85c1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawScrim(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, H * 0.25, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.6, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export async function renderShareCard(receipt: Receipt): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");

  // 배경
  if (receipt.photoDataUrl) {
    try {
      const img = await loadImage(receipt.photoDataUrl);
      drawCover(ctx, img, W, H);
      drawScrim(ctx);
    } catch {
      drawGradient(ctx);
    }
  } else {
    drawGradient(ctx);
  }

  // 우상단 배지
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("소비일기", W - 56, 72);

  // 텍스트 블록 (하단 정렬)
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  const leftPad = 72;
  let y = H - 72;

  // 워터마크 문구 (가장 아래)
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("sobi-ilgi.app", leftPad, y);
  y -= 48;

  // 스토리
  if (receipt.story) {
    ctx.font = "italic 500 30px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const story = `"${receipt.story}"`;
    ctx.fillText(story, leftPad, y);
    y -= 64;
  }

  // 인원/1인당
  if (receipt.partySize && receipt.perPerson) {
    ctx.font = "600 36px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffd7b5";
    ctx.fillText(
      `${receipt.partySize}명 · 1인 ${won(receipt.perPerson)}`,
      leftPad,
      y,
    );
    y -= 72;
  }

  // 총액 (큰 글씨)
  ctx.font = "800 104px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(won(receipt.total), leftPad, y);
  y -= 72;

  // 가게 이름
  ctx.font = "700 42px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(receipt.store, leftPad, y);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}

export function buildShareText(receipt: Receipt): string {
  const lines: string[] = [];
  lines.push(`🧾 ${receipt.store}`);
  lines.push(`총 ${won(receipt.total)}`);
  if (receipt.partySize && receipt.perPerson) {
    lines.push(`${receipt.partySize}명 · 1인당 ${won(receipt.perPerson)}`);
  }
  if (receipt.story) lines.push(`"${receipt.story}"`);
  lines.push("— 소비일기");
  return lines.join("\n");
}

export type ShareResult = "shared" | "downloaded" | "failed";

export async function shareReceipt(receipt: Receipt): Promise<ShareResult> {
  const blob = await renderShareCard(receipt);
  const file = new File([blob], `sobi-ilgi-${receipt.id}.png`, {
    type: "image/png",
  });
  const text = buildShareText(receipt);

  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: receipt.store });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "failed";
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    return "downloaded";
  } catch {
    return "failed";
  }
}

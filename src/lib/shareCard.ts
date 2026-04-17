/**
 * 호조 상소문을 두루마리 카드 이미지(PNG)로 생성.
 * 세로 1080x1350 (인스타/스레드 최적), 한지+먹 톤.
 */

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const p of paragraphs) {
    if (p.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const ch of p) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function renderMemorialCard(params: {
  title: string; // 예: "2026년 4월의 상소"
  body: string;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 배경 — 짙은 흑갈 두루마리
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#1A130D");
  bgGrad.addColorStop(1, "#0F0A07");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 두루마리 종이 패널
  const pad = 72;
  const panelX = pad;
  const panelY = pad;
  const panelW = W - pad * 2;
  const panelH = H - pad * 2;

  const paperGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
  paperGrad.addColorStop(0, "#2B2018");
  paperGrad.addColorStop(1, "#221912");
  ctx.fillStyle = paperGrad;
  roundRect(ctx, panelX, panelY, panelW, panelH, 20);
  ctx.fill();

  // 금테
  ctx.strokeStyle = "rgba(178, 122, 74, 0.42)";
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 20);
  ctx.stroke();

  // 상단 戶 뱃지
  const badgeY = panelY + 100;
  ctx.beginPath();
  ctx.arc(W / 2, badgeY, 52, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(178, 122, 74, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(178, 122, 74, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#D49A66";
  ctx.font = '500 56px "Gowun Batang", "Noto Serif KR", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("戶", W / 2, badgeY + 4);

  // 제목
  ctx.fillStyle = "#EFE4CE";
  ctx.font = '700 38px "Gowun Batang", "Noto Serif KR", serif';
  ctx.textAlign = "center";
  ctx.fillText(params.title, W / 2, badgeY + 118);

  // 구분선
  ctx.strokeStyle = "rgba(178, 122, 74, 0.30)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(panelX + 80, badgeY + 168);
  ctx.lineTo(panelX + panelW - 80, badgeY + 168);
  ctx.stroke();
  ctx.setLineDash([]);

  // 본문
  ctx.fillStyle = "#EFE4CE";
  ctx.font = '400 28px "Gowun Batang", "Noto Serif KR", serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const bodyX = panelX + 80;
  const bodyY = badgeY + 210;
  const bodyMaxW = panelW - 160;
  const lineH = 48;
  const lines = wrap(ctx, params.body, bodyMaxW);
  const maxLines = Math.floor((panelH - (bodyY - panelY) - 140) / lineH);
  const shown = lines.slice(0, maxLines);
  shown.forEach((ln, i) => {
    ctx.fillText(ln, bodyX, bodyY + i * lineH);
  });

  // 하단 낙관 (낙장)
  const sealSize = 76;
  const sealX = W - pad - 80 - sealSize;
  const sealY = H - pad - 80 - sealSize;
  ctx.fillStyle = "#8C3A2E";
  roundRect(ctx, sealX, sealY, sealSize, sealSize, 6);
  ctx.fill();
  ctx.fillStyle = "#F2E9D8";
  ctx.font = '700 40px "Gowun Batang", "Noto Serif KR", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("戶", sealX + sealSize / 2, sealY + sealSize / 2 + 2);

  // 푸터 서명
  ctx.fillStyle = "rgba(239, 228, 206, 0.52)";
  ctx.font = '500 20px "Gowun Batang", "Noto Serif KR", serif';
  ctx.textAlign = "left";
  ctx.fillText("소신, 삼가 올리옵나이다. — 호조(戶曹)", panelX + 80, H - pad - 70);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png", 0.95);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function shareMemorial(params: {
  title: string;
  body: string;
  filename?: string;
}) {
  const blob = await renderMemorialCard(params);
  if (!blob) return;
  const file = new File(
    [blob],
    params.filename ?? "hojo-memorial.png",
    { type: "image/png" },
  );

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: params.title });
      return;
    } catch {
      // fallthrough to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

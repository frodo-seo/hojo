import { httpJson, httpMultipart } from "./http";
import { currentLang } from "./i18n";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

function cleanOcr(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([*_~`])/g, "$1")
    .replace(/\|[-:]+\|[-:|\s]*/g, "")
    .replace(/\|/g, " ")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .trim();
}

/** Chandra 2 OCR → 정리된 텍스트. 모든 파서·분류기의 공통 진입점. */
export async function runOcr(
  base64: string,
  mediaType: string,
  datalabKey: string,
): Promise<string> {
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const initRes = await httpMultipart<{
    request_check_url?: string;
    status?: string;
    markdown?: string;
  }>(
    "https://www.datalab.to/api/v1/convert",
    {
      file: { base64, mediaType, filename: `scan.${ext}` },
      output_format: "markdown",
      mode: "accurate",
    },
    { "X-API-Key": datalabKey },
  );
  if (!initRes.ok) {
    throw new Error(msg(`OCR 요청 실패 (${initRes.status})`, `OCR request failed (${initRes.status})`));
  }

  let data = initRes.data;
  if (data.request_check_url && data.status !== "complete") {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await httpJson<{ status?: string; markdown?: string }>(
        data.request_check_url,
        { method: "GET", headers: { "X-API-Key": datalabKey } },
      );
      if (!poll.ok) throw new Error(msg(`OCR 조회 실패 (${poll.status})`, `OCR poll failed (${poll.status})`));
      if (poll.data.status === "complete") {
        data = poll.data;
        break;
      }
      if (poll.data.status === "failed") {
        throw new Error(msg("OCR 처리에 실패했습니다", "OCR processing failed"));
      }
    }
  }

  const raw = data.markdown || "";
  if (!raw) throw new Error(msg(
    "글자를 읽지 못했습니다. 더 밝고 또렷한 사진으로 다시 시도해주세요.",
    "Couldn't read any text. Try a brighter, sharper photo.",
  ));
  return cleanOcr(raw);
}

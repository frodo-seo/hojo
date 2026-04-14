type OcrSubmit = {
  success: boolean;
  error: string | null;
  request_id: string;
  request_check_url: string;
};

type OcrLine = { text: string };
type OcrPage = { text_lines?: OcrLine[] };

type OcrFinal = {
  status: string;
  success: boolean;
  error: string | null;
  pages?: OcrPage[];
};

const DEFAULT_URL = "https://www.datalab.to/api/v1";

export async function runChandraOcr(
  imageBase64: string,
  mediaType: string,
): Promise<string> {
  const apiKey = process.env.DATALAB_API_KEY ?? process.env.CHANDRA_API_KEY;
  const base = process.env.DATALAB_API_URL ?? DEFAULT_URL;
  if (!apiKey) throw new Error("DATALAB_API_KEY missing");

  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mediaType });
  const form = new FormData();
  form.append("file", blob, "receipt.jpg");

  const submitRes = await fetch(`${base}/ocr`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  });
  if (!submitRes.ok) {
    throw new Error(`Datalab submit ${submitRes.status}: ${await submitRes.text()}`);
  }
  const submit = (await submitRes.json()) as OcrSubmit;
  if (!submit.success || !submit.request_check_url) {
    throw new Error(`Datalab submit failed: ${submit.error ?? "unknown"}`);
  }

  const deadline = Date.now() + 60_000;
  let delay = 600;
  while (Date.now() < deadline) {
    await sleep(delay);
    const pollRes = await fetch(submit.request_check_url, {
      headers: { "X-API-Key": apiKey },
    });
    if (!pollRes.ok) {
      throw new Error(`Datalab poll ${pollRes.status}: ${await pollRes.text()}`);
    }
    const final = (await pollRes.json()) as OcrFinal;
    if (final.status === "complete") {
      if (!final.success) throw new Error(final.error ?? "ocr failed");
      return flattenPages(final.pages ?? []);
    }
    delay = Math.min(delay + 300, 1500);
  }
  throw new Error("Datalab OCR timeout");
}

function flattenPages(pages: OcrPage[]): string {
  return pages
    .map((p) => (p.text_lines ?? []).map((l) => l.text).join("\n"))
    .join("\n---\n")
    .trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

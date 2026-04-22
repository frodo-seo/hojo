/**
 * 이미지 유틸 + 공용 에러.
 * 장부 파싱은 ./ledger.ts, 자산은 ./assetParse.ts.
 */

/** 이미지를 최대 1280px로 리사이즈 후 base64 반환 */
export function compressImage(
  file: File,
  maxSize = 1280,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export class ApiKeyMissingError extends Error {
  which: "anthropic" | "datalab" | "both";
  constructor(which: "anthropic" | "datalab" | "both") {
    super("API key missing");
    this.name = "ApiKeyMissingError";
    this.which = which;
  }
}

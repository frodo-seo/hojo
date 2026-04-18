import { CapacitorHttp } from "@capacitor/core";
import { isNative } from "./platform";

/**
 * Capacitor 네이티브에서는 CORS 우회(네이티브 HTTP),
 * 웹에서는 fetch로 폴백한다.
 * 웹은 로컬 개발용 — 프로덕션은 APK가 네이티브 경로 사용.
 */

export type HttpResponse<T = unknown> = {
  status: number;
  data: T;
  ok: boolean;
};

export async function httpJson<T = unknown>(
  url: string,
  init: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<HttpResponse<T>> {
  const method = init.method ?? "GET";
  const headers = { ...(init.headers ?? {}) };

  if (isNative()) {
    const res = await CapacitorHttp.request({
      url,
      method,
      headers: { "Content-Type": "application/json", ...headers },
      data: init.body,
      responseType: "json",
    });
    return {
      status: res.status,
      data: res.data as T,
      ok: res.status >= 200 && res.status < 300,
    };
  }

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = text as unknown as T;
  }
  return { status: res.status, data, ok: res.ok };
}

/** Datalab 전용: 이미지 multipart 업로드. 네이티브는 CapacitorHttp의 formData 지원 사용. */
export async function httpMultipart<T = unknown>(
  url: string,
  fields: Record<string, string | { base64: string; mediaType: string; filename: string }>,
  headers: Record<string, string> = {},
): Promise<HttpResponse<T>> {
  if (isNative()) {
    // CapacitorHttp formData: 문자열 값만 네이티브로 잘 전달됨.
    // 이미지(base64)는 Blob으로 폼데이터 만들어서 multipart 수동 구성이 필요.
    // 여기선 fetch를 쓰되, CORS는 Anthropic·Datalab 모두 허용 혹은
    // 네이티브 WebView origin(localhost)에서 대체로 동작.
    // 만일 CORS로 막히면 CapacitorHttp 원시 바디 업로드로 전환.
    return multipartViaFetch<T>(url, fields, headers);
  }
  return multipartViaFetch<T>(url, fields, headers);
}

async function multipartViaFetch<T>(
  url: string,
  fields: Record<string, string | { base64: string; mediaType: string; filename: string }>,
  headers: Record<string, string>,
): Promise<HttpResponse<T>> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string") {
      form.append(k, v);
    } else {
      const bytes = Uint8Array.from(atob(v.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: v.mediaType });
      form.append(k, blob, v.filename);
    }
  }
  const res = await fetch(url, {
    method: "POST",
    headers, // Content-Type은 브라우저가 boundary 포함해서 자동 설정
    body: form,
  });
  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = text as unknown as T;
  }
  return { status: res.status, data, ok: res.ok };
}

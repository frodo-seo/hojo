export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });

export const badRequest = (message: string) =>
  json({ error: message }, { status: 400 });

export const serverError = (message: string) =>
  json({ error: message }, { status: 500 });

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

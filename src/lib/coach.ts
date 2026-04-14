import { supabase } from "./supabase";
import { ensureSession } from "./auth";
import { logUsage, type ClaudeUsage } from "./usage";

export async function askCoach(question: string): Promise<string> {
  if (!supabase) throw new Error("Supabase 설정이 없어요");
  await ensureSession();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요해요");

  const res = await fetch("/api/coach", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`coach ${res.status}: ${text}`);
  }

  const payload = (await res.json()) as {
    answer: string;
    _usage?: ClaudeUsage;
  };
  if (payload._usage) logUsage("coach", payload._usage);
  return payload.answer;
}

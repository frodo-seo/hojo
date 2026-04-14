import { supabase } from "./supabase";

export async function getSession() {
  if (!supabase) throw new Error("Supabase 설정이 없어요");
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function ensureSession(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("로그인이 필요해요");
  return session.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error("Supabase 설정이 없어요");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) throw new Error("Supabase 설정이 없어요");
  await supabase.auth.signOut();
}

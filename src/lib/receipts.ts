import type { Receipt, ReceiptItem } from "../types";
import { ensureSession } from "./auth";
import { supabase } from "./supabase";

type Row = {
  id: string;
  user_id: string;
  store: string;
  date: string;
  total: number;
  items: ReceiptItem[];
  photo_url: string | null;
  photo_kind: Receipt["photoKind"];
  mode: Receipt["mode"];
  story: string | null;
  tags: string[] | null;
  insight: string | null;
  party_size: number | null;
  per_person: number | null;
  created_at: string;
};

const rowToReceipt = (r: Row): Receipt => ({
  id: r.id,
  store: r.store,
  date: r.date,
  total: r.total,
  items: r.items ?? [],
  photoDataUrl: r.photo_url ?? undefined,
  photoKind: r.photo_kind,
  mode: r.mode,
  story: r.story ?? undefined,
  tags: r.tags ?? undefined,
  insight: r.insight ?? undefined,
  partySize: r.party_size ?? undefined,
  perPerson: r.per_person ?? undefined,
  createdAt: r.created_at,
});

const receiptToRow = (r: Receipt, userId: string, photoUrl?: string) => ({
  id: r.id,
  user_id: userId,
  store: r.store,
  date: r.date,
  total: r.total,
  items: r.items,
  photo_url: photoUrl ?? null,
  photo_kind: r.photoKind,
  mode: r.mode,
  story: r.story ?? null,
  tags: r.tags ?? null,
  insight: r.insight ?? null,
  party_size: r.partySize ?? null,
  per_person: r.perPerson ?? null,
  created_at: r.createdAt,
});

export async function listReceipts(): Promise<Receipt[]> {
  if (!supabase) return [];
  await ensureSession();
  const { data, error } = await supabase
    .from("receipts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(rowToReceipt);
}

export async function insertReceipt(
  receipt: Receipt,
  photoUrl?: string,
): Promise<Receipt> {
  if (!supabase) throw new Error("Supabase not configured");
  const userId = await ensureSession();
  const row = receiptToRow(receipt, userId, photoUrl);
  const { data, error } = await supabase
    .from("receipts")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToReceipt(data as Row);
}

export async function uploadReceiptPhoto(
  dataUrl: string,
  mediaType: string,
): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const userId = await ensureSession();

  const base64 = dataUrl.split(",")[1] ?? dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ext = mediaType.split("/")[1] ?? "jpg";
  const filename = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("receipt-photos")
    .upload(filename, bytes, { contentType: mediaType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("receipt-photos").getPublicUrl(filename);
  return data.publicUrl;
}

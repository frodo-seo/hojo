export type Mode = "daily" | "memory" | "settle";

export type PhotoKind = "none" | "food" | "place" | "group" | "other";

export type Category = { major: string; minor: string };

export type ReceiptItem = {
  name: string;
  price: number;
  category?: Category;
};

export type Receipt = {
  id: string;
  store: string;
  date: string;
  total: number;
  items: ReceiptItem[];
  photoDataUrl?: string;
  photoKind: PhotoKind;
  mode: Mode;
  story?: string;
  tags?: string[];
  insight?: string;
  partySize?: number;
  perPerson?: number;
  createdAt: string;
};

import type { Mode, PhotoKind, Receipt, ReceiptItem } from "../types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sampleReceipts: Array<{
  store: string;
  items: ReceiptItem[];
}> = [
  {
    store: "GS25 역삼점",
    items: [
      { name: "새우깡", price: 1500, category: { major: "식비", minor: "간식" } },
      { name: "삼각김밥 참치", price: 1200, category: { major: "식비", minor: "식사대용" } },
      { name: "포카리스웨트 600ml", price: 2200, category: { major: "식비", minor: "음료" } },
    ],
  },
  {
    store: "이마트 성수점",
    items: [
      { name: "한돈 삼겹살 500g", price: 13900, category: { major: "식비", minor: "식재료" } },
      { name: "상추 한봉", price: 2980, category: { major: "식비", minor: "식재료" } },
      { name: "햇반 12입", price: 9900, category: { major: "식비", minor: "식재료" } },
      { name: "물티슈 100매", price: 3500, category: { major: "생활", minor: "생필품" } },
    ],
  },
  {
    store: "골목 라멘",
    items: [
      { name: "차슈라멘", price: 11000, category: { major: "식비", minor: "외식" } },
      { name: "교자 5p", price: 4500, category: { major: "식비", minor: "외식" } },
    ],
  },
  {
    store: "왕십리 숯불갈비",
    items: [
      { name: "삼겹살 3인분", price: 42000, category: { major: "식비", minor: "외식" } },
      { name: "된장찌개", price: 7000, category: { major: "식비", minor: "외식" } },
      { name: "참이슬 2병", price: 10000, category: { major: "식비", minor: "주류" } },
      { name: "공기밥 3", price: 3000, category: { major: "식비", minor: "외식" } },
    ],
  },
];

const sum = (items: ReceiptItem[]) => items.reduce((a, b) => a + b.price, 0);

export type MockOcrResult = {
  store: string;
  date: string;
  items: ReceiptItem[];
  total: number;
};

export async function mockOcr(): Promise<MockOcrResult> {
  await wait(900);
  const pick = sampleReceipts[Math.floor(Math.random() * sampleReceipts.length)];
  return {
    store: pick.store,
    date: new Date().toISOString(),
    items: pick.items,
    total: sum(pick.items),
  };
}

export async function mockClassifyPhoto(file?: File): Promise<PhotoKind> {
  if (!file) return "none";
  await wait(600);
  const kinds: PhotoKind[] = ["food", "place", "group"];
  return kinds[Math.floor(Math.random() * kinds.length)];
}

export function decideMode(kind: PhotoKind): Mode {
  if (kind === "group") return "settle";
  if (kind === "food" || kind === "place") return "memory";
  return "daily";
}

export async function mockAnalyze(
  ocr: MockOcrResult,
  kind: PhotoKind,
  photoDataUrl?: string,
): Promise<Receipt> {
  await wait(700);
  const mode = decideMode(kind);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const base: Receipt = {
    id,
    store: ocr.store,
    date: ocr.date,
    total: ocr.total,
    items: ocr.items,
    photoDataUrl,
    photoKind: kind,
    mode,
    createdAt,
  };

  if (mode === "daily") {
    return {
      ...base,
      tags: ["#편의점", "#야식"],
      insight: "이번 주 편의점 지출이 지난주보다 8,000원 줄었어요 👍",
    };
  }
  if (mode === "memory") {
    return {
      ...base,
      story: "화요일 점심, 골목 끝 라멘 한 그릇의 위로",
      tags: ["#혼밥", "#라멘", "#점심맛집"],
    };
  }
  const partySize = 5;
  return {
    ...base,
    partySize,
    perPerson: Math.round(ocr.total / partySize),
    story: "금요일 밤, 다섯 명의 삼겹살 동맹",
    tags: ["#회식", "#금요일밤"],
  };
}

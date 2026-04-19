import type { Transaction, Budget, FixedIncome, FixedExpense, Asset } from "../types";

const DB_NAME = "sobi-ilgi";
const DB_VERSION = 5;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("categoryId", "categoryId", { unique: false });
      }
      if (!db.objectStoreNames.contains("budgets")) {
        db.createObjectStore("budgets", { keyPath: "month" });
      }
      if (!db.objectStoreNames.contains("wiki")) {
        db.createObjectStore("wiki", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("fixed_income")) {
        db.createObjectStore("fixed_income", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("fixed_expense")) {
        db.createObjectStore("fixed_expense", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("assets")) {
        db.createObjectStore("assets", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return open().then(
    (db) => db.transaction(storeName, mode).objectStore(storeName),
  );
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// --- Transactions ---

export async function addTransaction(t: Transaction): Promise<void> {
  const store = await tx("transactions", "readwrite");
  await req(store.put(t));
}

export async function updateTransaction(t: Transaction): Promise<void> {
  const store = await tx("transactions", "readwrite");
  await req(store.put(t));
}

export async function deleteTransaction(id: string): Promise<void> {
  const store = await tx("transactions", "readwrite");
  await req(store.delete(id));
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const store = await tx("transactions", "readonly");
  const all = await req(store.getAll());
  return all.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
}

export async function getTransactionsByMonth(
  month: string,
): Promise<Transaction[]> {
  const all = await getAllTransactions();
  return all.filter((t) => t.date.startsWith(month));
}

// --- Budgets ---

export async function getBudget(month: string): Promise<Budget | undefined> {
  const store = await tx("budgets", "readonly");
  const result = await req(store.get(month));
  return result ?? undefined;
}

export async function setBudget(month: string, amount: number): Promise<void> {
  const store = await tx("budgets", "readwrite");
  await req(store.put({ month, amount }));
}

export async function deleteBudget(month: string): Promise<void> {
  const store = await tx("budgets", "readwrite");
  await req(store.delete(month));
}

// --- Wiki ---

export interface WikiPage {
  key: string;
  content: string;
  updatedAt: string;
  dirty: boolean;
}

export async function getWikiPage(key: string): Promise<WikiPage | undefined> {
  const store = await tx("wiki", "readonly");
  const result = await req(store.get(key));
  return result ?? undefined;
}

export async function setWikiPage(page: WikiPage): Promise<void> {
  const store = await tx("wiki", "readwrite");
  await req(store.put(page));
}

// --- Fixed Income ---

export async function getFixedIncomes(): Promise<FixedIncome[]> {
  const store = await tx("fixed_income", "readonly");
  return req(store.getAll());
}

export async function addFixedIncome(item: FixedIncome): Promise<void> {
  const store = await tx("fixed_income", "readwrite");
  await req(store.put(item));
}

export async function deleteFixedIncome(id: string): Promise<void> {
  const store = await tx("fixed_income", "readwrite");
  await req(store.delete(id));
}

// --- Fixed Expense ---

export async function getFixedExpenses(): Promise<FixedExpense[]> {
  const store = await tx("fixed_expense", "readonly");
  return req(store.getAll());
}

export async function addFixedExpense(item: FixedExpense): Promise<void> {
  const store = await tx("fixed_expense", "readwrite");
  await req(store.put(item));
}

export async function deleteFixedExpense(id: string): Promise<void> {
  const store = await tx("fixed_expense", "readwrite");
  await req(store.delete(id));
}

// --- Assets ---

export async function getAssets(): Promise<Asset[]> {
  const store = await tx("assets", "readonly");
  const list = await req(store.getAll());
  return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function addAsset(asset: Asset): Promise<void> {
  const store = await tx("assets", "readwrite");
  await req(store.put(asset));
}

export async function updateAsset(asset: Asset): Promise<void> {
  const store = await tx("assets", "readwrite");
  await req(store.put(asset));
}

export async function deleteAsset(id: string): Promise<void> {
  const store = await tx("assets", "readwrite");
  await req(store.delete(id));
}

/**
 * 해당 월의 고정지출을 지정일 기준으로 반영.
 * - 과거 월: 전부 반영
 * - 현재 월: 오늘 날짜 >= 지출 지정일인 항목만 반영
 * - 미래 월: 반영 안 함
 * 항목별로 반영 여부를 wiki 키로 기록해 중복 반영 방지.
 */
export async function applyFixedExpenses(month: string): Promise<boolean> {
  const expenses = await getFixedExpenses();
  if (expenses.length === 0) return false;

  const now = new Date();
  const todayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayDay = now.getDate();

  let anyApplied = false;

  for (const exp of expenses) {
    const appliedKey = `fixed_exp_${exp.id}_${month}`;
    const wikiRead = await tx("wiki", "readonly");
    const already = await req(wikiRead.get(appliedKey));
    if (already) continue;

    // 해당 월의 마지막 날 (day 31 선택 시 2월엔 28/29로 자동 clamp)
    const [yStr, mStr] = month.split("-");
    const lastDayOfMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
    const effectiveDay = Math.min(Math.max(exp.day, 1), lastDayOfMonth);

    let shouldApply = false;
    if (month < todayMonth) shouldApply = true;
    else if (month === todayMonth && todayDay >= effectiveDay) shouldApply = true;

    if (!shouldApply) continue;

    const day = String(effectiveDay).padStart(2, "0");
    const date = `${month}-${day}`;

    const transaction: Transaction = {
      id: `fixed_exp_${exp.id}_${month}`,
      type: "expense",
      amount: exp.amount,
      categoryId: exp.categoryId,
      memo: `[고정] ${exp.name}`,
      date,
      createdAt: new Date().toISOString(),
    };
    const txStore = await tx("transactions", "readwrite");
    await req(txStore.put(transaction));

    const wikiWrite = await tx("wiki", "readwrite");
    await req(wikiWrite.put({
      key: appliedKey,
      content: "applied",
      updatedAt: new Date().toISOString(),
      dirty: false,
    }));
    anyApplied = true;
  }

  return anyApplied;
}

/** 해당 월에 고정수입이 이미 반영됐는지 확인하고, 안 됐으면 반영 */
export async function applyFixedIncomes(month: string): Promise<boolean> {
  const key = `fixed_applied_${month}`;
  const wiki = await tx("wiki", "readonly");
  const applied = await req(wiki.get(key));
  if (applied) return false; // 이미 반영됨

  const incomes = await getFixedIncomes();
  if (incomes.length === 0) return false;

  const [y, m] = month.split("-");
  const date = `${y}-${m}-01`;

  for (const inc of incomes) {
    const transaction: Transaction = {
      id: `fixed_${inc.id}_${month}`,
      type: "income",
      amount: inc.amount,
      categoryId: inc.categoryId,
      memo: `[고정] ${inc.name}`,
      date,
      createdAt: new Date().toISOString(),
    };
    const txStore = await tx("transactions", "readwrite");
    await req(txStore.put(transaction));
  }

  // 반영 완료 표시
  const wikiStore = await tx("wiki", "readwrite");
  await req(wikiStore.put({ key, content: "applied", updatedAt: new Date().toISOString(), dirty: false }));
  return true;
}


import { useEffect, useState } from "react";
import {
  getBudget, setBudget, deleteBudget,
  getFixedIncomes, addFixedIncome, deleteFixedIncome,
  getFixedExpenses, addFixedExpense, deleteFixedExpense,
  getAllTransactions,
} from "../lib/db";
import type { FixedIncome, FixedExpense } from "../types";
import { currentMonth, formatMoney, getMonthLabel, formatAmountInput, parseAmountInput, amountKoreanHint } from "../lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, getCategoryById } from "../lib/categories";
import { isReminderEnabled, enableReminder, disableReminder } from "../lib/reminder";

type Props = { refresh: number; onRefresh: () => void };

export default function Settings({ refresh, onRefresh }: Props) {
  const month = currentMonth();
  const [budgetAmount, setBudgetAmount] = useState("");
  const [currentBudget, setCurrentBudget] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // 고정수입
  const [fixedList, setFixedList] = useState<FixedIncome[]>([]);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCat, setNewCat] = useState("salary");
  const [incomeSaved, setIncomeSaved] = useState(false);

  // 고정지출
  // 알림
  const [reminderOn, setReminderOn] = useState(isReminderEnabled());
  const [reminderMsg, setReminderMsg] = useState("");

  const [fixedExpList, setFixedExpList] = useState<FixedExpense[]>([]);
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDay, setExpDay] = useState("1");
  const [expCat, setExpCat] = useState(EXPENSE_CATEGORIES[0]?.id ?? "food");
  const [expenseSaved, setExpenseSaved] = useState(false);

  useEffect(() => {
    getBudget(month).then((b) => {
      if (b) {
        setCurrentBudget(b.amount);
        setBudgetAmount(b.amount.toLocaleString("ko-KR"));
      } else {
        setCurrentBudget(null);
        setBudgetAmount("");
      }
    });
    loadFixed();
    loadFixedExp();
  }, [month, refresh]);

  async function loadFixed() {
    const list = await getFixedIncomes();
    setFixedList(list);
  }

  async function loadFixedExp() {
    const list = await getFixedExpenses();
    setFixedExpList(list.sort((a, b) => a.day - b.day));
  }

  async function handleSaveBudget() {
    const amt = parseAmountInput(budgetAmount);
    if (!amt || amt <= 0) return;
    await setBudget(month, amt);
    setCurrentBudget(amt);
    setSaved(true);
    onRefresh();
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleDeleteBudget() {
    await deleteBudget(month);
    setCurrentBudget(null);
    setBudgetAmount("");
    onRefresh();
  }

  async function handleAddFixed() {
    const amt = parseAmountInput(newAmount);
    if (!newName.trim() || !amt || amt <= 0) return;
    await addFixedIncome({
      id: crypto.randomUUID(),
      name: newName.trim(),
      amount: amt,
      categoryId: newCat,
    });
    setNewName("");
    setNewAmount("");
    setNewCat("salary");
    setIncomeSaved(true);
    setTimeout(() => setIncomeSaved(false), 1500);
    onRefresh();
    loadFixed();
  }

  async function handleDeleteFixed(id: string) {
    await deleteFixedIncome(id);
    onRefresh();
    loadFixed();
  }

  async function handleAddFixedExp() {
    const amt = parseAmountInput(expAmount);
    const day = parseInt(expDay);
    if (!expName.trim() || !amt || amt <= 0) return;
    if (!day || day < 1 || day > 31) return;
    await addFixedExpense({
      id: crypto.randomUUID(),
      name: expName.trim(),
      amount: amt,
      categoryId: expCat,
      day,
    });
    setExpName("");
    setExpAmount("");
    setExpDay("1");
    setExpCat(EXPENSE_CATEGORIES[0]?.id ?? "food");
    setExpenseSaved(true);
    setTimeout(() => setExpenseSaved(false), 1500);
    onRefresh();
    loadFixedExp();
  }

  async function handleDeleteFixedExp(id: string) {
    await deleteFixedExpense(id);
    onRefresh();
    loadFixedExp();
  }

  async function handleReminderToggle() {
    if (reminderOn) {
      disableReminder();
      setReminderOn(false);
      setReminderMsg("알림을 껐사옵니다");
    } else {
      const ok = await enableReminder();
      if (ok) {
        setReminderOn(true);
        setReminderMsg("매일 저녁 9시에 아뢰겠나이다");
      } else {
        setReminderMsg("알림 권한이 허락되지 않았사옵니다");
      }
    }
    setTimeout(() => setReminderMsg(""), 2000);
  }

  async function handleExportCSV() {
    const all = await getAllTransactions();
    if (all.length === 0) return;

    const BOM = "\uFEFF";
    const header = "날짜,유형,카테고리,금액,메모";
    const rows = all.map((t) => {
      const cat = getCategoryById(t.categoryId);
      const type = t.type === "income" ? "수입" : "지출";
      const memo = (t.memo ?? "").replace(/"/g, '""');
      return `${t.date},${type},${cat?.name ?? t.categoryId},${t.amount},"${memo}"`;
    });
    const csv = BOM + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const file = new File([blob], `소비일기_${currentMonth()}.csv`, { type: "text/csv" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="screen">
      <header className="settings-header">
        <h1>설정</h1>
      </header>

      <section className="settings-section">
        <h2 className="section-title">
          {getMonthLabel(month)} 예산
        </h2>
        {currentBudget !== null && (
          <div className="current-budget">
            현재 예산: <strong>{formatMoney(currentBudget)}</strong>
          </div>
        )}
        <div className="budget-form">
          <div className="budget-input-wrap">
            <input
              type="text"
              className="form-input"
              placeholder="예산 금액"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(formatAmountInput(e.target.value))}
              inputMode="numeric"
            />
            <span className="budget-unit">원</span>
          </div>
          {amountKoreanHint(parseAmountInput(budgetAmount)) && (
            <p className="amount-hint">{amountKoreanHint(parseAmountInput(budgetAmount))}</p>
          )}
          <div className="budget-actions">
            <button className="save-btn small" onClick={handleSaveBudget}>
              {saved ? "저장됨!" : "예산 설정"}
            </button>
            {currentBudget !== null && (
              <button className="delete-btn-text" onClick={handleDeleteBudget}>
                예산 삭제
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">고정 수입</h2>
        <p className="section-desc">매달 자동으로 수입에 반영됩니다.</p>

        {fixedList.length > 0 && (
          <div className="fixed-list">
            {fixedList.map((item) => {
              const cat = INCOME_CATEGORIES.find((c) => c.id === item.categoryId);
              return (
                <div key={item.id} className="fixed-item">
                  <span className="fixed-item-icon">{cat?.icon ?? "💰"}</span>
                  <div className="fixed-item-info">
                    <span className="fixed-item-name">{item.name}</span>
                    <span className="fixed-item-cat">{cat?.name ?? item.categoryId}</span>
                  </div>
                  <span className="fixed-item-amount">{formatMoney(item.amount)}</span>
                  <button className="fixed-item-del" onClick={() => handleDeleteFixed(item.id)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="fixed-form">
          <input
            type="text"
            className="form-input"
            placeholder="이름 (예: 급여)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="fixed-form-row">
            <div className="budget-input-wrap">
              <input
                type="text"
                className="form-input"
                placeholder="금액"
                value={newAmount}
                onChange={(e) => setNewAmount(formatAmountInput(e.target.value))}
                inputMode="numeric"
              />
              <span className="budget-unit">원</span>
            </div>
            <select
              className="form-input fixed-cat-select"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            >
              {INCOME_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          {amountKoreanHint(parseAmountInput(newAmount)) && (
            <p className="amount-hint">{amountKoreanHint(parseAmountInput(newAmount))}</p>
          )}
          <button
            className="save-btn small"
            onClick={handleAddFixed}
            disabled={!newName.trim() || parseAmountInput(newAmount) <= 0}
          >
            {incomeSaved ? "추가됨!" : "고정 수입 추가"}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">고정 지출</h2>
        <p className="section-desc">매달 지정한 날짜에 자동으로 지출에 반영됩니다.</p>

        {fixedExpList.length > 0 && (
          <div className="fixed-list">
            {fixedExpList.map((item) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.id === item.categoryId);
              return (
                <div key={item.id} className="fixed-item">
                  <span className="fixed-item-icon">{cat?.icon ?? "📦"}</span>
                  <div className="fixed-item-info">
                    <span className="fixed-item-name">{item.name}</span>
                    <span className="fixed-item-cat">
                      매월 {item.day}일 · {cat?.name ?? item.categoryId}
                    </span>
                  </div>
                  <span className="fixed-item-amount expense">{formatMoney(item.amount)}</span>
                  <button className="fixed-item-del" onClick={() => handleDeleteFixedExp(item.id)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="fixed-form">
          <input
            type="text"
            className="form-input"
            placeholder="이름 (예: 통신비, 월세)"
            value={expName}
            onChange={(e) => setExpName(e.target.value)}
          />
          <div className="fixed-form-row">
            <div className="budget-input-wrap">
              <input
                type="text"
                className="form-input"
                placeholder="금액"
                value={expAmount}
                onChange={(e) => setExpAmount(formatAmountInput(e.target.value))}
                inputMode="numeric"
              />
              <span className="budget-unit">원</span>
            </div>
            <div className="budget-input-wrap fixed-day-wrap">
              <input
                type="number"
                className="form-input"
                placeholder="일"
                min={1}
                max={31}
                value={expDay}
                onChange={(e) => setExpDay(e.target.value)}
                inputMode="numeric"
              />
              <span className="budget-unit">일</span>
            </div>
          </div>
          <select
            className="form-input"
            value={expCat}
            onChange={(e) => setExpCat(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          {amountKoreanHint(parseAmountInput(expAmount)) && (
            <p className="amount-hint">{amountKoreanHint(parseAmountInput(expAmount))}</p>
          )}
          <button
            className="save-btn small"
            onClick={handleAddFixedExp}
            disabled={
              !expName.trim() ||
              parseAmountInput(expAmount) <= 0 ||
              !expDay ||
              parseInt(expDay) < 1 ||
              parseInt(expDay) > 31
            }
          >
            {expenseSaved ? "추가됨!" : "고정 지출 추가"}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">저녁 알림</h2>
        <p className="section-desc">매일 저녁 9시에 장부 펼치기를 권고드립니다.</p>
        <div className="reminder-row">
          <span className="reminder-label">
            {reminderOn ? "켜짐" : "꺼짐"}
          </span>
          <button
            className={`reminder-switch ${reminderOn ? "on" : ""}`}
            onClick={handleReminderToggle}
            aria-pressed={reminderOn}
          >
            <span className="reminder-knob" />
          </button>
        </div>
        {reminderMsg && <p className="reminder-msg">{reminderMsg}</p>}
      </section>

      <section className="settings-section">
        <h2 className="section-title">장부 내보내기</h2>
        <p className="section-desc">전체 장부를 CSV 파일로 보관하옵니다.</p>
        <button className="export-btn" onClick={handleExportCSV}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2M9 3v9M6 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CSV 내보내기
        </button>
      </section>

      <section className="settings-section">
        <h2 className="section-title">호조 정보</h2>
        <div className="info-list">
          <div className="info-row">
            <span>이름</span>
            <span>호조 (戶曹)</span>
          </div>
          <div className="info-row">
            <span>버전</span>
            <span>1.0.0</span>
          </div>
          <div className="info-row">
            <span>데이터 저장</span>
            <span>기기 내 저장 (IndexedDB)</span>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getBudget, setBudget, deleteBudget,
  getFixedIncomes, deleteFixedIncome,
  getFixedExpenses, deleteFixedExpense,
  getAllTransactions,
} from "../lib/db";
import type { FixedIncome, FixedExpense } from "../types";
import { currentMonth, formatMoney, getMonthLabel, formatAmountInput, parseAmountInput, amountKoreanWord } from "../lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, categoryName } from "../lib/categories";
import { isReminderEnabled, enableReminder, disableReminder } from "../lib/reminder";
import { getApiKeys, setAnthropicKey, setDatalabKey, maskKey } from "../lib/apiKeys";
import { setLang, currentLang, SUPPORTED_LANGS, type Lang } from "../lib/i18n";
import { getBaseCurrency, setBaseCurrency } from "../lib/settings";
import type { Currency } from "../types";

const BASE_CURRENCIES: Currency[] = ["KRW", "USD", "EUR", "JPY", "GBP"];

type Props = { refresh: number; onRefresh: () => void };

export default function Settings({ refresh, onRefresh }: Props) {
  const { t, i18n } = useTranslation();
  const month = currentMonth();
  const [lang, setLangState] = useState<Lang>(currentLang());
  const [baseCcy, setBaseCcyState] = useState<Currency>(getBaseCurrency());
  const [budgetAmount, setBudgetAmount] = useState("");
  const [currentBudget, setCurrentBudget] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const [fixedList, setFixedList] = useState<FixedIncome[]>([]);

  const [reminderOn, setReminderOn] = useState(isReminderEnabled());
  const [reminderMsg, setReminderMsg] = useState("");

  const [anthKey, setAnthKey] = useState("");
  const [dataKey, setDataKey] = useState("");
  const [anthSaved, setAnthSaved] = useState("");
  const [dataSaved, setDataSaved] = useState("");
  const [showAnth, setShowAnth] = useState(false);
  const [showData, setShowData] = useState(false);
  const [keysMsg, setKeysMsg] = useState("");

  const [fixedExpList, setFixedExpList] = useState<FixedExpense[]>([]);

  useEffect(() => {
    getBudget(month).then((b) => {
      if (b) {
        setCurrentBudget(b.amount);
        setBudgetAmount(b.amount.toLocaleString());
      } else {
        setCurrentBudget(null);
        setBudgetAmount("");
      }
    });
    getFixedIncomes().then(setFixedList);
    getFixedExpenses().then((list) => setFixedExpList(list.sort((a, b) => a.day - b.day)));
    getApiKeys().then((k) => {
      setAnthSaved(k.anthropic);
      setDataSaved(k.datalab);
    });
  }, [month, refresh, lang]);

  async function handleSaveAnthKey() {
    await setAnthropicKey(anthKey);
    setAnthSaved(anthKey);
    setAnthKey("");
    setShowAnth(false);
    setKeysMsg(t("apiKeys.anthropicSaved"));
    setTimeout(() => setKeysMsg(""), 2000);
  }

  async function handleClearAnthKey() {
    await setAnthropicKey("");
    setAnthSaved("");
    setKeysMsg(t("apiKeys.anthropicDeleted"));
    setTimeout(() => setKeysMsg(""), 2000);
  }

  async function handleSaveDataKey() {
    await setDatalabKey(dataKey);
    setDataSaved(dataKey);
    setDataKey("");
    setShowData(false);
    setKeysMsg(t("apiKeys.datalabSaved"));
    setTimeout(() => setKeysMsg(""), 2000);
  }

  async function handleClearDataKey() {
    await setDatalabKey("");
    setDataSaved("");
    setKeysMsg(t("apiKeys.datalabDeleted"));
    setTimeout(() => setKeysMsg(""), 2000);
  }

  function handleLangChange(next: Lang) {
    setLang(next);
    setLangState(next);
  }

  function handleBaseCcyChange(next: Currency) {
    setBaseCurrency(next);
    setBaseCcyState(next);
    onRefresh();
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

  async function handleDeleteFixed(id: string) {
    await deleteFixedIncome(id);
    onRefresh();
    getFixedIncomes().then(setFixedList);
  }

  async function handleDeleteFixedExp(id: string) {
    await deleteFixedExpense(id);
    onRefresh();
    getFixedExpenses().then((list) => setFixedExpList(list.sort((a, b) => a.day - b.day)));
  }

  async function handleReminderToggle() {
    if (reminderOn) {
      await disableReminder();
      setReminderOn(false);
      setReminderMsg(t("reminder.disabledMsg"));
    } else {
      const ok = await enableReminder();
      if (ok) {
        setReminderOn(true);
        setReminderMsg(t("reminder.enabledMsg"));
      } else {
        setReminderMsg(t("reminder.deniedMsg"));
      }
    }
    setTimeout(() => setReminderMsg(""), 2000);
  }

  async function handleExportCSV() {
    const all = await getAllTransactions();
    if (all.length === 0) return;

    const BOM = "\uFEFF";
    const header = t("export.csvHeader");
    const rows = all.map((tx) => {
      const type = tx.type === "income" ? t("export.typeIncome") : t("export.typeExpense");
      const memo = (tx.memo ?? "").replace(/"/g, '""');
      return `${tx.date},${type},${categoryName(tx.categoryId)},${tx.amount},"${memo}"`;
    });
    const csv = BOM + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const fileName = t("export.fileName", { month: currentMonth() });
    const file = new File([blob], fileName, { type: "text/csv" });

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

  const amountUnit = t("format.amountUnit");
  void i18n;

  return (
    <div className="screen">
      <header className="settings-header">
        <h1>{t("settings.title")}</h1>
      </header>

      <section className="settings-section">
        <h2 className="section-title">
          {t("budget.sectionTitle", { month: getMonthLabel(month) })}
        </h2>
        {currentBudget !== null && (
          <div className="current-budget">
            {t("budget.current")}: <strong>{formatMoney(currentBudget)}</strong>
          </div>
        )}
        <div className="budget-form">
          <div className="budget-input-wrap">
            <input
              type="text"
              className="form-input"
              placeholder={t("budget.inputPlaceholder")}
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(formatAmountInput(e.target.value))}
              inputMode="numeric"
            />
            {amountUnit && <span className="budget-unit">{amountUnit}</span>}
          </div>
          {amountKoreanWord(parseAmountInput(budgetAmount)) && (
            <p className="amount-hint">{amountKoreanWord(parseAmountInput(budgetAmount))}</p>
          )}
          <div className="budget-actions">
            <button className="save-btn small" onClick={handleSaveBudget}>
              {saved ? t("budget.saved") : t("budget.setButton")}
            </button>
            {currentBudget !== null && (
              <button className="delete-btn-text" onClick={handleDeleteBudget}>
                {t("budget.deleteButton")}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("fixedIncome.title")}</h2>
        <p className="section-desc">{t("fixedIncome.desc")}</p>

        {fixedList.length > 0 && (
          <div className="fixed-list">
            {fixedList.map((item) => {
              const cat = INCOME_CATEGORIES.find((c) => c.id === item.categoryId);
              return (
                <div key={item.id} className="fixed-item">
                  <span className="fixed-item-icon">{cat ? <cat.Icon size={18} strokeWidth={1.75} /> : null}</span>
                  <div className="fixed-item-info">
                    <span className="fixed-item-name">{item.name}</span>
                    <span className="fixed-item-cat">{categoryName(item.categoryId)}</span>
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

      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("fixedExpense.title")}</h2>
        <p className="section-desc">{t("fixedExpense.desc")}</p>

        {fixedExpList.length > 0 && (
          <div className="fixed-list">
            {fixedExpList.map((item) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.id === item.categoryId);
              return (
                <div key={item.id} className="fixed-item">
                  <span className="fixed-item-icon">{cat ? <cat.Icon size={18} strokeWidth={1.75} /> : null}</span>
                  <div className="fixed-item-info">
                    <span className="fixed-item-name">{item.name}</span>
                    <span className="fixed-item-cat">
                      {t("fixedExpense.monthlyOn", { day: item.day })} · {categoryName(item.categoryId)}
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

      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("reminder.title")}</h2>
        <p className="section-desc">{t("reminder.desc")}</p>
        <div className="reminder-row">
          <span className="reminder-label">
            {reminderOn ? t("reminder.on") : t("reminder.off")}
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
        <h2 className="section-title">{t("language.title")}</h2>
        <p className="section-desc">{t("language.desc")}</p>
        <div className="lang-switch">
          {SUPPORTED_LANGS.map((code) => (
            <button
              key={code}
              className={`lang-btn ${lang === code ? "on" : ""}`}
              onClick={() => handleLangChange(code)}
              aria-pressed={lang === code}
            >
              {t(`language.${code}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("baseCurrency.title")}</h2>
        <p className="section-desc">{t("baseCurrency.desc")}</p>
        <div className="lang-switch">
          {BASE_CURRENCIES.map((c) => (
            <button
              key={c}
              className={`lang-btn ${baseCcy === c ? "on" : ""}`}
              onClick={() => handleBaseCcyChange(c)}
              aria-pressed={baseCcy === c}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("export.title")}</h2>
        <p className="section-desc">{t("export.desc")}</p>
        <button className="export-btn" onClick={handleExportCSV}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 12v2a2 2 0 002 2h8a2 2 0 002-2v-2M9 3v9M6 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("export.button")}
        </button>
      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("apiKeys.title")}</h2>
        <p className="section-desc">{t("apiKeys.desc")}</p>

        <div className="apikey-row">
          <div className="apikey-label">
            <span className="apikey-name">{t("apiKeys.anthropicName")}</span>
            <span className="apikey-hint">{t("apiKeys.anthropicHint")}</span>
          </div>
          {anthSaved && !showAnth ? (
            <div className="apikey-saved">
              <code>{maskKey(anthSaved)}</code>
              <button className="linkish" onClick={() => setShowAnth(true)}>{t("apiKeys.change")}</button>
              <button className="linkish danger" onClick={handleClearAnthKey}>{t("common.delete")}</button>
            </div>
          ) : (
            <div className="apikey-edit">
              <input
                type="password"
                className="form-input"
                placeholder="sk-ant-..."
                value={anthKey}
                onChange={(e) => setAnthKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="apikey-actions">
                <button
                  className="save-btn small"
                  onClick={handleSaveAnthKey}
                  disabled={!anthKey.trim()}
                >
                  {t("common.save")}
                </button>
                {anthSaved && (
                  <button className="linkish" onClick={() => { setShowAnth(false); setAnthKey(""); }}>
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="apikey-row">
          <div className="apikey-label">
            <span className="apikey-name">{t("apiKeys.datalabName")}</span>
            <span className="apikey-hint">{t("apiKeys.datalabHint")}</span>
          </div>
          {dataSaved && !showData ? (
            <div className="apikey-saved">
              <code>{maskKey(dataSaved)}</code>
              <button className="linkish" onClick={() => setShowData(true)}>{t("apiKeys.change")}</button>
              <button className="linkish danger" onClick={handleClearDataKey}>{t("common.delete")}</button>
            </div>
          ) : (
            <div className="apikey-edit">
              <input
                type="password"
                className="form-input"
                placeholder="API key"
                value={dataKey}
                onChange={(e) => setDataKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="apikey-actions">
                <button
                  className="save-btn small"
                  onClick={handleSaveDataKey}
                  disabled={!dataKey.trim()}
                >
                  {t("common.save")}
                </button>
                {dataSaved && (
                  <button className="linkish" onClick={() => { setShowData(false); setDataKey(""); }}>
                    {t("common.cancel")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {keysMsg && <p className="reminder-msg">{keysMsg}</p>}
      </section>

      <section className="settings-section">
        <h2 className="section-title">{t("appInfo.title")}</h2>
        <div className="info-list">
          <div className="info-row">
            <span>{t("appInfo.name")}</span>
            <span>Hojo</span>
          </div>
          <div className="info-row">
            <span>{t("appInfo.version")}</span>
            <span>0.4.1</span>
          </div>
          <div className="info-row">
            <span>{t("appInfo.storage")}</span>
            <span>{t("appInfo.storageValue")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

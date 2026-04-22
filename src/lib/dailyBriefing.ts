/**
 * 일일 브리핑: 어제 소비 + 자산 변동을 Sonnet이 2-3문장으로 요약.
 * Home 첫 방문 시 아침 8시 이후면 자동 생성. 하루 1회.
 */

import { httpJson } from "./http";
import { getAllTransactions, getAssets } from "./db";
import { valuePortfolio, valuationsInBase } from "./prices";
import { getBaseCurrency } from "./settings";
import { getApiKeys } from "./apiKeys";
import { categoryName } from "./categories";
import { currentLang } from "./i18n";
import type { Currency } from "../types";

const KEY_LAST_BRIEFING = "hojo.last_briefing";
const KEY_LAST_PORTFOLIO = "hojo.last_portfolio_value";
const KEY_LAST_PORTFOLIO_DATE = "hojo.last_portfolio_date";

export interface DailyBriefing {
  date: string;                 // YYYY-MM-DD (briefing 생성일)
  text: string;                 // Sonnet이 쓴 2-3문장 요약
  spendingTotal: number;        // 어제 지출 합 (기준통화)
  portfolioValue: number;       // 현재 평가액 (기준통화)
  portfolioDelta?: number;      // 직전 스냅샷 대비 변동 (없으면 undefined)
  currency: Currency;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLastBriefing(): DailyBriefing | null {
  const raw = localStorage.getItem(KEY_LAST_BRIEFING);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyBriefing;
  } catch {
    return null;
  }
}

function saveBriefing(b: DailyBriefing): void {
  localStorage.setItem(KEY_LAST_BRIEFING, JSON.stringify(b));
}

/** 오늘 아침 8시 이후고 아직 브리핑이 없거나 어제 이전 것이면 true. */
export function shouldGenerateBriefing(): boolean {
  const now = new Date();
  if (now.getHours() < 8) return false;
  const last = getLastBriefing();
  return !last || last.date !== todayKey();
}

export async function generateDailyBriefing(): Promise<DailyBriefing | null> {
  const keys = await getApiKeys();
  if (!keys.anthropic) return null;

  const baseCcy = getBaseCurrency();
  const yKey = yesterdayKey();

  const [txs, assets] = await Promise.all([getAllTransactions(), getAssets()]);
  const yesterdayTxs = txs.filter((t) => t.date === yKey);
  const spendingTotal = yesterdayTxs
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = yesterdayTxs
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const byCat: Record<string, number> = {};
  for (const t of yesterdayTxs) {
    if (t.type !== "expense") continue;
    byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount;
  }
  const topCats = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amt]) => `${categoryName(id)} ${amt.toLocaleString()}`);

  let portfolioValue = 0;
  let portfolioDelta: number | undefined;
  let portfolioDeltaFrom: string | undefined;
  if (assets.length > 0) {
    try {
      const valued = await valuePortfolio(assets);
      const based = await valuationsInBase(valued, baseCcy);
      portfolioValue = based.reduce((s, v) => s + (v.valueBase || 0), 0);
      const prevRaw = localStorage.getItem(KEY_LAST_PORTFOLIO);
      const prevDate = localStorage.getItem(KEY_LAST_PORTFOLIO_DATE);
      if (prevRaw && prevDate && prevDate !== todayKey()) {
        const prev = Number(prevRaw);
        if (!Number.isNaN(prev) && prev > 0) {
          portfolioDelta = portfolioValue - prev;
          portfolioDeltaFrom = prevDate;
        }
      }
      localStorage.setItem(KEY_LAST_PORTFOLIO, String(portfolioValue));
      localStorage.setItem(KEY_LAST_PORTFOLIO_DATE, todayKey());
    } catch (err) {
      console.warn("[hojo] briefing portfolio failed", err);
    }
  }

  const lang = currentLang();
  const prompt = buildPrompt({
    lang,
    ccy: baseCcy,
    yesterday: yKey,
    spendingTotal,
    incomeTotal,
    topCats,
    txCount: yesterdayTxs.filter((t) => t.type === "expense").length,
    portfolioValue,
    portfolioDelta,
    portfolioDeltaFrom,
  });

  const res = await httpJson<{ content?: Array<{ type: string; text?: string }> }>(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": keys.anthropic,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: {
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      },
    },
  );

  const text = res.data.content?.find((c) => c.type === "text")?.text?.trim();
  if (!res.ok || !text) return null;

  const briefing: DailyBriefing = {
    date: todayKey(),
    text,
    spendingTotal,
    portfolioValue,
    portfolioDelta,
    currency: baseCcy,
  };
  saveBriefing(briefing);
  return briefing;
}

function buildPrompt(ctx: {
  lang: string;
  ccy: Currency;
  yesterday: string;
  spendingTotal: number;
  incomeTotal: number;
  topCats: string[];
  txCount: number;
  portfolioValue: number;
  portfolioDelta?: number;
  portfolioDeltaFrom?: string;
}): string {
  const isKo = ctx.lang !== "en";
  const ccySym = ctx.ccy === "KRW" ? "원" : ctx.ccy;
  const topLine = ctx.topCats.length > 0 ? ctx.topCats.join(", ") : (isKo ? "없음" : "none");
  const deltaLine =
    ctx.portfolioDelta === undefined
      ? (isKo ? "(직전 스냅샷 없음)" : "(no prior snapshot)")
      : `${ctx.portfolioDelta >= 0 ? "+" : ""}${ctx.portfolioDelta.toLocaleString()} ${ccySym}`;
  const deltaLabel = ctx.portfolioDeltaFrom
    ? (isKo
        ? `직전 기록(${ctx.portfolioDeltaFrom}) 대비 자산 변동`
        : `Change vs last snapshot (${ctx.portfolioDeltaFrom})`)
    : (isKo ? "자산 변동" : "Portfolio change");

  if (isKo) {
    return `사용자의 일일 재무 브리핑을 2-3문장으로 작성하세요. 톤: 친근한 평어체, 짧고 담백하게. 이모지 없음. 조선 말투 금지. 자산 변동이 없으면 소비만, 변동이 크면 강조. 조언은 자연스럽게 하나만. 자산 변동 기간이 1일이 아닐 수 있으니 "어제 하루 동안" 같은 표현은 피하고 "직전 기록 대비" 또는 실제 날짜 범위를 언급하세요.

어제(${ctx.yesterday}) 지출: ${ctx.spendingTotal.toLocaleString()} ${ccySym} (${ctx.txCount}건)
어제 수입: ${ctx.incomeTotal.toLocaleString()} ${ccySym}
어제 지출 상위 카테고리: ${topLine}
현재 포트폴리오 평가액: ${ctx.portfolioValue.toLocaleString()} ${ccySym}
${deltaLabel}: ${deltaLine}`;
  }

  return `Write a 2-3 sentence daily financial briefing for the user. Tone: friendly, concise, plain. No emojis. Natural, single piece of light commentary if appropriate. The portfolio change period may span more than a day — avoid phrases like "overnight" or "since yesterday" and refer to the actual snapshot date instead.

Yesterday (${ctx.yesterday}) spending: ${ctx.spendingTotal.toLocaleString()} ${ccySym} (${ctx.txCount} tx)
Yesterday income: ${ctx.incomeTotal.toLocaleString()} ${ccySym}
Top categories yesterday: ${topLine}
Current portfolio value: ${ctx.portfolioValue.toLocaleString()} ${ccySym}
${deltaLabel}: ${deltaLine}`;
}

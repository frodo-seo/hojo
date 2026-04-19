import type React from "react";
import { useTranslation } from "react-i18next";

export type Tab = "home" | "history" | "coach" | "settings";

type Props = {
  current: Tab;
  onChange: (t: Tab) => void;
  onAdd: () => void;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V14h6v7" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="17" rx="1" />
      <path d="M7 9h10M7 13h6M7 17h8" />
    </svg>
  );
}

function CoachIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3L4 7v6l8 5 8-5V7l-8-4z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 8h16M4 16h16" />
      <circle cx="9" cy="8" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const leftTabs: Array<{ id: Tab; Icon: () => React.ReactElement }> = [
  { id: "home", Icon: HomeIcon },
  { id: "history", Icon: HistoryIcon },
];

const rightTabs: Array<{ id: Tab; Icon: () => React.ReactElement }> = [
  { id: "coach", Icon: CoachIcon },
  { id: "settings", Icon: SettingsIcon },
];

export default function TabBar({ current, onChange, onAdd }: Props) {
  const { t } = useTranslation();
  return (
    <nav className="tabbar">
      {leftTabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${current === tab.id ? "on" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="tab-icon"><tab.Icon /></span>
          <span className="tab-label">{t(`tabs.${tab.id}`)}</span>
        </button>
      ))}
      <button className="tab-add" onClick={onAdd} aria-label={t("tabs.add")}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {rightTabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${current === tab.id ? "on" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="tab-icon"><tab.Icon /></span>
          <span className="tab-label">{t(`tabs.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  );
}

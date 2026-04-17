import type React from "react";

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

const leftTabs: Array<{ id: Tab; label: string; Icon: () => React.ReactElement }> = [
  { id: "home", label: "홈", Icon: HomeIcon },
  { id: "history", label: "장부", Icon: HistoryIcon },
];

const rightTabs: Array<{ id: Tab; label: string; Icon: () => React.ReactElement }> = [
  { id: "coach", label: "상소", Icon: CoachIcon },
  { id: "settings", label: "설정", Icon: SettingsIcon },
];

export default function TabBar({ current, onChange, onAdd }: Props) {
  return (
    <nav className="tabbar">
      {leftTabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${current === t.id ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon"><t.Icon /></span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
      <button className="tab-add" onClick={onAdd} aria-label="추가">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {rightTabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${current === t.id ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon"><t.Icon /></span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export type Tab = "home" | "timeline" | "stats";

type Props = {
  current: Tab;
  onChange: (t: Tab) => void;
  onCapture: () => void;
};

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home", label: "홈", icon: "🏠" },
  { id: "timeline", label: "타임라인", icon: "📅" },
  { id: "stats", label: "통계", icon: "📊" },
];

export default function TabBar({ current, onChange, onCapture }: Props) {
  return (
    <nav className="tabbar">
      {tabs.slice(0, 1).map((t) => (
        <button
          key={t.id}
          className={`tab ${current === t.id ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
      {tabs.slice(1, 2).map((t) => (
        <button
          key={t.id}
          className={`tab ${current === t.id ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
      <button className="tab-capture" onClick={onCapture} aria-label="영수증 찍기">
        <span>＋</span>
      </button>
      {tabs.slice(2).map((t) => (
        <button
          key={t.id}
          className={`tab ${current === t.id ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, BookOpen, FileBarChart2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Props = { onDone: () => void };

const PAGES: Array<{ titleKey: string; bodyKey: string; Icon: LucideIcon }> = [
  { titleKey: "onboarding.welcomeTitle", bodyKey: "onboarding.welcomeBody", Icon: Wallet },
  { titleKey: "onboarding.howtoTitle", bodyKey: "onboarding.howtoBody", Icon: BookOpen },
  { titleKey: "onboarding.reportTitle", bodyKey: "onboarding.reportBody", Icon: FileBarChart2 },
];

export default function Onboarding({ onDone }: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const isLast = page === PAGES.length - 1;
  const cur = PAGES[page];

  function next() {
    if (isLast) {
      localStorage.setItem("onboarded", "1");
      onDone();
    } else {
      setPage(page + 1);
    }
  }

  function skip() {
    localStorage.setItem("onboarded", "1");
    onDone();
  }

  return (
    <div className="onboarding">
      <button className="onboarding-skip" onClick={skip}>{t("onboarding.skip")}</button>

      <div className="onboarding-body">
        <div className="onboarding-badge"><cur.Icon size={36} strokeWidth={1.5} /></div>
        <h1 className="onboarding-title">{t(cur.titleKey)}</h1>
        <p className="onboarding-text">{t(cur.bodyKey)}</p>
      </div>

      <div className="onboarding-footer">
        <div className="onboarding-dots">
          {PAGES.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === page ? "on" : ""}`} />
          ))}
        </div>
        <button className="onboarding-next" onClick={next}>
          {isLast ? t("onboarding.start") : t("onboarding.next")}
        </button>
      </div>
    </div>
  );
}

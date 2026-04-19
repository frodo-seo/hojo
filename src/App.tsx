import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { subscribeNotifications } from "./lib/notifications";
import type { Transaction } from "./types";
import Home from "./screens/Home";
import Add from "./screens/Add";
import History from "./screens/History";
import Coach from "./screens/Coach";
import Settings from "./screens/Settings";
import ReceiptScan from "./screens/ReceiptScan";
import Assets from "./screens/Assets";
import Onboarding from "./screens/Onboarding";
import TabBar, { type Tab } from "./components/TabBar";
import "./App.css";

type Screen =
  | { name: "tabs"; tab: Tab }
  | { name: "add"; editTx?: Transaction }
  | { name: "receipt" }
  | { name: "assets" };

export default function App() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ name: "tabs", tab: "home" });
  const [refresh, setRefresh] = useState(0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("onboarded") === "1",
  );

  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    let handle: Awaited<ReturnType<typeof subscribeNotifications>> | null = null;
    (async () => {
      handle = await subscribeNotifications((payload) => {
        // Phase B-1: 수신 확인용 로그. B-2에서 Haiku 파싱 붙인다.
        console.log("[hojo] notification", payload);
      });
    })();
    return () => { handle?.remove(); };
  }, []);

  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  const openAdd = (editTx?: Transaction) => {
    setShowAddSheet(false);
    setScreen({ name: "add", editTx });
  };

  const afterSave = () => {
    bump();
    setScreen({ name: "tabs", tab: "home" });
  };

  return (
    <div className="app-frame">
      {screen.name === "tabs" && screen.tab === "home" && (
        <Home refresh={refresh} onEditTx={openAdd} onOpenAssets={() => setScreen({ name: "assets" })} />
      )}
      {screen.name === "tabs" && screen.tab === "history" && (
        <History refresh={refresh} onEditTx={openAdd} />
      )}
      {screen.name === "tabs" && screen.tab === "coach" && (
        <Coach
          refresh={refresh}
          onGoSettings={() => setScreen({ name: "tabs", tab: "settings" })}
        />
      )}
      {screen.name === "tabs" && screen.tab === "settings" && (
        <Settings refresh={refresh} onRefresh={bump} />
      )}
      {screen.name === "add" && (
        <Add
          editTx={screen.editTx}
          onDone={afterSave}
          onBack={() => setScreen({ name: "tabs", tab: "home" })}
        />
      )}
      {screen.name === "receipt" && (
        <ReceiptScan
          onDone={afterSave}
          onBack={() => setScreen({ name: "tabs", tab: "home" })}
          onGoSettings={() => setScreen({ name: "tabs", tab: "settings" })}
        />
      )}
      {screen.name === "assets" && (
        <Assets
          refresh={refresh}
          onBack={() => setScreen({ name: "tabs", tab: "home" })}
        />
      )}

      {screen.name === "tabs" && (
        <TabBar
          current={screen.tab}
          onChange={(t) => setScreen({ name: "tabs", tab: t })}
          onAdd={() => setShowAddSheet(true)}
        />
      )}

      {/* Add Method Bottom Sheet */}
      {showAddSheet && (
        <div className="sheet-backdrop" onClick={() => setShowAddSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button
              className="sheet-option"
              onClick={() => {
                setShowAddSheet(false);
                setScreen({ name: "receipt" });
              }}
            >
              <div className="sheet-option-icon receipt-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="2" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 7h8M7 11h8M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="sheet-option-text">
                <span className="sheet-option-title">{t("addSheet.scanTitle")}</span>
                <span className="sheet-option-sub">{t("addSheet.scanSub")}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="sheet-option-arrow">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="sheet-option"
              onClick={() => openAdd()}
            >
              <div className="sheet-option-icon manual-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M11 5v12M5 11h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="sheet-option-text">
                <span className="sheet-option-title">{t("addSheet.manualTitle")}</span>
                <span className="sheet-option-sub">{t("addSheet.manualSub")}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="sheet-option-arrow">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

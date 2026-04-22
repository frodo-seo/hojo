import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { isNative } from "./lib/platform";
import type { Transaction } from "./types";
import Home from "./screens/Home";
import Add from "./screens/Add";
import History from "./screens/History";
import Coach from "./screens/Coach";
import Settings from "./screens/Settings";
import ScanEntry from "./screens/ScanEntry";
import Assets from "./screens/Assets";
import Onboarding from "./screens/Onboarding";
import TabBar, { type Tab } from "./components/TabBar";
import "./App.css";

type Screen =
  | { name: "tabs"; tab: Tab }
  | { name: "add"; editTx: Transaction }
  | { name: "scan" }
  | { name: "assets" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "tabs", tab: "home" });
  const [refresh, setRefresh] = useState(0);
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("onboarded") === "1",
  );

  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    if (!isNative()) return;
    let backHandle: { remove: () => void } | null = null;
    (async () => {
      backHandle = await CapApp.addListener("backButton", () => {
        setScreen((s) => {
          if (s.name !== "tabs") return { name: "tabs", tab: "home" };
          if (s.tab !== "home") return { name: "tabs", tab: "home" };
          CapApp.exitApp();
          return s;
        });
      });
    })();
    return () => { backHandle?.remove(); };
  }, []);

  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  const openEdit = (editTx: Transaction) => {
    setScreen({ name: "add", editTx });
  };

  const afterSave = () => {
    bump();
    setScreen({ name: "tabs", tab: "home" });
  };

  return (
    <div className="app-frame">
      {screen.name === "tabs" && screen.tab === "home" && (
        <Home
          refresh={refresh}
          onEditTx={openEdit}
          onOpenAssets={() => setScreen({ name: "assets" })}
        />
      )}
      {screen.name === "tabs" && screen.tab === "history" && (
        <History refresh={refresh} onEditTx={openEdit} />
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
      {screen.name === "scan" && (
        <ScanEntry
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
          onAdd={() => setScreen({ name: "scan" })}
        />
      )}
    </div>
  );
}

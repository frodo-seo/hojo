import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { subscribeNotifications } from "./lib/notifications";
import { isNative } from "./lib/platform";
import { handleNotification } from "./lib/notifHandler";
import type { Transaction } from "./types";
import Home from "./screens/Home";
import Add from "./screens/Add";
import History from "./screens/History";
import Coach from "./screens/Coach";
import Settings from "./screens/Settings";
import ScanEntry from "./screens/ScanEntry";
import Assets from "./screens/Assets";
import NotifInbox from "./screens/NotifInbox";
import Onboarding from "./screens/Onboarding";
import TabBar, { type Tab } from "./components/TabBar";
import "./App.css";

type Screen =
  | { name: "tabs"; tab: Tab }
  | { name: "add"; editTx?: Transaction }
  | { name: "scan" }
  | { name: "assets" }
  | { name: "inbox" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "tabs", tab: "home" });
  const [refresh, setRefresh] = useState(0);
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem("onboarded") === "1",
  );

  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    let handle: Awaited<ReturnType<typeof subscribeNotifications>> | null = null;
    (async () => {
      handle = await subscribeNotifications((payload) => {
        handleNotification(payload).then(() => bump()).catch(() => {});
      });
    })();
    return () => { handle?.remove(); };
  }, [bump]);

  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => void } | null = null;
    (async () => {
      handle = await CapApp.addListener("backButton", () => {
        setScreen((s) => {
          if (s.name !== "tabs") return { name: "tabs", tab: "home" };
          if (s.tab !== "home") return { name: "tabs", tab: "home" };
          CapApp.exitApp();
          return s;
        });
      });
    })();
    return () => { handle?.remove(); };
  }, []);

  if (!onboarded) {
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  const openAdd = (editTx?: Transaction) => {
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
          onEditTx={openAdd}
          onOpenAssets={() => setScreen({ name: "assets" })}
          onOpenInbox={() => setScreen({ name: "inbox" })}
        />
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
      {screen.name === "inbox" && (
        <NotifInbox
          onDone={afterSave}
          onBack={() => { bump(); setScreen({ name: "tabs", tab: "home" }); }}
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

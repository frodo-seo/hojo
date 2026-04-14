import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Home from "./screens/Home";
import Capture from "./screens/Capture";
import Confirm from "./screens/Confirm";
import Result from "./screens/Result";
import Timeline from "./screens/Timeline";
import Stats from "./screens/Stats";
import Login from "./screens/Login";
import TabBar, { type Tab } from "./components/TabBar";
import { listReceipts } from "./lib/receipts";
import { supabase } from "./lib/supabase";
import type { Receipt } from "./types";
import type { ReceiptDraft } from "./lib/pipeline";
import "./App.css";

type Screen =
  | { name: "tabs"; tab: Tab }
  | { name: "capture" }
  | { name: "confirm"; draft: ReceiptDraft }
  | { name: "result"; receipt: Receipt };

export default function App() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "tabs", tab: "home" });
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setReceipts([]);
        setScreen({ name: "tabs", tab: "home" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listReceipts();
      setReceipts(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "불러오기 실패");
    }
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  if (session === undefined) {
    return <div className="loading-screen">로딩 중…</div>;
  }
  if (!session) {
    return <Login />;
  }

  const openReceipt = (id: string) => {
    const r = receipts.find((x) => x.id === id);
    if (r) setScreen({ name: "result", receipt: r });
  };

  const afterConfirm = async (r: Receipt) => {
    await refresh();
    setScreen({ name: "result", receipt: r });
  };

  return (
    <div className="app-frame">
      {loadError && (
        <div className="error-banner">⚠️ {loadError}</div>
      )}

      {screen.name === "tabs" && screen.tab === "home" && (
        <Home receipts={receipts} onOpen={openReceipt} />
      )}
      {screen.name === "tabs" && screen.tab === "timeline" && (
        <Timeline receipts={receipts} onOpen={openReceipt} />
      )}
      {screen.name === "tabs" && screen.tab === "stats" && (
        <Stats receipts={receipts} />
      )}
      {screen.name === "capture" && (
        <Capture
          onBack={() => setScreen({ name: "tabs", tab: "home" })}
          onDone={(draft) => setScreen({ name: "confirm", draft })}
        />
      )}
      {screen.name === "confirm" && (
        <Confirm
          draft={screen.draft}
          onBack={() => setScreen({ name: "capture" })}
          onDone={afterConfirm}
        />
      )}
      {screen.name === "result" && (
        <Result
          receipt={screen.receipt}
          onHome={() => setScreen({ name: "tabs", tab: "home" })}
        />
      )}

      {screen.name === "tabs" && (
        <TabBar
          current={screen.tab}
          onChange={(t) => setScreen({ name: "tabs", tab: t })}
          onCapture={() => setScreen({ name: "capture" })}
        />
      )}
    </div>
  );
}

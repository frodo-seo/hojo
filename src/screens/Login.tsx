import { useState } from "react";
import { signInWithGoogle } from "../lib/auth";

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // 리다이렉트 되므로 여기로는 거의 돌아오지 않음
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 실패");
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-hero">
        <span className="badge">소비일기 · beta</span>
        <h1>
          내 소비가
          <br />
          이야기가 되는 곳
        </h1>
        <p className="sub">영수증 한 장 + 사진 한 장이면 충분해요</p>
      </div>

      <div className="login-actions">
        <button className="google-btn" onClick={handleGoogle} disabled={busy}>
          <span className="g-mark">G</span>
          {busy ? "로그인 중…" : "Google로 계속하기"}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
          로그인하면 영수증이 안전하게 저장돼요
        </p>
      </div>
    </div>
  );
}

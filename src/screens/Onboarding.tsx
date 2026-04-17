import { useState } from "react";

type Props = { onDone: () => void };

const PAGES = [
  {
    title: "호조(戶曹)에 드시옵소서",
    body: "전하의 가계(家計)를 소신이 모시겠나이다.\n하루하루 장부에 올리시면,\n호조가 이를 살펴 상소로 아뢰옵니다.",
    badge: "戶",
  },
  {
    title: "장부를 펼치는 법",
    body: "아래 붉은 표식을 눌러\n지출과 수입을 올리시옵소서.\n사진으로도 기록할 수 있나이다.",
    badge: "帳",
  },
  {
    title: "판서의 상소",
    body: "달이 바뀌면 호조판서가\n전하의 장부를 총람하여\n친히 상소를 올리옵나이다.",
    badge: "疏",
  },
];

export default function Onboarding({ onDone }: Props) {
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
      <button className="onboarding-skip" onClick={skip}>건너뛰기</button>

      <div className="onboarding-body">
        <div className="onboarding-badge">{cur.badge}</div>
        <h1 className="onboarding-title">{cur.title}</h1>
        <p className="onboarding-text">{cur.body}</p>
      </div>

      <div className="onboarding-footer">
        <div className="onboarding-dots">
          {PAGES.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === page ? "on" : ""}`} />
          ))}
        </div>
        <button className="onboarding-next" onClick={next}>
          {isLast ? "장부 펼치기" : "다음"}
        </button>
      </div>
    </div>
  );
}

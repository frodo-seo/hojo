# Hojo

🇰🇷 한국어 · [🇬🇧 English](README.en.md)

> 수기 입력 없이, 스크린샷 한 장으로.
> 내 데이터는 내 기기에. AI는 내 API 키로.

**Hojo**는 서버 없이 돌아가는 **이미지 전용 가계부 + 포트폴리오 트래커**입니다. 지출·수입·자산 — 모든 기록은 스크린샷 업로드로 시작합니다. 영수증, 결제 화면, 급여명세, 증권/거래소 화면을 올리면 OCR과 Claude가 읽어서 자동으로 분류·파싱합니다. 장부는 기기 IndexedDB에만 저장되며, AI·OCR은 사용자가 직접 발급한 API 키로 동작합니다.

---

## 원칙

- **이미지 전용 입력** — 금액·카테고리·티커를 직접 타이핑하지 않습니다. 스크린샷을 올리면 OCR → 분류 → 파싱이 끝까지 돌고, 확인 단계에서 필요한 값만 바로잡으면 됩니다.
- **BYOK (Bring Your Own Key)** — Anthropic·Datalab 키를 사용자 본인 계정에서 발급해 로컬에 저장. 제공자 인프라 의존 없음.
- **로컬 우선** — 거래·자산·리포트·설정은 기기 IndexedDB에만 저장. 클라우드 동기화·계정 가입 없음.
- **월간·연간 리포트** — Claude가 누적된 거래·자산 데이터를 읽고 구조화된 요약을 생성.
- **오픈소스 (MIT)** — 전체 코드 공개. 포크·수정·재배포 자유.

---

## 동작 방식

```
[스크린샷 + 선택적 힌트]
  └─ Chandra OCR (Datalab)         → 마크다운 텍스트
       └─ Classifier Agent (Haiku) → expense / income / fixed_expense / fixed_income / asset_trade
            └─ 도메인 파서 (Sonnet) → 구조화된 필드
                 └─ 사용자 확인     → IndexedDB 저장
```

한 장의 스크린샷으로 커버하는 범위:

- 영수증·카드 승인·배달 앱 → 지출
- 중고거래 입금·환불·배당 → 수입
- 통신비·월세·구독 → 고정 지출
- 급여명세서·정기 이체 → 고정 수입
- 증권사·거래소·금 시세 화면 → 자산 보유/매매 (한 장에 여러 종목도 한 번에 인식)
- 힌트란에 "커피만 지출로 넣어줘" 같은 지시를 적으면 파서가 반영합니다.

---

## 설치

### Android

1. [Releases](https://github.com/frodo-seo/hojo/releases)에서 최신 APK 다운로드
2. "출처를 알 수 없는 앱 설치" 허용 (설정 → 보안)
3. APK 실행 → 설치

### 최초 설정

앱 실행 후 **설정 → API 키**에서 다음 두 개를 입력합니다.

- **Anthropic API 키** — 분류·파싱·리포트용. [console.anthropic.com](https://console.anthropic.com/)에서 발급.
- **Datalab API 키** — Chandra OCR용. [datalab.to](https://www.datalab.to/)에서 발급.

키는 기기 내부에만 저장되며, Hojo 서버로 전송되지 않습니다 (Hojo는 서버 자체가 없습니다).

---

## 기능

- **스크린샷 단일 진입점** — 영수증·결제·급여명세·청구서·증권/거래소 화면을 자동 분류
- **자산 OCR 다중 종목** — 한 장의 스크린샷에 여러 종목이 있어도 한 번에 파싱
- 지출·수입·고정 지출·고정 수입·자산 매매 5종 자동 분류
- 자산 포트폴리오: 주식/ETF·암호화폐·원자재(금/은/플래티넘) 실시간 시세, 평단가·평가액·손익 표시
- 기준통화 환산 순자산 집계 + 파이차트
- 월별 예산 설정 및 사용 현황
- 일간·월간·연간 AI 리포트 (Claude) — 매일 아침 데일리 브리핑 포함
- 다국어 (한국어 / English) + AI 리포트 언어 연동
- 저녁 9시 기록 리마인더
- CSV 내보내기

---

## 빌드 (개발자용)

### 요구 사항

- Node.js 20+
- Android Studio (Android 빌드 시)

### 웹 개발

```bash
git clone https://github.com/frodo-seo/hojo.git
cd hojo
npm install
npm run dev
```

### Android 빌드

```bash
npm run mobile:sync     # dist → android/ 동기화
npm run mobile:open     # Android Studio 열기
```

Android Studio에서 **Build → Generate Signed App Bundle / APK**로 APK/AAB 생성.

---

## 아키텍처

```
[Android APK]
  └─ Capacitor (WebView)
       ├─ React 19 + TypeScript
       ├─ IndexedDB               (거래·자산·리포트·설정)
       ├─ Preferences             (API 키)
       └─ CapacitorHttp
            ├─ Datalab Chandra OCR
            ├─ Anthropic (Haiku 분류 / Sonnet 파싱·리포트)
            ├─ Yahoo Finance · Stooq (주식·원자재 시세)
            ├─ CoinGecko (암호화폐 시세)
            └─ Frankfurter (환율)
```

- **백엔드 서버 없음.** 앱이 직접 외부 API에 요청합니다.
- **최소 전송.** AI 호출 시 OCR 텍스트와 거래 통계 요약만 전송되며, 이미지 원본은 OCR 직후 폐기됩니다.

---

## 라이선스

MIT License. 자유롭게 포크·수정·재배포하세요.

---

## 면책

- Hojo는 재무·투자 조언을 제공하지 않습니다. AI 리포트와 시세 정보는 참고용이며, 금융 결정은 전문가와 상의하세요.
- Anthropic·Datalab API 사용료는 사용자 본인이 부담합니다.
- 앱 사용으로 발생한 데이터·금전 손실에 대해 개발자는 책임지지 않습니다.

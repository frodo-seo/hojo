# 호조(戶曹)

> 조선시대 호조판서가 당신의 한 달 가계를 친히 살펴 **상소문**으로 올려드립니다.
> AI가 영수증·결제 알림을 자동으로 읽고, 월말에 장계(狀啓)를 바치는 **개인 금융 앱**.

**호조**는 오픈소스 가계부 앱입니다. 서버가 없고, 당신의 기기에서만 돌아가며, AI 기능은 당신이 직접 발급한 API 키로 동작합니다. 어느 누구도, 만든 사람조차 당신의 장부를 볼 수 없습니다.

---

## 왜 호조인가

- **BYOK (Bring Your Own Key)** — Anthropic·Datalab 키를 당신 지갑으로. 앱 제공자의 인프라에 의존하지 않음.
- **로컬 우선** — 모든 거래·리포트는 기기 내 IndexedDB에만 저장. 클라우드 동기화 없음.
- **자동 입력** — 결제 알림을 AI가 읽고 자동 분류. 영수증은 카메라로 찍어서 OCR.
- **매달 상소문** — 호조판서 페르소나의 AI가 당신의 소비를 구체적 숫자로 치하·간언.
- **오픈소스 (MIT)** — 코드 전부 공개. 포크·수정·재배포 자유.

---

## 설치

### Android

1. [Releases](https://github.com/frodo-seo/hojo/releases)에서 최신 APK 다운로드
2. "출처를 알 수 없는 앱 설치" 허용 (설정 → 보안)
3. APK 실행 → 설치

> Play Store 등록은 추후 예정.

### 최초 설정

앱 실행 후 **설정 → API 키** 에서 다음 두 개를 입력하세요.

- **Anthropic API 키** — AI 분석·영수증 파싱용. [console.anthropic.com](https://console.anthropic.com/)에서 발급.
- **Datalab API 키** — 영수증 OCR용. [datalab.to](https://www.datalab.to/)에서 발급.

키는 당신의 기기에만 저장됩니다.

---

## 기능

### 현재 (v1.0)

- 지출·수입 기록 (카테고리·메모·날짜)
- 고정 수입/지출 (월정액, 월급 등)
- 월별 예산 설정 · 사용 현황
- 영수증·결제 캡쳐 OCR 자동 파싱
- 월간·연간 AI 상소문 리포트
- 저녁 9시 기록 알림
- CSV 장부 내보내기
- 한지·먹 톤 디자인 / 호조판서 페르소나

### 준비 중

- **결제 알림 자동 파싱** — 카드·페이 결제 알림을 AI가 읽고 자동 입력
- **구독 자동 감지** — 매월 반복 결제를 구독 목록으로 정리
- **이상 지출 경고** — 평소 대비 과한 소비를 상소로 알림
- **CSV 가져오기** — 카드사 명세서 일괄 업로드
- **Gmail 영수증 연동** — 쿠팡·배민·스벅 등 이메일 영수증 자동 수집
- **다국어** (i18n) — 영문 지원

---

## 빌드 (개발자용)

### 요구 사항

- Node.js 20+
- Android Studio (Android 빌드 시)
- Anthropic·Datalab API 키 (테스트용, 선택 — 실행 후 앱 설정 → API 키에 입력)

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

Android Studio에서 **Build → Generate Signed App Bundle / APK** 로 APK/AAB 생성.

키스토어 설정은 `android/key.properties.example`을 참고하세요.

---

## 아키텍처

```
[Android APK]
  └─ Capacitor (웹뷰)
       ├─ React + TypeScript
       ├─ IndexedDB        (거래·리포트·설정)
       ├─ Preferences      (API 키, 암호화 저장)
       ├─ NotificationListener   (결제 알림 수신, Kotlin)
       └─ CapacitorHttp    → Datalab · Anthropic
```

- **백엔드 서버 없음.** 앱이 직접 Datalab·Anthropic에 요청.
- **데이터 전송 없음.** 로컬 DB에 저장되고, AI 요청 시에만 최소 정보(OCR 텍스트, 통계 요약)를 Anthropic에 보냄. 이미지 원본도 OCR 직후 폐기.

---

## 기여

호조를 더 좋게 만드는 데 함께해주세요.

- **알림 파싱 패턴** — 본인이 쓰는 카드·페이 앱 알림 포맷 등록
- **카테고리 규칙** — 가맹점명 자동 분류 규칙 개선
- **테마** — 기본 한지·먹 외 스킨 제안
- **번역** — 영문 등 다국어 리소스
- **버그·UX** — Issue로 리포트

기여 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고.

---

## 라이선스

MIT License. 자유롭게 포크·수정·재배포하세요.

---

## 면책

- 호조는 어떤 형태의 재무 조언도 제공하지 않습니다. AI 상소문은 전적으로 참고용이며, 중요한 금융 결정은 전문가와 상의하세요.
- Anthropic·Datalab API 사용료는 사용자 본인이 부담합니다.
- 본 앱 사용으로 발생한 데이터 손실·금전 손실에 대해 개발자는 책임지지 않습니다.

# Hojo

> 내 데이터는 내 기기에. AI는 내 API 키로.
> 지출·수입을 기록하고, 영수증을 스캔하고, 월말 리포트를 받는 **오픈소스 개인 금융 앱**.

**Hojo**는 서버 없이 돌아가는 가계부입니다. 모든 장부는 기기 내부 DB에만 저장되며, AI 기능은 사용자가 직접 발급한 API 키로 동작합니다. 운영자를 포함해 어느 누구도 사용자의 거래 내역에 접근할 수 없습니다.

---

## 원칙

- **BYOK (Bring Your Own Key)** — Anthropic·Datalab 키를 사용자 본인 계정에서 발급해 로컬에 저장. 제공자 인프라에 의존하지 않습니다.
- **로컬 우선** — 모든 거래·리포트·설정은 기기 IndexedDB에만 저장. 클라우드 동기화·계정 가입 없음.
- **자동 입력** — 영수증 카메라 OCR, 결제 알림 파싱(준비 중)으로 입력 부담 최소화.
- **월간·연간 리포트** — Claude가 거래 통계를 읽고 구조화된 요약을 생성.
- **오픈소스 (MIT)** — 전체 코드 공개. 포크·수정·재배포 자유.

---

## 설치

### Android

1. [Releases](https://github.com/frodo-seo/hojo/releases)에서 최신 APK 다운로드
2. "출처를 알 수 없는 앱 설치" 허용 (설정 → 보안)
3. APK 실행 → 설치

F-Droid 등록은 준비 중입니다.

### 최초 설정

앱 실행 후 **설정 → API 키**에서 다음 두 개를 입력합니다.

- **Anthropic API 키** — AI 리포트·영수증 파싱용. [console.anthropic.com](https://console.anthropic.com/)에서 발급.
- **Datalab API 키** — 영수증 OCR용. [datalab.to](https://www.datalab.to/)에서 발급.

키는 기기 내부에만 저장되며, Hojo 서버로 전송되지 않습니다 (Hojo는 서버 자체가 없습니다).

---

## 기능

### 현재 (v1.0)

- 지출·수입 기록 (카테고리·메모·날짜)
- 고정 수입/지출 (월정액, 월급 등)
- 월별 예산 설정 및 사용 현황
- 영수증 카메라 OCR 자동 파싱 (Datalab + Claude)
- 월간·연간 AI 리포트
- 저녁 9시 기록 리마인더
- CSV 내보내기

### 준비 중

- **결제 알림 자동 파싱** — 카드·페이 결제 알림을 AI가 읽고 자동 입력
- **구독 자동 감지** — 반복 결제를 구독 목록으로 정리
- **이상 지출 감지** — 평소 대비 과한 소비 알림
- **CSV 가져오기** — 카드사 명세서 일괄 업로드
- **Gmail 영수증 연동** — 이메일 영수증 자동 수집
- **다국어 (i18n)** — 영문 지원

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

Android Studio에서 **Build → Generate Signed App Bundle / APK**로 APK/AAB 생성. 키스토어 설정은 `android/key.properties.example`을 참고하세요.

---

## 아키텍처

```
[Android APK]
  └─ Capacitor (WebView)
       ├─ React + TypeScript
       ├─ IndexedDB               (거래·리포트·설정)
       ├─ Preferences             (API 키, 암호화 저장)
       ├─ NotificationListener    (결제 알림 수신, Kotlin)
       └─ CapacitorHttp           → Datalab · Anthropic
```

- **백엔드 서버 없음.** 앱이 직접 Datalab·Anthropic에 요청합니다.
- **최소 전송.** AI 호출 시에만 필요한 최소 정보(OCR 텍스트, 통계 요약)가 Anthropic으로 전송되며, 영수증 이미지 원본은 OCR 직후 폐기됩니다.

---

## 기여

- **알림 파싱 패턴** — 카드·페이 앱 알림 포맷 등록
- **카테고리 규칙** — 가맹점명 자동 분류 규칙 개선
- **번역** — 영문 등 다국어 리소스
- **버그·UX** — Issue로 리포트

기여 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

---

## 라이선스

MIT License. 자유롭게 포크·수정·재배포하세요.

---

## 면책

- Hojo는 재무 조언을 제공하지 않습니다. AI 리포트는 참고용이며, 중요한 금융 결정은 전문가와 상의하세요.
- Anthropic·Datalab API 사용료는 사용자 본인이 부담합니다.
- 앱 사용으로 발생한 데이터·금전 손실에 대해 개발자는 책임지지 않습니다.

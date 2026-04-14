import { useState } from "react";

const sections = [
  {
    id: "concept",
    tab: "콘셉트",
    title: "소비일기(가칭) — 내 소비가 이야기가 되는 곳",
    blocks: [
      {
        heading: "한줄 콘셉트",
        type: "text",
        body: "영수증 한 장 + 사진 한 장 = AI가 정리하고, 기억하고, 분석해드립니다\n\n이름은 추후 확정 예정 (소비일기 / receipto 등 후보 검토 중)",
      },
      {
        heading: "왜 사람들이 쓸까? — 이미 하고 있는 행동",
        type: "text",
        body: "핵심 인사이트: 사람들은 이미 밥 먹을 때 사진을 찍고 있습니다.\n\n음식 나오면 사진 찍고, 예쁜 카페 가면 사진 찍고, 여행지에서 사진 찍는 건 이미 일상이에요. 소비일기는 완전히 새로운 습관을 요구하지 않습니다. 기존에 하고 있는 행동(음식/장소 사진)에 영수증 한 장만 추가하면 됩니다.\n\n기존 가계부 앱이 실패한 이유: \"찍어봤자 쓸모가 없어서\"\n소비일기가 다른 이유: 찍는 순간 바로 가치가 생김\n→ 품목이 자동 분류되고\n→ 예쁜 스토리가 만들어지고\n→ 정산까지 되니까\n→ 오히려 \"찍고 싶어지는\" 서비스",
      },
      {
        heading: "서비스 철학",
        type: "text",
        body: "혼자 써도 충분하고, 같이 쓰면 더 좋은 서비스입니다.\n\n혼자 쓸 때 → 내 소비를 똑똑하게 관리하고, 특별한 순간을 기록하는 나만의 소비 다이어리\n같이 쓸 때 → 영수증 찍고 사진 찍으면 정산까지 끝나는 스마트 정산 + 공유 추억",
      },
      {
        heading: "타겟 사용자 (우선순위 순)",
        type: "list",
        items: [
          "🥇 1순위: 혼자 소비를 관리하고 싶은 20~30대",
          "   → 마트/편의점 지출 분석, 맛집 기록, 월별 리포트",
          "   → 이미 음식 사진 찍는 습관 있음 — 영수증만 추가하면 끝",
          "🥈 2순위: 모임/회식이 잦은 직장인·대학생",
          "   → 더치페이 자동 정산 + 단체 사진 추억",
          "   → 단체사진은 이미 찍음 — 영수증만 추가하면 정산 완료",
          "🥉 3순위: 여행 그룹 (v2 확장)",
          "   → 여행 중 공동 경비 누적 정산 + 여행 일지",
        ],
      },
      {
        heading: "경쟁 우위",
        type: "list",
        items: [
          "기존 습관에 얹는 UX — 새로운 습관 강요 X",
          "국내 유일 품목 단위 AI 분류 + 소비 스토리 생성",
          "혼자 써도 가치 있는 소비 다이어리 + AI 코치",
          "같이 쓰면 영수증+사진으로 자동 정산",
          "Chandra OCR 85.9% SOTA + Claude AI 맥락 이해",
          "앱인토스 내 유사 서비스 없음 — 선점 기회",
        ],
      },
    ],
  },
  {
    id: "solo",
    tab: "혼자 쓸 때",
    title: "솔로 모드 — 서비스의 핵심",
    blocks: [
      {
        heading: "시나리오 1: 일상 소비 관리",
        type: "text",
        body: "퇴근길에 편의점에서 간식을 샀다.\n영수증 찍으면 → \"새우깡 1,500원 → 간식, 삼각김밥 1,200원 → 식사대용\"\n자동 분류되고 월말에 \"이번 달 편의점 간식 32,000원, 지난달보다 8,000원 줄었어요 👍\" 인사이트가 뜬다.",
      },
      {
        heading: "시나리오 2: 나만의 맛집 기록",
        type: "text",
        body: "혼밥으로 찾은 숨은 라멘 맛집.\n영수증 찍고 + 라멘 사진 찍으면\n→ \"화요일 점심, 골목 끝 라멘 한 그릇의 위로\"\n→ 태그: #혼밥 #라멘 #점심맛집\n나중에 타임라인에서 \"내가 올해 다녔던 맛집들\" 한눈에.",
      },
      {
        heading: "시나리오 3: 자취 장보기 최적화",
        type: "text",
        body: "이마트에서 일주일치 장을 봤다.\n영수증 찍으면 품목별로 쪼개져서\n→ 식재료 42,000원 / 생필품 15,000원 / 간식 8,000원\n→ \"지난주보다 간식 비중이 높아요. 장보기 전 목록 작성해보는 건 어때요?\"\nAI가 구체적이고 실용적인 팁을 줌.",
      },
      {
        heading: "시나리오 4: 기념일 / 특별한 날",
        type: "text",
        body: "생일에 혼자 케이크를 샀다.\n영수증 + 케이크 사진\n→ \"서른 번째 봄, 나를 위한 딸기 케이크\"\n→ 1년 뒤 타임라인 알림: \"작년 오늘, 이런 소비를 하셨어요\"",
      },
      {
        heading: "솔로 모드 핵심 기능",
        type: "list",
        items: [
          "📸 영수증 스캔 → Chandra OCR → 품목/금액 자동 추출",
          "🏷️ AI 자동 분류 → 20+개 카테고리 (식비/카페/교통/생활 등)",
          "📝 사진 첨부 시 → AI 감성 스토리 자동 생성",
          "📊 대시보드 → 카테고리별 차트 + 주간/월간 트렌드",
          "💬 AI 소비 코치 → \"이번 달 카페 지출 얼마야?\" 자연어 질의",
          "📅 타임라인 → 날짜별 소비 기록 + 사진 스크롤",
          "🔔 인사이트 알림 → \"커피 지출 3주 연속 증가\" 등",
        ],
      },
    ],
  },
  {
    id: "together",
    tab: "같이 쓸 때",
    title: "투게더 모드 — 정산 + 공유 추억",
    blocks: [
      {
        heading: "킬러 시나리오: 회식 정산",
        type: "text",
        body: "금요일 밤, 친구 5명이서 고깃집.\n내가 계산했다. 단톡방에 \"얼마씩이야?\" 올리기 귀찮다.\n\n영수증 찍고 → 단체사진 올리면\n→ Claude Vision이 사진에서 5명 감지\n→ 총 65,000원 ÷ 5명 = 1인당 13,000원\n→ \"금요일 밤, 다섯 명의 삼겹살 동맹\"\n→ 정산 카드 자동 생성 → 단톡방에 공유. 끝.",
      },
      {
        heading: "정산 방식",
        type: "list",
        items: [
          "① 균등 분배: 총액 ÷ 인원수 (가장 심플)",
          "② 스마트 분배: Claude가 품목 보고 제안",
          "   → \"소주 3병은 3명만 마셨으면 분리 가능해요\"",
          "③ 커스텀: 품목별로 인원 직접 지정",
        ],
      },
      {
        heading: "인원 감지 로직",
        type: "list",
        items: [
          "단체사진 업로드 → Claude Vision → 인원수 자동 감지",
          "\"5명이 맞나요?\" 확인 UI → 수정 가능",
          "사진 없이 직접 인원수 입력도 가능 (폴백)",
        ],
      },
      {
        heading: "공유 카드 & 바이럴",
        type: "list",
        items: [
          "정산 카드: 단체사진 + 스토리 + 1인당 금액",
          "\"소비일기로 정산했어요\" 워터마크 → 자연 바이럴",
          "카카오톡 / 인스타 스토리 / 이미지 저장 공유",
          "단톡방 멤버 4~9명 노출 → 유저 획득 비용 0원",
        ],
      },
      {
        heading: "v2 확장: 여행 그룹 정산",
        type: "text",
        body: "여행 그룹을 만들고 멤버 등록 → 여행 중 누가 결제하든 영수증+사진 올리면 누적 정산 → 마지막 날 최종 정산표 + 여행 포토북 자동 완성\n\n(MVP 이후 확장 기능으로 개발)",
      },
    ],
  },
  {
    id: "flow",
    tab: "UX 플로우",
    title: "하나의 플로우, 자동 분기",
    blocks: [
      {
        heading: "통합 플로우",
        type: "text",
        body: "사용자는 항상 같은 동작을 합니다: 영수증을 찍는다.\n그 다음 행동에 따라 AI가 자동으로 모드를 제안합니다.\n\n영수증만 찍음 → 일상 소비 분석\n영수증 + 음식/풍경 사진 → 추억 기록 제안\n영수증 + 단체사진 → 정산 모드 제안\n\n사용자가 모드를 고르는 게 아니라,\n자연스러운 행동이 모드를 결정합니다.",
      },
      {
        heading: "화면 플로우 상세",
        type: "list",
        items: [
          "① 홈 화면: 최근 기록 리스트 + \"영수증 찍기\" 버튼",
          "② 영수증 촬영: 카메라 or 갤러리",
          "③ OCR 결과 미리보기: 품목/금액 확인 + 수정",
          "④-A 사진 없음 → 자동 분류 결과 표시 (일상 모드)",
          "④-B 사진 첨부 → 사진 종류 감지",
          "⑤-B1 단체사진 → 인원 감지 → 정산 모드",
          "⑤-B2 음식/풍경 → 스토리 생성 → 추억 모드",
          "⑥ 결과 저장 + 선택적 공유",
        ],
      },
      {
        heading: "핵심 UX 원칙",
        type: "list",
        items: [
          "최소 터치: 영수증 찍고 사진 올리면 나머지는 AI가 처리",
          "강제 선택 없음: 모드를 고르라고 하지 않음, AI가 제안",
          "언제든 수정: AI 결과는 항상 편집 가능",
          "점진적 공개: 처음엔 심플하게, 탭하면 상세 펼침",
        ],
      },
    ],
  },
  {
    id: "tech",
    tab: "기술 스택",
    title: "기술 아키텍처 & 비용",
    blocks: [
      {
        heading: "프론트엔드",
        type: "list",
        items: [
          "Vite + React + TypeScript",
          "@apps-in-toss/web-framework SDK 2.x",
          "TDS (토스 디자인 시스템)",
          "Recharts: 지출 차트",
          "Canvas API: 공유 카드 이미지 생성",
        ],
      },
      {
        heading: "백엔드",
        type: "list",
        items: [
          "Next.js API Routes → Vercel 서버리스 배포",
          "영수증 → Chandra API → 품목 JSON",
          "사진 → Claude Vision → 인원 감지 / 사진 분류",
          "JSON + 컨텍스트 → Claude → 분류 / 스토리 / 정산",
        ],
      },
      {
        heading: "AI 파이프라인",
        type: "list",
        items: [
          "1단: Chandra OCR → 영수증 구조화 (가게명, 품목, 금액)",
          "2단: Claude Vision → 사진 분석 (인원수 or 음식/풍경 분류)",
          "3단: Claude Text → 모드별 처리",
          "   → 일상: 카테고리 분류 + 인사이트",
          "   → 추억: 감성 스토리 + 태그 생성",
          "   → 정산: 금액 계산 + 스토리 + 분배 제안",
        ],
      },
      {
        heading: "인프라 & 비용",
        type: "list",
        items: [
          "프론트 호스팅: 토스 CDN (앱인토스) → 무료",
          "백엔드: Vercel 서버리스 → 무료 티어",
          "DB: Supabase → 무료 (500MB DB + 1GB Storage)",
          "OCR: Chandra → $24 무료 크레딧",
          "AI: Claude API → 건당 3~5원, 초기 월 2~3만원",
          "총 초기비용: 사실상 0원",
          "월 운영비: Claude API 비용만 (광고 수익으로 커버)",
        ],
      },
    ],
  },
  {
    id: "roadmap",
    tab: "로드맵",
    title: "2주 개발 계획",
    blocks: [
      {
        heading: "Week 1: MVP 개발",
        type: "list",
        items: [
          "Day 1~2: 환경 셋업 + AI 파이프라인",
          "   → 프로젝트 초기화 (Vite + React + 앱인토스 SDK)",
          "   → Chandra OCR 연동 + Claude 분류/스토리 프롬프트",
          "   → Supabase 스키마 + Storage",
          "   → ✅ 영수증 → 분류+스토리 동작 확인",
          "",
          "Day 3~4: 핵심 UI",
          "   → 영수증 촬영/업로드 화면",
          "   → 사진 첨부 + 자동 모드 감지",
          "   → 일상 모드: 분류 결과 화면",
          "   → 추억 모드: 사진+스토리 카드",
          "   → ✅ 솔로 플로우 E2E 완성",
          "",
          "Day 5~6: 정산 + 대시보드",
          "   → 정산 모드: 인원 감지 + 금액 계산",
          "   → 공유 카드 생성",
          "   → 대시보드: 카테고리 차트 + 트렌드",
          "   → AI 코치 채팅",
          "   → ✅ 전체 3가지 모드 동작",
          "",
          "Day 7: 통합 테스트",
          "   → E2E 플로우 점검 (솔로 + 투게더)",
          "   → 에러/로딩/빈 상태 처리",
          "   → ✅ MVP 완성",
        ],
      },
      {
        heading: "Week 2: 폴리싱 + 출시",
        type: "list",
        items: [
          "Day 8~10: 디자인 + UX 다듬기",
          "   → TDS 가이드라인 맞춤",
          "   → 타임라인 뷰 구현",
          "   → 마이크로 인터랙션 추가",
          "",
          "Day 11~12: 최적화",
          "   → 이미지 압축 (업로드 전 리사이즈)",
          "   → API 응답 캐싱",
          "   → 앱인토스 샌드박스 실기기 테스트",
          "",
          "Day 13~14: 출시",
          "   → 앱인토스 콘솔 빌드 업로드",
          "   → 검수 제출 + 심사 대응",
          "   → ✅ 앱인토스 출시 완료",
        ],
      },
      {
        heading: "v2 확장 (출시 후)",
        type: "list",
        items: [
          "여행 그룹 정산 (누적 정산 + 여행 포토북)",
          "연말 리포트 (올해의 소비 스토리 — 바이럴 요소)",
          "맛집 지도 연동 (영수증 기반 나만의 맛집 아카이브)",
          "플레이스토어 독립 앱 출시",
        ],
      },
    ],
  },
  {
    id: "extras",
    tab: "확장 기능",
    title: "v1.5 추가 기능 — 계획 외 실용 피처",
    blocks: [
      {
        heading: "우선순위",
        type: "text",
        body: "MVP(3모드 + 정산 카드 + Stats) 완성 이후 사용자 피드백·자체 도그푸딩 결과를 반영해 붙일 실용 기능들입니다. 각 기능은 독립적이라 순서는 체감 가치 순으로 조정합니다.",
      },
      {
        heading: "🎯 AI 소비 코치 (Phase 3 — 마지막 큰 피처)",
        type: "text",
        body: "Home 화면 상단에 질문 입력창. \"이번달 술에 얼마 썼어?\", \"저번달보다 카페 지출 줄었어?\", \"주말마다 얼마나 써?\" 같은 자연어 질의에 답한다.\n\n구현 방식: Claude tool use (function calling) — 자세한 내용은 AI 설계 탭 참고. raw SQL을 Claude가 쓰게 하는 text2SQL은 안전성 문제로 채택하지 않음.",
      },
      {
        heading: "✏️ 영수증 상세 수정 / 삭제",
        type: "list",
        items: [
          "Result 화면에 [편집] / [삭제] 버튼",
          "OCR 오타 하나에 피보는 상황 방지 — 저장 후에도 가게/날짜/품목/카테고리 재편집 가능",
          "삭제는 확인 다이얼로그 + soft delete(선택)",
          "우선순위: 높음 — 실 사용 시 필수",
        ],
      },
      {
        heading: "💰 월 예산 & 진행률",
        type: "list",
        items: [
          "사용자가 이번달 목표 금액 설정 (예: 50만원)",
          "Home/Stats 상단에 진행률 바 + 남은 금액",
          "카테고리별 예산도 가능 (식비 20만원 / 카페 5만원 등)",
          "80% / 100% 돌파 시 알림 (선택)",
        ],
      },
      {
        heading: "🏷️ 태그 필터 & 검색",
        type: "list",
        items: [
          "Timeline에서 태그 칩 클릭 → 같은 태그만 필터링 (#카페, #혼밥 등)",
          "상단 검색창: 가게 이름 / 품목명으로 검색",
          "카테고리 / 모드 / 날짜 범위 조합 필터",
        ],
      },
      {
        heading: "🖼️ 영수증 원본 뷰어",
        type: "list",
        items: [
          "저장된 영수증 이미지를 Result 화면에서 확대 가능",
          "OCR 결과와 원본 대조 → 수정 시 편의성↑",
          "Supabase Storage에 이미 업로드된 public URL 재사용",
        ],
      },
      {
        heading: "📤 CSV 내보내기",
        type: "list",
        items: [
          "월별 또는 기간별 지출 데이터를 CSV로 다운로드",
          "기존 가계부 유저가 엑셀/구글시트에 백업할 때 유용",
          "컬럼: 날짜, 가게, 카테고리, 품목, 금액, 모드, 태그",
        ],
      },
      {
        heading: "개발 순서 제안",
        type: "list",
        items: [
          "1. AI 코치 (Phase 3) — 기획 핵심 차별점",
          "2. 영수증 수정/삭제 — 실사용 필수",
          "3. 월 예산 & 진행률 — 가계부 본연의 가치",
          "4. 태그 필터 & 검색 — 데이터 쌓인 뒤",
          "5. 영수증 원본 뷰어 — 작은 UX 개선",
          "6. CSV 내보내기 — 파워유저 대상",
        ],
      },
    ],
  },
  {
    id: "money",
    tab: "수익화",
    title: "수익화 전략",
    blocks: [
      {
        heading: "기본: 완전 무료 + 리워드 광고",
        type: "list",
        items: [
          "모든 핵심 기능 무료 — 진입 장벽 제로",
          "AI 분석/스토리 결과 전 15초 리워드 광고",
          "사용자가 자발적으로 시청 → 높은 eCPM",
          "DAU 5,000 기준: 월 75~300만원 광고 수익",
        ],
      },
      {
        heading: "선택: 프리미엄 구독 (추후)",
        type: "list",
        items: [
          "월 2,900원: 광고 제거 + 무제한 AI + 프리미엄 카드",
          "연말 리포트 프리미엄 버전",
          "커플/가족 공유 타임라인",
        ],
      },
      {
        heading: "바이럴 성장 엔진",
        type: "list",
        items: [
          "정산 카드 공유 → 단톡방 4~9명 자연 노출",
          "추억 카드 SNS 공유 → 인스타/카톡 바이럴",
          "\"소비일기로 정산했어요\" 워터마크",
          "연말 리포트 공유 → 연말 시즌 바이럴 폭발",
          "유저 획득 비용: 0원 (공유 카드가 광고)",
        ],
      },
      {
        heading: "비용 요약",
        type: "list",
        items: [
          "초기 비용: 0원 (모든 서비스 무료 티어)",
          "월 운영비: Claude API 2~3만원 (유일한 비용)",
          "손익분기: DAU 500명부터 광고로 API 비용 커버",
          "확장 시 플레이스토어 출시 → 코드 100% 재활용",
        ],
      },
    ],
  },
  {
    id: "prompt",
    tab: "AI 설계",
    title: "Claude 프롬프트 설계",
    blocks: [
      {
        heading: "사진 분류 프롬프트 (Vision)",
        type: "code",
        body: `이 사진을 분석해주세요.

[판단 기준]
1. 여러 명의 사람이 보이면 → "group"
2. 음식/음료 사진이면 → "food"  
3. 풍경/장소 사진이면 → "place"
4. 기타 → "other"

[응답 - JSON만]
{
  "type": "group",
  "person_count": 5,
  "confidence": "high",
  "description": "식당에서 5명이 함께 식사 중"
}`,
      },
      {
        heading: "일상 분류 프롬프트",
        type: "code",
        body: `영수증 품목을 분류하고 인사이트를 제공하세요.

[입력] { store, date, items[], total }

[응답 - JSON만]
{
  "items": [
    {"name":"...", "price":0,
     "major":"식비", "minor":"간식"}
  ],
  "tags": ["#편의점", "#야식"],
  "insight": "한줄 인사이트"
}`,
      },
      {
        heading: "추억 스토리 프롬프트",
        type: "code",
        body: `영수증+사진 맥락으로 한줄 스토리를 만드세요.

[규칙]
- 20자 내외, 담백한 에세이 감성
- 혼자인 경우: 나만의 시간의 가치를 담을 것
- 여럿인 경우: 관계의 따뜻함을 담을 것

[응답 - JSON만]
{
  "story": "화요일 점심, 골목 끝 라멘 한 그릇의 위로",
  "tags": ["#혼밥", "#라멘", "#점심맛집"],
  "mood": "peaceful"
}`,
      },
      {
        heading: "정산 프롬프트",
        type: "code",
        body: `영수증 품목과 인원수로 정산을 계산하세요.

[입력] { store, items[], total, party_size }

[응답 - JSON만]
{
  "equal_split": 13000,
  "smart_split": {
    "suggestion": "소주 미포함 정산 가능",
    "note": "음주 여부 확인 필요"
  },
  "story": "금요일 밤, 다섯 명의 삼겹살 동맹",
  "tags": ["#회식", "#금요일밤"]
}`,
      },
      {
        heading: "AI 코치 — tool use 방식 (NOT text2SQL)",
        type: "text",
        body: "AI 코치는 Claude의 tool use(function calling)로 구현합니다.\n\n왜 text2SQL이 아닌가:\n- Claude가 직접 SQL을 작성 → 실행하면 SQL 인젝션 / 파괴 쿼리 / RLS 우회 위험\n- 스키마 변경 시 프롬프트 전체를 다시 학습시켜야 함\n- 불확실한 쿼리를 프로덕션 DB에 실행하는 건 도박\n\ntool use 방식:\n- 서버가 Claude에게 '사용 가능한 함수 목록'을 미리 정의해서 전달\n- Claude는 사용자 질문을 보고 어떤 함수를, 어떤 인자로 호출할지 JSON으로 응답\n- 서버가 실제 코드로 안전하게 실행 (user_id 강제 필터링)\n- 결과를 Claude에게 돌려주면 자연어 답변 생성\n- Claude가 여러 번 연쇄 호출도 가능 (예: 카페 합계 + 주류 합계 → 비교 답변)",
      },
      {
        heading: "AI 코치 툴 정의 (예시)",
        type: "code",
        body: `// 서버가 Claude에게 넘기는 tools 배열
[
  {
    name: "queryReceipts",
    description: "영수증 합계/건수/리스트를 조회",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string",
          enum: ["식비","카페","주류","생활",
                 "교통","쇼핑","문화","기타"] },
        dateFrom: { type: "string", format: "date" },
        dateTo:   { type: "string", format: "date" },
        mode: { type: "string",
          enum: ["daily","memory","settle"] }
      }
    }
  },
  {
    name: "getMonthTotal",
    description: "특정 월의 총액과 카테고리별 분포",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string",
                 description: "YYYY-MM" }
      },
      required: ["month"]
    }
  },
  {
    name: "compareMonths",
    description: "두 달을 비교",
    input_schema: {
      type: "object",
      properties: {
        monthA: { type: "string" },
        monthB: { type: "string" }
      },
      required: ["monthA","monthB"]
    }
  }
]

// 사용자: "이번달 술 얼마 썼어?"
// → Claude가 queryReceipts({
//     category: "주류",
//     dateFrom: "2026-04-01",
//     dateTo:   "2026-04-30"
//   }) 호출
// → 서버가 Supabase에서 직접 조회 후 결과 반환
// → Claude가 자연어로 답변 생성`,
      },
      {
        heading: "AI 코치 시스템 프롬프트",
        type: "code",
        body: `당신은 '소비일기' AI 소비 코치입니다.

[규칙]
- 존댓말, 격려 톤, 비난 금지
- 구체적 숫자 + 비교 데이터 포함
- 실행 가능한 팁 1개 반드시 포함
- 혼자 쓴 돈: 실용적 절약 조언
- 특별한 날 지출: 절약 대상 아님
  → "좋은 시간 보내셨네요" ✅
  → "너무 많이 쓰셨네요" ❌
- 추억 모드 소비: 긍정적으로 반응`,
      },
    ],
  },
];

const C = { h: 24, s: 72, l: 52 };

export default function PlanV4() {
  const [active, setActive] = useState("concept");
  const cur = sections.find((s) => s.id === active);

  return (
    <div style={{
      fontFamily: '"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,sans-serif',
      background: "var(--color-background-primary)",
      color: "var(--color-text-primary)",
      minHeight: "100vh",
    }}>
      <div style={{
        background: `linear-gradient(155deg, hsl(${C.h},60%,96%) 0%, hsl(${C.h+20},50%,94%) 50%, hsl(${C.h+40},45%,95%) 100%)`,
        padding: "1.8rem 1.5rem 1.3rem",
        borderRadius: "0 0 20px 20px",
      }}>
        <span style={{
          display: "inline-block", fontSize: "10px", fontWeight: 700,
          color: `hsl(${C.h},${C.s}%,${C.l}%)`,
          background: `hsl(${C.h},${C.s-20}%,92%)`,
          padding: "2px 9px", borderRadius: "8px", marginBottom: "8px",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>기획서 v4 · 앱인토스 미니앱</span>
        <h1 style={{
          fontSize: "26px", fontWeight: 800, margin: "0 0 3px",
          color: `hsl(${C.h},${C.s-15}%,20%)`, lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}>소비일기 <span style={{fontSize:"14px",fontWeight:400,opacity:0.5}}>(가칭)</span></h1>
        <p style={{ fontSize: "14px", color: `hsl(${C.h},22%,38%)`, margin: 0, fontWeight: 500 }}>
          내 소비가 이야기가 되는 곳
        </p>
        <p style={{ fontSize: "11px", color: `hsl(${C.h},15%,52%)`, margin: "2px 0 0" }}>
          혼자 써도 충분하고, 같이 쓰면 더 좋은
        </p>
      </div>

      <nav style={{
        display: "flex", gap: "4px", padding: "11px 10px 5px",
        overflowX: "auto", scrollbarWidth: "none",
      }}>
        {sections.map((s) => {
          const on = active === s.id;
          return (
            <button key={s.id} onClick={() => setActive(s.id)} style={{
              flex: "0 0 auto", padding: "5px 11px", borderRadius: "14px",
              border: on ? "none" : "1px solid var(--color-border-tertiary)",
              fontSize: "11.5px", fontWeight: on ? 650 : 400, cursor: "pointer",
              transition: "all 0.15s",
              background: on ? `hsl(${C.h},${C.s}%,${C.l}%)` : "transparent",
              color: on ? "#fff" : "var(--color-text-secondary)",
            }}>{s.tab}</button>
          );
        })}
      </nav>

      {cur && (
        <div style={{ padding: "0.5rem 1.3rem 2rem" }}>
          <h2 style={{
            fontSize: "16px", fontWeight: 750, marginBottom: "0.8rem", lineHeight: 1.35,
          }}>{cur.title}</h2>

          {cur.blocks.map((b, i) => {
            const hue = C.h + i * 25;
            const isCode = b.type === "code";
            return (
              <div key={i} style={{
                marginBottom: "0.8rem",
                background: "var(--color-background-secondary)",
                borderRadius: "11px",
                padding: "0.8rem 1rem",
                borderLeft: `3px solid hsl(${hue},45%,58%)`,
              }}>
                <h3 style={{
                  fontSize: "13px", fontWeight: 650, marginBottom: "6px",
                  color: `hsl(${hue},35%,40%)`,
                }}>{b.heading}</h3>

                {(b.type === "text" || b.type === "code") && b.body && (
                  <pre style={{
                    fontSize: isCode ? "10.5px" : "12px",
                    lineHeight: isCode ? 1.55 : 1.75,
                    color: "var(--color-text-secondary)",
                    margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    fontFamily: isCode ? "var(--font-mono)" : "inherit",
                    background: isCode ? "var(--color-background-tertiary)" : "transparent",
                    padding: isCode ? "10px" : "0",
                    borderRadius: isCode ? "8px" : "0",
                  }}>{b.body}</pre>
                )}

                {b.type === "list" && b.items && (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {b.items.map((item, j) => {
                      if (item === "") return <li key={j} style={{ height: "8px" }} />;
                      const ms = item.startsWith("✅");
                      const indent = item.startsWith("   ");
                      return (
                        <li key={j} style={{
                          fontSize: "11.5px", lineHeight: 1.8,
                          color: ms ? "hsl(150,48%,33%)" : "var(--color-text-secondary)",
                          fontWeight: ms ? 600 : 400,
                          paddingLeft: indent ? "24px" : "14px",
                          position: "relative",
                        }}>
                          {!indent && !ms && (
                            <span style={{
                              position: "absolute", left: 0,
                              color: `hsl(${hue},30%,60%)`, fontSize: "10px",
                            }}>›</span>
                          )}
                          {item}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        padding: "0 1.3rem 2rem", textAlign: "center",
        fontSize: "10.5px", color: "var(--color-text-tertiary)",
      }}>8개 탭을 넘기며 확인하세요</div>
    </div>
  );
}

# F-Droid 제출 메모

이 디렉토리는 F-Droid 메인 저장소(`fdroiddata`)에 Hojo를 등록할 때 사용할 빌드 레시피 초안입니다.

## 제출 흐름

1. GitHub에서 `v0.1.0` 태그를 찍고 릴리즈 생성 (서명된 APK 업로드는 선택).
2. `fdroiddata` 저장소 포크:
   - https://gitlab.com/fdroid/fdroiddata
3. `metadata/com.hojo.app.yml` 위치에 [com.hojo.app.yml](./com.hojo.app.yml) 복사.
4. F-Droid 빌드 서버에서 `fdroid build com.hojo.app:1` 로컬 테스트.
5. Merge Request 작성 → 리뷰 대기.

## 체크리스트

- [ ] 모든 의존성이 FOSS인지 확인 (Capacitor, React, lucide-react, Recharts 등 OK)
- [ ] `AntiFeatures` 필요 여부: Anthropic/Datalab API 호출은 사용자 선택이므로 `NonFreeNet` 해당 가능성 있음 → 제출 시 메인테이너와 논의
- [ ] 재현 가능한 빌드: `npm ci`로 잠긴 의존성 설치하는지 확인 (`package-lock.json` 커밋 필요)
- [ ] 서명 지문: F-Droid가 자체 서명하므로 업스트림 서명과 별도

## 관련 링크

- Inclusion policy: https://f-droid.org/docs/Inclusion_Policy/
- Build metadata reference: https://f-droid.org/docs/Build_Metadata_Reference/

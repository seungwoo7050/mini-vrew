# 🎬 Vrew Portfolio - 웹 기반 AI 비디오 편집기

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/FFmpeg-WASM-007808?style=flat-square&logo=ffmpeg" alt="FFmpeg" />
  <img src="https://img.shields.io/badge/WebGL-2.0-990000?style=flat-square&logo=webgl" alt="WebGL" />
</p>

> **브라우저에서 동작하는 프론트사이드 비디오 편집 솔루션**  
> FFmpeg WASM으로 로컬 비디오 처리, WebGL 실시간 필터지원

---

## 주요 기능

### 비디오 플레이어
- 커스텀 플레이어 컨트롤 (재생/일시정지, 볼륨, 전체화면)
- 키보드 단축키 지원 (Space, 방향키, M, F)
- 반응형 레이아웃 및 에러 처리

### 파형(Waveform) 시각화
- **Web Audio API** 기반 오디오 디코딩
- Canvas 기반 실시간 파형 렌더링
- 줌/스크롤/클릭 상호작용
- RMS 및 Peak 모드, 피라미드 레벨 지원

### 트리밍 기능
- 드래그 가능한 트림 핸들
- 파형 기반 시작/종료 지점 선택
- 자동 추천 알고리즘 (하이라이트/무음 구간)
- 구간 반복(Loop) 모드

### 자막 시스템
- 자막 목록 편집 UI
- 단어 단위 편집 및 경계 조정
- 타임라인 시각화 및 동기화
- 자막 CRUD (생성/수정/삭제)

### 비디오 필터 (WebGL)
- 밝기, 대비, 채도 조절
- GLSL 셰이더 기반 실시간 미리보기
- GPU 가속 렌더링

### 썸네일 생성
- 비디오 프레임 기반 썸네일 자동 생성
- 쿼리 기반 캐싱 및 관리

### 비디오 관리
- 비디오 목록 조회 및 CRUD 작업
- 로컬 저장소 연동 (IndexedDB)

### 비디오 내보내기
- **FFmpeg WASM** 브라우저 내 처리
- 트리밍 및 구간 제거
- 자막 번인 (ASS/drawtext)
- Web Worker 기반 비동기 처리

## 기술 스택

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 19.2 | UI 프레임워크 |
| TypeScript | 5.9 | 타입 안전성 |
| Vite | 7.2 | 빌드 도구 |
| TanStack Query | 5.x | 서버 상태 관리 |
| Dexie | 4.2 | IndexedDB 래퍼 |
| @ffmpeg/ffmpeg | 0.12 | 브라우저 비디오 처리 |
| React Router DOM | 7.x | 클라이언트 사이드 라우팅 |
| Subtitle | 4.2 | 자막 처리 유틸리티 |
| Vitest | 4.x | 단위/통합 테스트 |

### 저수준 기술
| 기술 | 용도 |
|------|------|
| Web Audio API | 오디오 디코딩, 파형 추출 |
| WebGL 2.0 | GPU 가속 필터 |
| Web Workers | 백그라운드 처리 |
| SharedArrayBuffer | 워커 간 메모리 공유 |
| requestIdleCallback | 점진적 계산 |

---

## 프로젝트 구조

```
├── src/
│   ├── app/              # 앱 진입점, 라우터, 프로바이더
│   ├── pages/            # 페이지 컴포넌트
│   ├── features/         # 기능별 모듈
│   │   ├── playback/     # 비디오 플레이어
│   │   ├── waveform/     # 파형 시각화
│   │   ├── captions/     # 자막 편집
│   │   ├── filters/      # WebGL 필터
│   │   ├── export/       # FFmpeg 내보내기
│   │   ├── upload/       # 파일 업로드
│   │   ├── thumbnails/   # 썸네일 생성
│   │   └── videos/       # 비디오 관리
│   ├── data/             # API, 타입, 쿼리
│   ├── lib/              # 유틸리티 라이브러리
│   └── __tests__/        # Vitest 기반 테스트
├── scripts/              # 유틸리티 스크립트 (예: verify.sh)
└── public/
    └── ffmpeg-core/      # FFmpeg WASM 파일
```

---

## 시작하기

### 요구사항
- Node.js 20+

### 설치

```bash
# 의존성 설치
npm install
```

### 실행
```bash
# 프론트엔드 (포트 5173)
npm run dev

# 테스트 실행
npm run test

# 테스트 감시 모드
npm run test:watch
```

---

## 라이선스

MIT License
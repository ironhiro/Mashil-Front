# Mashil-Front

> **잠깐, 다녀와.**
> 한국 공중·개방 화장실 데이터 기반 길찾기/평점/댓글 사이드 프로젝트의 프런트엔드.

Vite 6 + React 19 + TypeScript 5.7 + MUI 6 + Kakao Maps JS SDK.

백엔드: [Mashil-Back](https://github.com/) — ASP.NET Core 10 + EF Core 10 + PostGIS.

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 설정 — .env.example 을 복사해서 .env.local 작성
#    (.env.local 은 .gitignore 에 의해 절대 커밋되지 않습니다)
cp .env.example .env.local
# 그 다음 .env.local 을 열어서 VITE_KAKAO_MAP_KEY 에 본인 키 입력

# 3) 한글 웹폰트(서울남산체) 만들기 — 한 번만
#    서울서체는 재배포가 금지라 저장소에 넣지 않고, 공식 zip 에서 public/fonts 로 만든다
pip install fonttools brotli
python tool/make_fonts.py

# 4) 개발 서버
npm run dev
# → http://localhost:5173 (포트는 VITE_DEV_PORT 로 변경 가능)
```

백엔드(Mashil-Back)가 다른 포트/호스트에 있으면 `.env.local` 의 `VITE_API_PROXY_TARGET` 을 수정하세요.

## 환경 변수

`.env.local` 에 설정합니다. 자세한 항목은 `.env.example` 참고.

| 변수 | 필수 | 설명 |
|---|:-:|---|
| `VITE_KAKAO_MAP_KEY` | ✅ | Kakao 지도 JavaScript SDK 키. [developers.kakao.com](https://developers.kakao.com) 에서 앱 등록 후 "JavaScript 키" 발급. **REST API 키와 다름** — REST 키는 백엔드(Mashil-Back) 의 `Kakao:RestApiKey` 에 들어갑니다. |
| `VITE_API_PROXY_TARGET` | ❌ | 백엔드 URL. 기본 `http://localhost:5099`. dev 시 `/api` 경로가 이 주소로 프록시됨. |
| `VITE_DEV_PORT` | ❌ | vite dev 서버 포트. 기본 `5173`. |

> ⚠️ Kakao JS Key 는 클라이언트 빌드에 포함되므로 절대 비밀이 아닙니다. 그래도 본인 계정 키이므로 git 에 커밋해서 공유하지 마세요. Kakao 콘솔의 "도메인 등록" 으로 사용 가능 도메인을 제한하는 게 1차 방어입니다.

## 시크릿/민감 정보 정책

- 실제 API 키는 `.env.local` 에만 — 이 파일은 `.gitignore` 로 무조건 제외
- `.env.example` 만 커밋 (값은 placeholder)
- 새 기여자는 `.env.example` 을 보고 자기 `.env.local` 을 만듦

PR 올리기 전 항상 `git status` 로 `.env.local` 이 staged 되지 않았는지 확인하세요.

## 절대 경로 / 환경별 설정

소스 코드 안에 호스트/포트/디렉터리 절대 경로가 박혀있지 않도록 했습니다:

- 백엔드 URL → `VITE_API_PROXY_TARGET` (vite.config.ts 가 `loadEnv` 로 읽음)
- 개발 서버 포트 → `VITE_DEV_PORT`
- Kakao 키 → `VITE_KAKAO_MAP_KEY` (런타임에 `import.meta.env` 로 읽음)

새 환경별 설정을 추가할 때는 같은 패턴 — `.env.example` 에 항목 추가, `vite.config.ts` 또는 소스에서 `import.meta.env` 로 읽기.

## 스크립트

```bash
npm run dev      # 개발 서버 (HMR)
npm run build    # tsc -b && vite build  → dist/
npm run preview  # vite preview (빌드 결과 로컬 서빙)
npm run lint     # eslint
```

## 사용한 오픈소스

버전은 `package-lock.json` 에 실제로 설치된 것 (2026-11-16). 라이선스는 각 패키지가 밝힌 것.

### 앱에 들어가는 것

| 패키지 | 버전 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| [React](https://github.com/facebook/react), React DOM | 19.2.5 | MIT | UI |
| [React Router](https://github.com/remix-run/react-router) (`react-router-dom`) | 7.14.2 | MIT | 화면 이동 |
| [MUI](https://github.com/mui/material-ui) (`@mui/material`, `@mui/icons-material`) | 6.5.0 | MIT | 컴포넌트, 아이콘 |
| [Emotion](https://github.com/emotion-js/emotion) (`@emotion/react` 11.14.0, `@emotion/styled` 11.14.1) | 표 참고 | MIT | MUI 스타일 엔진 |
| [TanStack Query](https://github.com/TanStack/query) (`@tanstack/react-query`) | 5.100.9 | MIT | API 데이터 캐시 |
| [i18next](https://github.com/i18next/i18next) 24.2.3, [react-i18next](https://github.com/i18next/react-i18next) 15.7.4, `i18next-browser-languagedetector` 8.3.0 | 표 참고 | MIT | 한국어·영어 |
| [Sentry JavaScript SDK](https://github.com/getsentry/sentry-javascript) (`@sentry/react`) | 11.12.0 | MIT | 오류 모니터링. `VITE_SENTRY_DSN` 이 있는 빌드에서만 따로 받는 청크로 |
| [Overpass](https://github.com/RedHatOfficial/Overpass) (`@fontsource/overpass`) | 5.3.0 | OFL-1.1 | 라틴·숫자 서체 (직접 제공) |

### 개발 도구 (배포물에 들어가지 않음)

| 패키지 | 버전 | 라이선스 | 쓰는 곳 |
|---|---|---|---|
| [Vite](https://github.com/vitejs/vite) + `@vitejs/plugin-react` 4.7.0 | 6.4.2 | MIT | 개발 서버, 빌드 |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 | 타입 검사 |
| [ESLint](https://github.com/eslint/eslint) + `@eslint/js` | 9.39.5 | MIT | 린트 |
| [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | 8.72.2 | MIT | TypeScript 린트 규칙 |
| [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) | 6.10.2 | MIT | 접근성 린트 |
| [eslint-plugin-react-hooks](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks) | 7.1.1 | MIT | hooks 규칙 |
| [axe-core](https://github.com/dequelabs/axe-core) | 4.14.0 | MPL-2.0 | 개발 서버에서만 접근성 검사 (`src/dev/axeAudit.ts`). 수정 없이 사용 |
| `globals` 17.14.0, `@types/react` 19.2.14, `@types/react-dom` 19.2.3 | 표 참고 | MIT | 린트·타입 정의 |
| [fontTools](https://github.com/fonttools/fonttools) (Python, `tool/make_fonts.py`) | — | MIT | 서울남산체 웹폰트 만들기 |
| [Lighthouse](https://github.com/GoogleChrome/lighthouse) (`npx lighthouse@12`, 설치하지 않음) | 12 | Apache-2.0 | 성능·접근성 측정 |

## 서체 · 외부 서비스

오픈소스가 아니라 각 제공자의 이용 조건을 따른다.

| 항목 | 쓰는 곳 | 조건 |
|---|---|---|
| [서울남산체](https://www.seoul.go.kr/seoul/font.do) | 한글 서체 | 서울시 서체 이용 조건. 재배포 금지라 저장소에 넣지 않고 `tool/make_fonts.py` 가 공식 zip 에서 `public/fonts` 로 만든다 |
| [Kakao 지도 JavaScript API](https://apis.map.kakao.com/) | 지도, 마커 | Kakao Developers 약관. 앱 키는 `VITE_KAKAO_MAP_KEY` (저장소에 넣지 않음) |
| [카카오맵](https://map.kakao.com/) 링크 | 길찾기, 점검 중 대체 안내 (`map.kakao.com/link/...`) | 카카오맵 이용약관 |
| [LOCALDATA](https://www.localdata.go.kr/) 공중화장실정보 | 화장실 정보 (백엔드가 가공) | 공공데이터. 상세 화면에 출처 표시 |

## 라이선스

개인 사이드 프로젝트, 라이선스 미지정.

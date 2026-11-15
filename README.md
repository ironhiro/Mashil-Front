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

## 라이선스

개인 사이드 프로젝트, 라이선스 미지정.

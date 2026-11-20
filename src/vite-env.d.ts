/// <reference types="vite/client" />

/**
 * 브라우저에서 읽는 VITE_ 변수의 전체 목록. 여기 있는 값은 빌드 결과(JS)에 평문으로 들어가 누구나 볼 수 있다.
 * 비밀(API 비밀 키, 토큰, 비밀번호, LLM 키)은 절대 여기에 두지 않는다 → 백엔드 설정에만.
 * 같은 이미지를 dev → 운영으로 올리므로 환경마다 달라야 하는 값은 넣지 말고, 실행할 때 호스트로 정한다 (lib/sentryEnv.ts).
 * VITE_ 플래그는 화면만 숨긴다. 막아야 하는 기능은 서버 설정으로도 막는다.
 * 선언하지 않은 VITE_ 를 읽으면 CI 가 실패한다 (tool/check-env.mjs).
 * vite.config.ts 만 쓰는 VITE_API_PROXY_TARGET, VITE_DEV_PORT, VITE_ALLOWED_HOSTS 는 브라우저로 가지 않아 여기 없다.
 */
interface ImportMetaEnv {
    /** Kakao JavaScript 키: 공개용 키, 카카오 콘솔의 웹 도메인 등록으로 제한한다 (REST·Admin 키는 백엔드에만) */
    readonly VITE_KAKAO_MAP_KEY: string;
    /** 공유 링크의 바탕 주소 (운영 웹 도메인). 없으면 지금 페이지의 주소 */
    readonly VITE_PUBLIC_WEB_URL?: string;
    /** 브라우저 차단 (앱 전용): on / off. 없으면 운영 빌드 on, 개발 off (lib/browserGate.ts) */
    readonly VITE_BROWSER_GATE?: "on" | "off";
    /** 빌드가 차단(on)이어도 브라우저로 여는 호스트, 쉼표 구분. 없으면 개발 서버 toilets-dev.ironhiro.dev */
    readonly VITE_BROWSER_OPEN_HOSTS?: string;
    /** 브라우저 안내 화면의 스토어 주소. 없으면 "곧 나와요" */
    readonly VITE_PLAY_STORE_URL?: string;
    readonly VITE_APP_STORE_URL?: string;
    /** 서버 도보 경로: on 일 때만 켬 (사용자 위치를 서버로 보내므로 기본 끔). api.ts WALK_ROUTE_ENABLED */
    readonly VITE_WALK_ROUTE?: "on" | "off";
    /** 내 정보의 광고 제거·후원 카드 (결제가 붙기 전까지 끔) */
    readonly VITE_SUPPORT_CARDS?: "on" | "off";
    /** 이메일·비밀번호 로그인 칸: on 일 때만 (개발·운영 모두 기본 숨김, LoginPage EMAIL_LOGIN). 서버도 Auth:LegacyPasswordLogin 이 켜져 있어야 동작 */
    readonly VITE_EMAIL_LOGIN?: "on" | "off";
    /** 목업 백엔드 (npm run dev:mock, .env.mock) */
    readonly VITE_USE_MOCK?: "true";
    /** Sentry DSN: 공개용 값 (이벤트를 보내는 주소일 뿐, 조회 권한 없음). 없으면 에러 모니터링 끔 */
    readonly VITE_SENTRY_DSN?: string;
    /** Sentry environment: 목록에 없는 호스트에서만 (lib/sentryEnv.ts) */
    readonly VITE_SENTRY_ENVIRONMENT?: string;
    /** 배포 커밋 해시 (CI 가 github.sha 로 넣음) */
    readonly VITE_RELEASE?: string;
    /** 약관·방침의 운영자 정보: 문서에 그대로 공개되는 값 (legal/operator.ts) */
    readonly VITE_OPERATOR_NAME?: string;
    readonly VITE_PRIVACY_OFFICER?: string;
    readonly VITE_CONTACT_EMAIL?: string;
    readonly VITE_LEGAL_EFFECTIVE_DATE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

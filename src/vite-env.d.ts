/// <reference types="vite/client" />

interface ImportMetaEnv {
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
    /** 이메일·비밀번호 로그인 칸: on 일 때만 (개발·운영 모두 기본 숨김, LoginPage EMAIL_LOGIN). 서버도 Auth:LegacyPasswordLogin 이 켜져 있어야 동작 */
    readonly VITE_EMAIL_LOGIN?: "on" | "off";
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

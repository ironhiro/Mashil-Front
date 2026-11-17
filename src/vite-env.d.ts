/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_KAKAO_MAP_KEY: string;
    /** 공유 링크의 바탕 주소 (운영 웹 도메인). 없으면 지금 페이지의 주소 */
    readonly VITE_PUBLIC_WEB_URL?: string;
    /** 브라우저 차단 (앱 전용): on / off. 없으면 운영 빌드 on, 개발 off (lib/browserGate.ts) */
    readonly VITE_BROWSER_GATE?: "on" | "off";
    /** 브라우저 안내 화면의 스토어 주소. 없으면 "곧 나와요" */
    readonly VITE_PLAY_STORE_URL?: string;
    readonly VITE_APP_STORE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

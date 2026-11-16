/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_KAKAO_MAP_KEY: string;
    /** 공유 링크의 바탕 주소 (운영 웹 도메인). 없으면 지금 페이지의 주소 */
    readonly VITE_PUBLIC_WEB_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

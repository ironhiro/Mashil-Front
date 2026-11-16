/**
 * Kakao JavaScript SDK (카카오톡 공유) 동적 로더. 지도 SDK 와 같은 JavaScript 키를 쓴다.
 * 브라우저에서만 쓴다: 앱 안에서는 네이티브 SDK 로 공유한다 (웹뷰는 카카오톡 intent 를 열지 못한다).
 *
 * 버전과 SRI 해시는 함께 바꾼다. 해시: `openssl dgst -sha384 -binary kakao.min.js | openssl base64 -A`
 */
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js";
const SDK_INTEGRITY = "sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w";

interface KakaoLink {
    webUrl: string;
    mobileWebUrl: string;
}
interface KakaoContent {
    title: string;
    description?: string;
    imageUrl?: string;
    link: KakaoLink;
}
export type KakaoShareTemplate =
    | { objectType: "location"; address: string; addressTitle?: string; content: KakaoContent; buttonTitle?: string }
    | { objectType: "feed"; content: KakaoContent; buttons?: { title: string; link: KakaoLink }[] };

interface KakaoGlobal {
    init(key: string): void;
    isInitialized(): boolean;
    Share: { sendDefault(template: KakaoShareTemplate): void };
}

let loading: Promise<KakaoGlobal> | null = null;

export function loadKakaoSdk(): Promise<KakaoGlobal> {
    const w = window as unknown as { Kakao?: KakaoGlobal };
    if (w.Kakao?.isInitialized()) return Promise.resolve(w.Kakao);
    loading ??= new Promise<KakaoGlobal>((resolve, reject) => {
        const key = import.meta.env.VITE_KAKAO_MAP_KEY;
        if (!key) {
            reject(new Error("VITE_KAKAO_MAP_KEY 가 없습니다"));
            return;
        }
        const s = document.createElement("script");
        s.src = SDK_URL;
        s.integrity = SDK_INTEGRITY;
        s.crossOrigin = "anonymous";
        s.async = true;
        s.onload = () => {
            const k = w.Kakao;
            if (!k) return reject(new Error("Kakao SDK 를 읽지 못했습니다"));
            if (!k.isInitialized()) k.init(key);
            resolve(k);
        };
        s.onerror = () => {
            loading = null;
            reject(new Error("Kakao SDK 를 받지 못했습니다"));
        };
        document.head.appendChild(s);
    });
    return loading;
}

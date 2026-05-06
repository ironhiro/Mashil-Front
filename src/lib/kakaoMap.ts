/** Kakao Maps JS SDK 동적 로더. autoload=false → kakao.maps.load 콜백 안에서 resolve. */

const SCRIPT_ID = "kakao-maps-sdk";

let loadingPromise: Promise<typeof kakao.maps> | null = null;

export function loadKakaoMaps(): Promise<typeof kakao.maps> {
    if (typeof window !== "undefined" && window.kakao?.maps?.LatLng) {
        return Promise.resolve(window.kakao.maps);
    }
    if (loadingPromise) return loadingPromise;

    const appKey = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
    if (!appKey) {
        return Promise.reject(
            new Error("VITE_KAKAO_MAP_KEY 가 설정되지 않았습니다 (.env.local 확인)."),
        );
    }

    loadingPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        const onReady = () => window.kakao.maps.load(() => resolve(window.kakao.maps));

        if (existing) {
            if (window.kakao?.maps?.LatLng) onReady();
            else existing.addEventListener("load", onReady, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
        script.async = true;
        script.onload = onReady;
        script.onerror = () => {
            loadingPromise = null;
            reject(new Error("Kakao Maps SDK 스크립트 로드 실패."));
        };
        document.head.appendChild(script);
    });
    return loadingPromise;
}

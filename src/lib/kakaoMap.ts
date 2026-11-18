/** Kakao Maps JS SDK 동적 로더. autoload=false → kakao.maps.load 콜백 안에서 resolve. */
import i18n from "../i18n";

const SCRIPT_ID = "kakao-maps-sdk";

let loadingPromise: Promise<typeof kakao.maps> | null = null;

export function loadKakaoMaps(): Promise<typeof kakao.maps> {
    if (typeof window !== "undefined" && window.kakao?.maps?.LatLng) {
        return Promise.resolve(window.kakao.maps);
    }
    if (loadingPromise) return loadingPromise;

    const appKey = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
    if (!appKey) {
        console.error("VITE_KAKAO_MAP_KEY 가 설정되지 않았습니다 (.env.local 확인).");
        return Promise.reject(new Error(i18n.t("map.loadFailed")));
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
            reject(new Error(i18n.t("map.loadFailed")));
        };
        document.head.appendChild(script);
    });
    return loadingPromise;
}

export interface ReverseAddress {
    roadAddress: string;
    lotAddress: string;
}

/** 좌표 → 도로명·지번 주소 (Kakao Geocoder). 못 찾으면 둘 다 빈 문자열, SDK·네트워크 실패는 reject. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseAddress> {
    const maps = await loadKakaoMaps();
    return new Promise((resolve, reject) => {
        new maps.services.Geocoder().coord2Address(lng, lat, (result, status) => {
            if (status === maps.services.Status.OK && result[0]) {
                resolve({
                    roadAddress: result[0].road_address?.address_name ?? "",
                    lotAddress: result[0].address?.address_name ?? "",
                });
            } else if (status === maps.services.Status.ZERO_RESULT) {
                resolve({ roadAddress: "", lotAddress: "" });
            } else {
                reject(new Error(`reverse geocode failed: ${status}`));
            }
        });
    });
}

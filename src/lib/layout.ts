import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * 화면 크기 구분 (Material 3 window size classes: compact < 600, medium 600–839, expanded ≥ 840; dp = CSS px).
 * app.css 의 @media 와 같은 값이다. 바꾸면 두 곳을 같이 바꾼다.
 */
/** medium 이상: 하단 탭 대신 왼쪽 내비게이션 레일 */
export const MEDIUM_UP = "(min-width: 37.5rem)";
/** 홈의 목록|지도 나란히: expanded 이거나, medium 가로 (폰 가로·작은 태블릿 가로) */
export const SPLIT = "(min-width: 52.5rem), (min-width: 37.5rem) and (orientation: landscape)";
/** 상세·방향 안내의 지도|내용 나란히: 가로로 넓을 때만 (세로 태블릿은 위아래가 낫다) */
export const LANDSCAPE_SPLIT = "(min-width: 37.5rem) and (orientation: landscape)";

/** Kakao 지도는 칸 크기가 바뀌어도 스스로 다시 그리지 않는다 (회전·분할 화면·레일). 칸을 지켜보다 relayout 한다. */
export function useMapRelayout(ref: RefObject<HTMLElement | null>, getMap: () => kakao.maps.Map | null | undefined, keepCenter = true) {
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        let last = { w: el.clientWidth, h: el.clientHeight };
        const ro = new ResizeObserver(() => {
            const w = el.clientWidth, h = el.clientHeight;
            if (w === last.w && h === last.h) return;
            last = { w, h };
            const map = getMap();
            if (!map) return;
            const c = map.getCenter();
            map.relayout();
            if (keepCenter) map.setCenter(c);
        });
        ro.observe(el);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref]);
}

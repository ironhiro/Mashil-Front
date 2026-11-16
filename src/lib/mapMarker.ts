/**
 * 지도 마커: 글자 없이 핀 모양으로 영업 상태만 (스타일은 app.css 의 .marker).
 * 색에만 기대지 않게 상태마다 채움·테두리·안쪽 표시가 다르다.
 * - live (열림): 파랑 채움 + 흰 점        - soon (30분 안에 닫힘): 빨강 채움 + 흰 "!"
 * - closed (닫힘): 흰 채움 + 잉크 테두리 + 가로줄  - unknown (모름): 회색 + 가는 테두리 + "?"
 * 묶음은 둥근 잉크 마커에 곳 수.
 */
import type { TileState } from "../design/statusTile";

/** 핀 하나의 크기 (px). 겹침 판정에 쓴다 */
export const MARKER_SIZE = { width: 28, height: 36 };

const PIN_PATH = "M14 1C6.8 1 1 6.6 1 13.6 1 23.2 14 35 14 35s13-11.8 13-21.4C27 6.6 21.2 1 14 1z";

const GLYPH: Record<TileState, string> = {
    live: '<circle cx="14" cy="13.5" r="4.5" class="marker-glyph-fill"/>',
    soon: '<path d="M14 7.5v7.5" class="marker-glyph-line"/><circle cx="14" cy="18.6" r="1.6" class="marker-glyph-fill"/>',
    closed: '<path d="M9 13.5h10" class="marker-glyph-line"/>',
    unknown:
        '<path d="M11.2 10.6a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2.9-1.2 1.8v.6" class="marker-glyph-line"/><circle cx="14" cy="19" r="1.3" class="marker-glyph-fill"/>',
};

function svg(state: TileState): string {
    return (
        `<svg viewBox="0 0 28 36" width="${MARKER_SIZE.width}" height="${MARKER_SIZE.height}" aria-hidden="true" focusable="false">` +
        `<path d="${PIN_PATH}" class="marker-body"/>${GLYPH[state]}</svg>`
    );
}

/** 누를 수 있는 마커 (홈 지도). 이름은 aria-label 로 붙인다 */
export function createMarkerButton(state: TileState): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `marker marker--${state}`;
    el.innerHTML = svg(state);
    return el;
}

/** 장식용 마커 (상세 지도 띠, 방향 안내의 목적지) */
export function createMarkerElement(state: TileState): HTMLDivElement {
    const el = document.createElement("div");
    el.className = `marker marker--${state} is-static`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = svg(state);
    return el;
}

/** 겹친 마커 묶음: 둥근 잉크 마커에 곳 수 */
export function createClusterButton(count: number): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "marker-cluster";
    el.textContent = String(count);
    return el;
}

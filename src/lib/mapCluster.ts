/**
 * 지도 마커 묶기와 묶음 목록 정렬.
 *
 * 묶기: 화면에서 안내판 조각(마커)끼리 실제로 겹치면 한 묶음. 겹침이 이어지면(A-B, B-C) 모두 한 묶음이다.
 * 줌을 바꿔 떨어지면 다시 풀린다. 같은 건물처럼 좌표가 같으면 끝까지 확대해도 묶여 있으므로, 묶음을 누르면 목록을 띄운다.
 */
import type { ToiletNear } from "../api";
import { statusOf } from "./openStatus";

export interface PinBox {
    /** 화면(지도 칸) 기준 마커 아래 가운데 점 (px) */
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 이만큼 떨어져 있어도 붙은 것으로 본다 (px). 테두리끼리 닿으면 눌러 고르기 어렵다 */
const TOUCH_GAP_PX = 4;

function overlaps(a: PinBox, b: PinBox): boolean {
    const dx = Math.abs(a.x - b.x);
    const ay = a.y - a.height;
    const by = b.y - b.height;
    return dx < (a.width + b.width) / 2 + TOUCH_GAP_PX && ay < b.y + TOUCH_GAP_PX && by < a.y + TOUCH_GAP_PX;
}

/** 겹치는 상자끼리 묶은 번호 묶음들 (입력 순서 유지, 하나짜리 묶음 포함). */
export function groupOverlapping(boxes: PinBox[]): number[][] {
    const parent = boxes.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            if (overlaps(boxes[i], boxes[j])) parent[find(j)] = find(i);
        }
    }
    const groups = new Map<number, number[]>();
    boxes.forEach((_, i) => {
        const root = find(i);
        const g = groups.get(root);
        if (g) g.push(i);
        else groups.set(root, [i]);
    });
    return [...groups.values()];
}

export type ClusterSort = "distance" | "recommend";

/**
 * 추천 점수 (0~1). 서버 ToiletRecommender 와 같은 식: 품질 50% (베이지안 별점) · 믿음 30% · 가까움 20%,
 * 열려 있는지 모르면 0.85 배. 근처 목록 응답에는 댓글 도움돼요 수가 없어서 믿음은 중립값 0.5 로 둔다.
 * 닫힌 곳은 -1 (목록 맨 뒤).
 */
export function recommendScore(t: ToiletNear, radiusM: number): number {
    const status = statusOf(t);
    if (status.kind === "closed") return -1;
    const n = t.averageRating != null ? t.ratingCount : 0;
    const avg = t.averageRating != null ? Math.min(5, Math.max(1, t.averageRating)) : 3;
    const bayes = (2 * 3 + avg * n) / (2 + n);
    const quality = (bayes - 1) / 4;
    const trust = 0.5;
    const proximity = radiusM <= 0 ? 0 : 1 - Math.min(1, Math.max(0, t.distanceM / radiusM));
    const score = 0.5 * quality + 0.3 * trust + 0.2 * proximity;
    return status.kind === "unknown" ? score * 0.85 : score;
}

export function sortCluster(items: ToiletNear[], by: ClusterSort, radiusM: number): ToiletNear[] {
    const copy = [...items];
    if (by === "distance") return copy.sort((a, b) => a.distanceM - b.distanceM);
    return copy.sort((a, b) => recommendScore(b, radiusM) - recommendScore(a, radiusM) || a.distanceM - b.distanceM);
}

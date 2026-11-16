/**
 * 지도 마커 묶기와 묶음 목록 정렬.
 *
 * 묶기: 화면에서 핀끼리 많이 겹쳐 따로 누르기 어려울 때만 한 묶음 (핀 크기의 절반 안쪽으로 붙은 것).
 * 겹침을 이어 붙이지 않는다(A-B, B-C 라도 A 와 C 가 멀면 따로): 묶음 하나가 넓은 범위를 덮지 않게.
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

/** 두 핀의 끝점이 핀 크기의 이 비율 안으로 붙어 있으면 묶는다 (0.5 = 절반 넘게 겹침) */
const CLUSTER_RATIO = 0.5;

function tooClose(a: PinBox, b: PinBox): boolean {
    const w = Math.min(a.width, b.width);
    const h = Math.min(a.height, b.height);
    return Math.abs(a.x - b.x) < w * CLUSTER_RATIO && Math.abs(a.y - b.y) < h * CLUSTER_RATIO;
}

/**
 * 많이 겹친 핀끼리 묶은 번호 묶음들 (하나짜리 묶음 포함). 앞에서부터 아직 안 묶인 핀을 기준으로,
 * 그 기준 핀과 많이 겹친 핀만 같은 묶음에 넣는다 (부르는 쪽이 가까운 순으로 주면 가까운 핀이 기준이 된다).
 */
export function groupOverlapping(boxes: PinBox[]): number[][] {
    const taken = new Array<boolean>(boxes.length).fill(false);
    const groups: number[][] = [];
    for (let i = 0; i < boxes.length; i++) {
        if (taken[i]) continue;
        taken[i] = true;
        const group = [i];
        for (let j = i + 1; j < boxes.length; j++) {
            if (!taken[j] && tooClose(boxes[i], boxes[j])) {
                taken[j] = true;
                group.push(j);
            }
        }
        groups.push(group);
    }
    return groups;
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

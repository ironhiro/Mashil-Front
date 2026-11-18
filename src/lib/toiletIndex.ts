import type { LatLng, RecommendedToilet, ToiletNear, ToiletSearchResult } from "../api";
import { haversineMeters } from "../api";
import { evaluateOpenStatus } from "./openStatusEval";
import type { ScheduleStatusCode, ScheduleTuple } from "./openStatusEval";

/**
 * 전국 화장실 목록을 기기에 두고 근처 찾기·추천·검색을 여기서 한다.
 *
 * 사용자 위치를 서버로 보내지 않으려는 것 (위치정보법 검토 2026-11: 위치를 단말기에서만 쓰면 위치기반서비스사업 신고 대상이 아님).
 * 서버에는 위치가 들어가지 않는 요청만 간다: `/api/toilets/snapshot` (전국 목록, 하루 한 번 바뀜, ETag 로 304) 과
 * `/api/toilets/stats` (평점·댓글 수). 둘 다 브라우저 HTTP 캐시를 그대로 쓴다.
 * 개방 상태는 서버 판정식을 옮긴 `openStatusEval` 로 기기에서 판정한다.
 */

/** 전국 목록을 다시 확인하는 간격. 바뀌지 않았으면 304 라 거의 공짜 */
const SNAPSHOT_RECHECK_MS = 30 * 60_000;
/** 평점·댓글 수를 다시 받는 간격 (서버도 1분마다 센다) */
const STATS_RECHECK_MS = 60_000;
/** 공간 격자 한 칸 (도). 약 1.1km */
const CELL_DEG = 0.01;

interface Entry {
    id: number;
    name: string;
    kind: string;
    kindCode: string;
    roadAddress: string | null;
    lotAddress: string | null;
    lat: number | null;
    lng: number | null;
    counts: number[];
    openHours: string | null;
    openHoursDetail: string | null;
    phone: string | null;
    scheduleStatus: ScheduleStatusCode;
    schedules: ScheduleTuple[] | null;
    /** 검색용: 이름·도로명·지번을 소문자로 */
    haystack: string[];
}

interface Stats {
    averageRating: number | null;
    ratingCount: number;
    commentCount: number;
    helpfulUp: number;
    helpfulDown: number;
}

interface Index {
    entries: Entry[];
    byCell: Map<string, Entry[]>;
    holidays: Set<string>;
}

const NO_STATS: Stats = { averageRating: null, ratingCount: 0, commentCount: 0, helpfulUp: 0, helpfulDown: 0 };

let index: { value: Index; at: number } | null = null;
let indexLoading: Promise<Index> | null = null;
let stats: { value: Map<number, Stats>; at: number } | null = null;
let statsLoading: Promise<Map<number, Stats>> | null = null;

const cellKey = (lat: number, lng: number) => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(path, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
}

interface SnapshotJson {
    version: number;
    fields: string[];
    holidays: string[];
    rows: unknown[][];
}

function buildIndex(json: SnapshotJson): Index {
    const f = (name: string) => {
        const i = json.fields.indexOf(name);
        if (i < 0) throw new Error(`snapshot field missing: ${name}`);
        return i;
    };
    const ix = {
        id: f("id"), name: f("name"), kind: f("kind"), kindCode: f("kindCode"),
        road: f("roadAddress"), lot: f("lotAddress"), lat: f("lat"), lng: f("lng"),
        openHours: f("openHours"), openHoursDetail: f("openHoursDetail"), phone: f("phone"),
        scheduleStatus: f("scheduleStatus"), schedules: f("schedules"),
    };
    const countIx = [
        "maleStall", "maleUrinal", "maleAccessibleStall", "maleAccessibleUrinal", "maleChildStall", "maleChildUrinal",
        "femaleStall", "femaleAccessibleStall", "femaleChildStall",
    ].map(f);

    const entries: Entry[] = [];
    const byCell = new Map<string, Entry[]>();
    for (const r of json.rows) {
        const road = r[ix.road] as string | null;
        const lot = r[ix.lot] as string | null;
        const name = r[ix.name] as string;
        const e: Entry = {
            id: r[ix.id] as number,
            name,
            kind: r[ix.kind] as string,
            kindCode: r[ix.kindCode] as string,
            roadAddress: road,
            lotAddress: lot,
            lat: r[ix.lat] as number | null,
            lng: r[ix.lng] as number | null,
            counts: countIx.map((i) => (r[i] as number) ?? 0),
            openHours: r[ix.openHours] as string | null,
            openHoursDetail: r[ix.openHoursDetail] as string | null,
            phone: r[ix.phone] as string | null,
            scheduleStatus: r[ix.scheduleStatus] as ScheduleStatusCode,
            schedules: r[ix.schedules] as ScheduleTuple[] | null,
            haystack: [name, road, lot].filter((s): s is string => !!s).map((s) => s.toLowerCase()),
        };
        entries.push(e);
        if (e.lat != null && e.lng != null) {
            const k = cellKey(e.lat, e.lng);
            const list = byCell.get(k);
            if (list) list.push(e);
            else byCell.set(k, [e]);
        }
    }
    return { entries, byCell, holidays: new Set(json.holidays) };
}

async function loadIndex(): Promise<Index> {
    if (index && Date.now() - index.at < SNAPSHOT_RECHECK_MS) return index.value;
    indexLoading ??= getJson<SnapshotJson>("/api/toilets/snapshot")
        .then((json) => {
            const value = buildIndex(json);
            index = { value, at: Date.now() };
            return value;
        })
        .catch((e) => {
            // 다시 확인하다 실패하면 갖고 있던 목록으로 계속 (오프라인에서도 찾기는 된다)
            if (index) {
                index = { value: index.value, at: Date.now() };
                return index.value;
            }
            throw e;
        })
        .finally(() => {
            indexLoading = null;
        });
    return indexLoading;
}

async function loadStats(): Promise<Map<number, Stats>> {
    if (stats && Date.now() - stats.at < STATS_RECHECK_MS) return stats.value;
    statsLoading ??= getJson<{ fields: string[]; rows: (number | null)[][] }>("/api/toilets/stats")
        .then((json) => {
            const i = (n: string) => json.fields.indexOf(n);
            const [id, avg, rc, cc, up, down] = ["id", "averageRating", "ratingCount", "commentCount", "helpfulUp", "helpfulDown"].map(i);
            const value = new Map<number, Stats>();
            for (const r of json.rows) {
                value.set(r[id] as number, {
                    averageRating: r[avg],
                    ratingCount: (r[rc] as number) ?? 0,
                    commentCount: (r[cc] as number) ?? 0,
                    helpfulUp: (r[up] as number) ?? 0,
                    helpfulDown: (r[down] as number) ?? 0,
                });
            }
            stats = { value, at: Date.now() };
            return value;
        })
        .catch(() => {
            // 평점 수는 없어도 찾기는 되게 (지난 값, 없으면 빈 값)
            const value = stats?.value ?? new Map<number, Stats>();
            stats = { value, at: Date.now() };
            return value;
        })
        .finally(() => {
            statsLoading = null;
        });
    return statsLoading;
}

function toNear(e: Entry, distanceM: number, s: Stats, nowMs: number, holidays: Set<string>): ToiletNear {
    const [mS, mU, mAS, mAU, mCS, mCU, fS, fAS, fCS] = e.counts;
    return {
        id: e.id,
        name: e.name,
        kind: e.kind,
        roadAddress: e.roadAddress,
        lotAddress: e.lotAddress,
        latitude: e.lat,
        longitude: e.lng,
        distanceM,
        maleStallCount: mS,
        maleUrinalCount: mU,
        maleAccessibleStallCount: mAS,
        maleAccessibleUrinalCount: mAU,
        maleChildStallCount: mCS,
        maleChildUrinalCount: mCU,
        femaleStallCount: fS,
        femaleAccessibleStallCount: fAS,
        femaleChildStallCount: fCS,
        openHours: e.openHours,
        openHoursDetail: e.openHoursDetail,
        phone: e.phone,
        averageRating: s.averageRating,
        ratingCount: s.ratingCount,
        commentCount: s.commentCount,
        kindCode: e.kindCode,
        scheduleStatus: e.scheduleStatus,
        openStatus: evaluateOpenStatus(e.scheduleStatus, e.schedules, nowMs, (k) => holidays.has(k)),
    };
}

/** 반경 안 (거리순, 서버 `/near` 와 같은 결과). 좌표가 없는 곳은 빠진다 */
function within(ix: Index, center: LatLng, radiusM: number): { e: Entry; d: number }[] {
    const dLat = radiusM / 111_320;
    const dLng = radiusM / (111_320 * Math.max(0.1, Math.cos((center.lat * Math.PI) / 180)));
    const out: { e: Entry; d: number }[] = [];
    const [y0, y1] = [Math.floor((center.lat - dLat) / CELL_DEG), Math.floor((center.lat + dLat) / CELL_DEG)];
    const [x0, x1] = [Math.floor((center.lng - dLng) / CELL_DEG), Math.floor((center.lng + dLng) / CELL_DEG)];
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            for (const e of ix.byCell.get(`${y}:${x}`) ?? []) {
                const d = haversineMeters(center, { lat: e.lat!, lng: e.lng! });
                if (d <= radiusM) out.push({ e, d });
            }
        }
    }
    return out.sort((a, b) => a.d - b.d || a.e.id - b.e.id);
}

/** `/near` 반경 상한 (서버와 같음) */
const MAX_NEAR_RADIUS_M = 10_000;

export async function nearbyLocal(lat: number, lng: number, radiusM: number, limit = 2000): Promise<ToiletNear[]> {
    const [ix, st] = await Promise.all([loadIndex(), loadStats()]);
    const radius = Math.min(Math.max(radiusM, 1), MAX_NEAR_RADIUS_M);
    const now = Date.now();
    return within(ix, { lat, lng }, radius)
        .slice(0, Math.min(Math.max(limit, 1), 5000))
        .map(({ e, d }) => toNear(e, d, st.get(e.id) ?? NO_STATS, now, ix.holidays));
}

// --- 추천 (서버 Mashil.Domain/ToiletRecommender.cs 와 같은 식) ---

const PRIOR_MEAN = 3;
const PRIOR_WEIGHT = 2;
const UNKNOWN_OPEN_FACTOR = 0.85;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function recommendScore(
    distanceM: number, radiusM: number, averageRating: number | null, ratingCount: number,
    helpfulUp: number, helpfulDown: number, open: ToiletNear["openStatus"],
): number | null {
    if (open?.kind === "Closed") return null;
    const hasRatings = ratingCount > 0 && averageRating != null;
    const up = Math.max(0, helpfulUp);
    const votes = up + Math.max(0, helpfulDown);
    if (!hasRatings && votes === 0) return null;
    const n = hasRatings ? ratingCount : 0;
    const avg = hasRatings ? Math.min(5, Math.max(1, averageRating!)) : PRIOR_MEAN;
    const quality = ((PRIOR_WEIGHT * PRIOR_MEAN + avg * n) / (PRIOR_WEIGHT + n) - 1) / 4;
    const trust = (up + 1) / (votes + 2);
    const proximity = radiusM <= 0 ? 0 : 1 - Math.min(1, Math.max(0, distanceM / radiusM));
    let score = 0.5 * quality + 0.3 * trust + 0.2 * proximity;
    if (!open || open.kind === "Unknown") score *= UNKNOWN_OPEN_FACTOR;
    return round4(score);
}

export async function recommendedLocal(lat: number, lng: number, radiusM: number, limit = 5): Promise<RecommendedToilet[]> {
    const radius = Math.min(Math.max(radiusM, 100), 5000);
    const take = Math.min(Math.max(limit, 1), 20);
    const [near, st] = await Promise.all([nearbyLocal(lat, lng, radius, 1000), loadStats()]);
    return near
        .map((t) => {
            const s = st.get(t.id) ?? NO_STATS;
            const score = recommendScore(t.distanceM, radius, t.averageRating, t.ratingCount, s.helpfulUp, s.helpfulDown, t.openStatus);
            return score == null ? null : { toilet: t, score, ratingCount: t.ratingCount, helpfulUp: s.helpfulUp, helpfulDown: s.helpfulDown };
        })
        .filter((x): x is RecommendedToilet => x !== null)
        .sort((a, b) => b.score - a.score || a.toilet.distanceM - b.toilet.distanceM)
        .slice(0, take);
}

// --- 검색 (서버 /search 와 같은 규칙: 이름·도로명·지번 부분 일치, 대소문자 무시) ---

const collator = new Intl.Collator("ko");

export async function searchLocal(q: string, near: LatLng | null, offset: number, limit: number): Promise<{ items: ToiletSearchResult[]; total: number }> {
    const needle = q.trim().toLowerCase();
    if (!needle) return { items: [], total: 0 };
    const ix = await loadIndex();
    const hits = ix.entries.filter((e) => e.haystack.some((h) => h.includes(needle)));
    if (near) {
        // 가까운 순, 좌표가 없는 곳은 뒤로
        const dist = new Map(hits.map((e) => [e.id, e.lat != null && e.lng != null ? haversineMeters(near, { lat: e.lat, lng: e.lng }) : Infinity]));
        hits.sort((a, b) => dist.get(a.id)! - dist.get(b.id)! || a.id - b.id);
    } else {
        hits.sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
    }
    return {
        total: hits.length,
        items: hits.slice(Math.max(0, offset), Math.max(0, offset) + limit).map((e) => ({
            id: e.id, name: e.name, roadAddress: e.roadAddress, lotAddress: e.lotAddress, latitude: e.lat, longitude: e.lng,
        })),
    };
}

/** 앱을 켜자마자 받아 두기 (첫 지도가 기다리지 않게). 실패해도 첫 찾기 때 다시 받는다 */
export function preloadToilets(): void {
    void loadIndex().catch(() => undefined);
    void loadStats();
}

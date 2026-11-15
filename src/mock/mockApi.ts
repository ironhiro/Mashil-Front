/**
 * 목업 백엔드 — `npm run dev:mock` (VITE_USE_MOCK=true) 일 때만 사용.
 *
 * 화장실 데이터는 공공데이터 "공중화장실정보.csv" 에서 광화문 반경 3km 를 추출한 실데이터,
 * 별점·댓글·변경 요청은 데모용 가짜 데이터. 상태는 메모리에만 있고 새로고침하면 초기화됨.
 */

import rawToilets from "./toilets.json";
import type { ChangeRequestRow, CommentRow, MyChangeRequest, MyComment, RecommendedToilet, ToiletDetail, ToiletNear, VoteResult } from "../api";
import type { ChangeRequestKind, ChangeRequestStatus, UserRole } from "../lib/enums";

type ToiletSeed = Omit<ToiletNear, "distanceM" | "averageRating" | "ratingCount" | "commentCount"> & { managementNo: string };

const toilets = rawToilets as ToiletSeed[];

// --- 결정적 난수 (새로고침해도 같은 데모 화면) ---
function mulberry32(seed: number) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(20260506);

const DEMO_USERS = [
    "a1b2c3d4-0000-4000-8000-000000000001",
    "a1b2c3d4-0000-4000-8000-000000000002",
    "a1b2c3d4-0000-4000-8000-000000000003",
    "a1b2c3d4-0000-4000-8000-000000000004",
];
const ME = { id: "a1b2c3d4-0000-4000-8000-0000000000aa", email: "demo@mashil.app", role: "Admin" as UserRole };

const COMMENT_SAMPLES = [
    "깨끗하게 관리되고 있어요. 휴지도 넉넉했습니다.",
    "주말 오후엔 줄이 좀 있어요.",
    "입구 찾기가 조금 어려운데 건물 1층 안쪽에 있어요.",
    "장애인 화장실 넓고 좋습니다.",
    "밤 늦게는 문이 잠겨 있었어요. 개방시간 확인하세요.",
    "기저귀 교환대 있어서 아이랑 다니기 편해요.",
    "비데는 없지만 청결 상태 괜찮아요.",
    "공사 중이라 2층 화장실 이용하라고 안내돼 있었습니다.",
];

// --- 메모리 상태 ---
const ratings = new Map<number, Map<string, number>>(); // toiletId → (userId → score)
const comments: CommentRow[] = [];
let commentSeq = 1;
/** commentId → (userId → 1 | -1) */
const votes = new Map<number, Map<string, number>>();
const tally = (id: number) => {
    const v = [...(votes.get(id)?.values() ?? [])];
    return { upCount: v.filter((x) => x > 0).length, downCount: v.filter((x) => x < 0).length };
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

for (const t of toilets) {
    if (rand() < 0.6) {
        const m = new Map<string, number>();
        const base = 3 + rand() * 2;
        for (const u of DEMO_USERS) {
            if (rand() < 0.7) m.set(u, Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 2))));
        }
        if (m.size > 0) ratings.set(t.id, m);
    }
    if (rand() < 0.35) {
        const count = 1 + Math.floor(rand() * 3);
        const start = Math.floor(rand() * COMMENT_SAMPLES.length);
        for (let i = 0; i < count; i++) {
            const at = daysAgo(rand() * 60); // 소수 일수 → 작성 시각도 제각각
            comments.push({
                id: commentSeq++,
                userId: DEMO_USERS[Math.floor(rand() * DEMO_USERS.length)],
                toiletId: t.id,
                text: COMMENT_SAMPLES[(start + i * 3) % COMMENT_SAMPLES.length], // 같은 화장실 안에서 중복 없음
                hidden: false,
                createdAt: at,
                updatedAt: at,
            });
        }
    }
}

const changeRequests: ChangeRequestRow[] = [
    {
        id: 1, requesterId: DEMO_USERS[0], targetToiletId: toilets[3]?.id ?? null, kind: "Update",
        payloadJson: JSON.stringify({ openHours: "정시", openHoursDetail: "평일 07:00~22:00, 주말 09:00~18:00" }),
        status: "Pending", reviewedById: null, reviewedAt: null, reviewNote: null, createdAt: daysAgo(1),
    },
    {
        id: 2, requesterId: DEMO_USERS[1], targetToiletId: null, kind: "Add",
        payloadJson: JSON.stringify({ name: "광화문역 2번 출구 앞 개방화장실", kind: "개방화장실", latitude: 37.5712, longitude: 126.9765 }),
        status: "Pending", reviewedById: null, reviewedAt: null, reviewNote: null, createdAt: daysAgo(2),
    },
    {
        id: 3, requesterId: DEMO_USERS[2], targetToiletId: toilets[10]?.id ?? null, kind: "Delete",
        payloadJson: JSON.stringify({ reason: "건물 철거로 화장실이 없어졌습니다." }),
        status: "Approved", reviewedById: ME.id, reviewedAt: daysAgo(3), reviewNote: "현장 확인 완료", createdAt: daysAgo(5),
    },
    {
        id: 4, requesterId: DEMO_USERS[3], targetToiletId: toilets[20]?.id ?? null, kind: "Update",
        payloadJson: JSON.stringify({ phone: "02-000-0000" }),
        status: "Rejected", reviewedById: ME.id, reviewedAt: daysAgo(6), reviewNote: "전화번호 확인 불가", createdAt: daysAgo(8),
    },
];
// 데모 사용자(ME)의 활동: "내 정보" 탭에서 보이도록
changeRequests.push(
    {
        id: changeRequests.length + 1, requesterId: ME.id, targetToiletId: null, kind: "Add",
        payloadJson: JSON.stringify({ name: "세종문화회관 뒤 공원 화장실", kind: "공중화장실" }),
        status: "Pending", reviewedById: null, reviewedAt: null, reviewNote: null, createdAt: daysAgo(0.2),
    },
    {
        id: changeRequests.length + 2, requesterId: ME.id, targetToiletId: toilets[1]?.id ?? null, kind: "Update",
        payloadJson: JSON.stringify({ openHours: "07:00~23:00" }),
        status: "Approved", reviewedById: ME.id, reviewedAt: daysAgo(1), reviewNote: "알려 주셔서 고마워요. 영업시간을 고쳤어요.", createdAt: daysAgo(3),
    },
);
for (const [toiletIdx, text, hidden, ago] of [
    [0, "깨끗하고 휴지도 넉넉해요. 저녁에는 조금 붐벼요.", false, 0.5],
    [2, "입구 찾기가 어려워요. 주차장 안쪽 계단 옆이에요.", false, 2],
    [4, "광고 문구", true, 4],
] as const) {
    const t = toilets[toiletIdx];
    if (t) comments.push({ id: commentSeq++, userId: ME.id, toiletId: t.id, text, hidden, createdAt: daysAgo(ago), updatedAt: daysAgo(ago) });
}
// 다른 사용자 댓글과 그 표: 댓글 평가와 추천을 목업에서도 볼 수 있게
for (const [toiletIdx, author, text, ups, downs] of [
    [0, 0, "지하 1층이라 엘리베이터로 가면 바로예요.", 4, 0],
    [1, 1, "밤 11시까지 열려 있어요. 비누 있음.", 3, 1],
    [3, 2, "공사 중이라 닫혀 있었어요.", 0, 3],
] as const) {
    const t = toilets[toiletIdx];
    if (!t) continue;
    const id = commentSeq++;
    comments.push({ id, userId: DEMO_USERS[author], toiletId: t.id, text, hidden: false, createdAt: daysAgo(1 + toiletIdx), updatedAt: daysAgo(1 + toiletIdx) });
    const m = new Map<string, number>();
    DEMO_USERS.slice(0, ups).forEach((u) => m.set(u, 1));
    DEMO_USERS.slice(ups, ups + downs).forEach((u) => m.set(u, -1));
    votes.set(id, m);
}
let changeSeq = changeRequests.length + 1;

// --- 헬퍼 ---
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const r = (d: number) => (d * Math.PI) / 180;
    const x =
        Math.sin(r(bLat - aLat) / 2) ** 2 +
        Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
}

function summarize(t: ToiletSeed, distanceM: number): ToiletNear {
    const r = ratings.get(t.id);
    const scores = r ? [...r.values()] : [];
    const { managementNo: _ignored, ...rest } = t;
    return {
        ...rest,
        distanceM,
        averageRating: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        ratingCount: scores.length,
        commentCount: comments.filter((c) => c.toiletId === t.id && !c.hidden).length,
    };
}

class MockHttpError extends Error {}
const notFound = () => new MockHttpError("Not found (mock)");
const delay = () => new Promise((res) => setTimeout(res, 120 + Math.random() * 180));

// --- 라우터 ---
export async function mockFetch<T>(path: string, method: string, body: unknown): Promise<T> {
    await delay();
    const url = new URL(path, "http://mock.local");
    const p = url.pathname;
    const q = url.searchParams;
    const b = (body ?? {}) as Record<string, unknown>;
    let m: RegExpMatchArray | null;

    // Auth — 어떤 이메일/비밀번호든 데모 관리자 계정으로 로그인
    if (method === "POST" && (p === "/api/auth/login" || p === "/api/auth/register")) {
        return { token: "mock-token", userId: ME.id, email: (b.email as string) || ME.email, role: ME.role } as T;
    }
    if (method === "GET" && p === "/api/auth/me") return ME as T;

    if (method === "GET" && p === "/api/toilets/near") {
        const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
        const radius = Number(q.get("radiusM") ?? 500), limit = Number(q.get("limit") ?? 2000);
        return toilets
            .map((t) => ({ t, d: haversineM(lat, lng, t.latitude!, t.longitude!) }))
            .filter((x) => x.d <= radius)
            .sort((a, b2) => a.d - b2.d)
            .slice(0, limit)
            .map((x) => summarize(x.t, x.d)) as T;
    }

    // 추천: 서버 ToiletRecommender 와 같은 식 (품질 50% · 믿음 30% · 가까움 20%, 근거 없으면 제외)
    if (method === "GET" && p === "/api/toilets/recommended") {
        const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
        const radius = Number(q.get("radiusM") ?? 1000), limit = Number(q.get("limit") ?? 5);
        return toilets
            .map((t) => ({ t, d: haversineM(lat, lng, t.latitude!, t.longitude!) }))
            .filter((x) => x.d <= radius)
            .map(({ t, d }): RecommendedToilet | null => {
                const n = ratings.get(t.id)?.size ?? 0;
                const near = summarize(t, d);
                let up = 0, down = 0;
                for (const c of comments.filter((c) => c.toiletId === t.id && !c.hidden)) {
                    const tl = tally(c.id);
                    up += tl.upCount;
                    down += tl.downCount;
                }
                if (n === 0 && up + down === 0) return null;
                const avg = near.averageRating ?? 3;
                const quality = ((2 * 3 + avg * n) / (2 + n) - 1) / 4;
                const trust = (up + 1) / (up + down + 2);
                const score = 0.5 * quality + 0.3 * trust + 0.2 * (1 - Math.min(d / radius, 1));
                return { toilet: near, score, ratingCount: n, helpfulUp: up, helpfulDown: down };
            })
            .filter((x): x is RecommendedToilet => x !== null)
            .sort((a, b2) => b2.score - a.score)
            .slice(0, limit) as T;
    }

    if (method === "PUT" && (m = p.match(/^\/api\/comments\/(\d+)\/vote$/))) {
        const id = Number(m[1]);
        const c = comments.find((x) => x.id === id && !x.hidden);
        if (!c) throw notFound();
        if (c.userId === ME.id) throw new MockHttpError("cannot vote on your own comment");
        const value = Number(b.value);
        if (!votes.has(id)) votes.set(id, new Map());
        if (value === 0) votes.get(id)!.delete(ME.id);
        else votes.get(id)!.set(ME.id, value);
        return { ...tally(id), myVote: value } satisfies VoteResult as T;
    }

    if (method === "GET" && p === "/api/toilets/search") {
        const kw = (q.get("q") ?? "").trim();
        return toilets
            .filter((t) => t.name.includes(kw) || t.roadAddress?.includes(kw) || t.lotAddress?.includes(kw))
            .slice(0, Number(q.get("limit") ?? 50))
            .map((t) => summarize(t, 0)) as T;
    }

    if (method === "GET" && (m = p.match(/^\/api\/toilets\/(\d+)$/))) {
        const t = toilets.find((x) => x.id === Number(m![1]));
        if (!t) throw notFound();
        const detail: ToiletDetail = {
            id: t.id, managementNo: t.managementNo, name: t.name, kind: t.kind,
            roadAddress: t.roadAddress, lotAddress: t.lotAddress, latitude: t.latitude, longitude: t.longitude,
            openHours: t.openHours, openHoursDetail: t.openHoursDetail, phone: t.phone,
        };
        return detail as T;
    }

    if (method === "POST" && (m = p.match(/^\/api\/toilets\/(\d+)\/ratings$/))) {
        const id = Number(m[1]);
        if (!ratings.has(id)) ratings.set(id, new Map());
        ratings.get(id)!.set(ME.id, Number(b.score));
        return undefined as T;
    }

    if ((m = p.match(/^\/api\/toilets\/(\d+)\/comments$/))) {
        const id = Number(m[1]);
        if (method === "GET") {
            return comments
                .filter((c) => c.toiletId === id && !c.hidden)
                .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))
                .map((c) => ({
                    ...c,
                    authorName: c.userId === ME.id ? "데모" : "마실러",
                    isMine: c.userId === ME.id,
                    ...tally(c.id),
                    myVote: votes.get(c.id)?.get(ME.id) ?? 0,
                })) as T;
        }
        if (method === "POST") {
            const now = new Date().toISOString();
            const row: CommentRow = { id: commentSeq++, userId: ME.id, toiletId: id, text: String(b.text ?? ""), hidden: false, createdAt: now, updatedAt: now };
            comments.push(row);
            return row as T;
        }
    }

    if (method === "POST" && p === "/api/change-requests") {
        const row: ChangeRequestRow = {
            id: changeSeq++, requesterId: ME.id,
            targetToiletId: (b.targetToiletId as number | null) ?? null,
            kind: String(b.kind), payloadJson: (b.payloadJson as string | null) ?? "{}",
            status: "Pending", reviewedById: null, reviewedAt: null, reviewNote: null,
            createdAt: new Date().toISOString(),
        };
        changeRequests.push(row);
        return row as T;
    }

    if (method === "GET" && p === "/api/admin/change-requests") {
        const status = q.get("status") as ChangeRequestStatus | null;
        return changeRequests
            .filter((r) => !status || r.status === status)
            .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt)) as T;
    }

    if (method === "PATCH" && (m = p.match(/^\/api\/admin\/change-requests\/(\d+)$/))) {
        const row = changeRequests.find((r) => r.id === Number(m![1]));
        if (!row) throw notFound();
        row.status = b.approve ? "Approved" : "Rejected";
        row.reviewedById = ME.id;
        row.reviewedAt = new Date().toISOString();
        row.reviewNote = (b.note as string | undefined) ?? null;
        return undefined as T;
    }

    // 내 활동
    const nameOf = (id: number | null) => (id === null ? null : (toilets.find((x) => x.id === id)?.name ?? null));
    if (method === "GET" && p === "/api/me/comments") {
        return comments
            .filter((c) => c.userId === ME.id)
            .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))
            .map((c): MyComment => ({ id: c.id, toiletId: c.toiletId, toiletName: nameOf(c.toiletId), text: c.text, hidden: c.hidden, createdAt: c.createdAt, updatedAt: c.updatedAt })) as T;
    }
    if (method === "GET" && p === "/api/me/change-requests") {
        return changeRequests
            .filter((r) => r.requesterId === ME.id)
            .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))
            .map((r): MyChangeRequest => {
                let payloadName: string | null = null;
                try {
                    const n = (JSON.parse(r.payloadJson) as { name?: unknown }).name;
                    payloadName = typeof n === "string" && n.trim() ? n.trim() : null;
                } catch {
                    payloadName = null;
                }
                return {
                    id: r.id, kind: r.kind as ChangeRequestKind, status: r.status, targetToiletId: r.targetToiletId,
                    toiletName: nameOf(r.targetToiletId) ?? payloadName,
                    createdAt: r.createdAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote,
                };
            }) as T;
    }

    throw new MockHttpError(`목업에 없는 API: ${method} ${p}`);
}

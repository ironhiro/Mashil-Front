/**
 * 화장실 영업시간 상태 판정.
 * 입력 데이터(openHours / openHoursDetail) 가 매우 다양해서 (`정시`, `상시`, `07:00~22:00`,
 * `09:00~18:00 (평일)`, 공백 등) 여기에 패턴을 모아두고 추후 확장.
 *
 * 반환 4가지:
 * - `24h`     — 항상 영업 (초록 뱃지)
 * - `open`    — 시간대 안 (초록 뱃지) + 닫는 시간 안내
 * - `closed`  — 시간대 밖 (빨강 뱃지) + 다음 여는 시간 안내
 * - `unknown` — 패턴 불일치 / 빈 값 (검정 뱃지) — 사용자에게 "직접 방문 확인" 안내
 */

import type { ServerOpenStatus, Weekday } from "../api";

export type OpenStatus =
    | { kind: "24h"; raw: string }
    | { kind: "open"; closesAt: string; raw: string; /** 닫기까지 30분 이내 */ closingSoon: boolean; /** 닫기까지 남은 분 (서버 판정일 때) */ minutesLeft?: number }
    | {
          kind: "closed";
          /** 다음에 여는 시각. 모르면 "" */
          opensAt: string;
          raw: string;
          /** 다음에 여는 날 (서버 판정일 때만): 0 = 오늘, 1 = 내일 … */
          opensInDays?: number;
          opensDay?: Weekday;
      }
    | { kind: "unknown"; raw: string };

/**
 * 화장실의 영업 상태. 서버 판정(openStatus)이 있으면 그것을 쓰고 (KST·요일·공휴일 반영),
 * 없으면(목업 등) 원문을 정규식으로 판정한다.
 */
export function statusOf(
    toilet: { openStatus?: ServerOpenStatus | null; openHours: string | null; openHoursDetail: string | null },
    now: Date = new Date(),
): OpenStatus {
    const raw = [toilet.openHours, toilet.openHoursDetail].filter((s) => s && s.trim()).join(" ").trim();
    const s = toilet.openStatus;
    if (!s) return parseOpenStatus(toilet.openHours, toilet.openHoursDetail, now);
    switch (s.kind) {
        case "AlwaysOpen":
            return { kind: "24h", raw };
        case "Open": {
            const closesAt = s.closesAt ?? "";
            const left = closesAt ? minutesUntilKst(closesAt, now) : Infinity;
            return { kind: "open", closesAt, raw, closingSoon: left <= CLOSING_SOON_MIN, minutesLeft: Number.isFinite(left) ? left : undefined };
        }
        case "Closed":
            return {
                kind: "closed",
                opensAt: s.nextOpen?.at ?? "",
                raw,
                opensInDays: s.nextOpen?.daysFromToday,
                opensDay: s.nextOpen?.day,
            };
        default:
            return { kind: "unknown", raw };
    }
}

/** 지금(한국 시간)부터 HH:MM 까지 남은 분. 자정을 넘기면 다음 날로 본다. */
function minutesUntilKst(hhmm: string, now: Date): number {
    const [h, m] = hhmm.split(":").map(Number);
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(now);
    const nh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const nm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const target = (h === 24 ? 24 * 60 : h * 60) + m;
    return (target - (nh * 60 + nm) + 24 * 60) % (24 * 60) || 24 * 60;
}

/** 오늘 요일 (한국 시간) */
export function todayKst(now: Date = new Date()): Weekday {
    const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(now);
    return d as Weekday;
}

const ALWAYS_OPEN_RE = /상시|24\s*시간|00\s*:?\s*00\s*[~∼〜\-–—]\s*24\s*:?\s*00|0\s*:\s*00\s*[~∼〜\-–—]\s*24\s*:\s*00/;
const RANGE_RE = /(\d{1,2})\s*:\s*(\d{2})\s*[~∼〜\-–—]\s*(\d{1,2})\s*:\s*(\d{2})/;
/** 분 없이 시만 적은 범위 — 공공데이터에 `05~24`, `09 ~ 18` 형태가 꽤 있음. HH:MM 패턴이 없을 때만 시도. */
const HOUR_RANGE_RE = /(?<!\d)(\d{1,2})\s*[~∼〜]\s*(\d{1,2})(?![\d:])/;

/** "곧 닫힘" 기준 (분) — docs/07-ui-design.md §3 */
export const CLOSING_SOON_MIN = 30;

export function parseOpenStatus(
    openHours: string | null,
    openHoursDetail: string | null,
    now: Date = new Date(),
): OpenStatus {
    const raw = [openHours, openHoursDetail].filter((s) => s && s.trim()).join(" ").trim();
    if (!raw) return { kind: "unknown", raw: "" };

    if (ALWAYS_OPEN_RE.test(raw)) {
        return { kind: "24h", raw };
    }

    const range = parseRange(raw);
    if (range) {
        const { sh, sm, eh, em } = range;
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const nowMin = now.getHours() * 60 + now.getMinutes();

        // `00~24` 처럼 하루 전체를 덮는 범위는 24시간 영업
        if (startMin === 0 && endMin === 24 * 60) {
            return { kind: "24h", raw };
        }

        const opensAt = fmt(sh, sm);
        const closesAt = fmt(eh, em);

        // 자정을 넘기는 영업 (예: 22:00~02:00) — endMin <= startMin 면 야간 영업으로 간주
        const overnight = endMin <= startMin;
        const isOpen = overnight
            ? nowMin >= startMin || nowMin < endMin
            : nowMin >= startMin && nowMin < endMin;

        if (!isOpen) return { kind: "closed", opensAt, raw };
        const minutesLeft = (endMin - nowMin + 24 * 60) % (24 * 60);
        return { kind: "open", closesAt, raw, closingSoon: minutesLeft <= CLOSING_SOON_MIN };
    }

    return { kind: "unknown", raw };
}

function parseRange(raw: string): { sh: number; sm: number; eh: number; em: number } | null {
    const m = RANGE_RE.exec(raw);
    if (m) return { sh: Number(m[1]), sm: Number(m[2]), eh: Number(m[3]), em: Number(m[4]) };

    const h = HOUR_RANGE_RE.exec(raw);
    if (h) {
        const sh = Number(h[1]);
        const eh = Number(h[2]);
        if (sh <= 24 && eh <= 24) return { sh, sm: 0, eh, em: 0 };
    }
    return null;
}

function fmt(h: number, m: number): string {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

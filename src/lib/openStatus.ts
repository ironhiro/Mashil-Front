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

export type OpenStatus =
    | { kind: "24h"; raw: string }
    | { kind: "open"; closesAt: string; raw: string }
    | { kind: "closed"; opensAt: string; raw: string }
    | { kind: "unknown"; raw: string };

const ALWAYS_OPEN_RE = /상시|24\s*시간|00\s*:?\s*00\s*[~∼〜\-–—]\s*24\s*:?\s*00|0\s*:\s*00\s*[~∼〜\-–—]\s*24\s*:\s*00/;
const RANGE_RE = /(\d{1,2})\s*:\s*(\d{2})\s*[~∼〜\-–—]\s*(\d{1,2})\s*:\s*(\d{2})/;

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

    const m = RANGE_RE.exec(raw);
    if (m) {
        const sh = Number(m[1]);
        const sm = Number(m[2]);
        const eh = Number(m[3]);
        const em = Number(m[4]);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const nowMin = now.getHours() * 60 + now.getMinutes();

        const opensAt = fmt(sh, sm);
        const closesAt = fmt(eh, em);

        // 자정을 넘기는 영업 (예: 22:00~02:00) — endMin <= startMin 면 야간 영업으로 간주
        const overnight = endMin <= startMin;
        const isOpen = overnight
            ? nowMin >= startMin || nowMin < endMin
            : nowMin >= startMin && nowMin < endMin;

        return isOpen
            ? { kind: "open", closesAt, raw }
            : { kind: "closed", opensAt, raw };
    }

    return { kind: "unknown", raw };
}

function fmt(h: number, m: number): string {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

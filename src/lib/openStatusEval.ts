import type { ScheduleDay, ServerOpenStatus, Weekday } from "../api";

/**
 * 개방 상태 판정 (MAP-05). 서버 `Mashil.Domain/OpenStatusEvaluator.cs` 와 `OpenStatusMapper.Label` 을 그대로 옮긴 것.
 * 전국 목록을 기기에서 쓰게 되면서(위치를 서버로 보내지 않기, 2026-11) 판정도 기기에서 한다. 서버 쪽을 고치면 여기도 고친다.
 * 기준 시각은 KST (기기 시계 + 9시간, 서머타임 없음).
 */

/** 스케줄 한 칸: [요일 1=월 … 7=일, 8=공휴일, 여는 분, 닫는 분, 휴무 0/1]. 닫는 분 <= 여는 분이면 자정 넘김 */
export type ScheduleTuple = [day: number, open: number | null, close: number | null, closed: 0 | 1];

export type ScheduleStatusCode = "AlwaysOpen" | "Scheduled" | "NotOpen" | "Irregular" | "FollowsFacility" | "Unknown";

const DAY_NAMES: ScheduleDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Holiday"];
const DAY_KO: Record<ScheduleDay, string> = { Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토", Sun: "일", Holiday: "공휴일" };
const HOLIDAY = 8;

/** KST 기준 하루 (날짜 계산용, 시각은 쓰지 않음) */
interface KstDay {
    /** YYYY-MM-DD */
    key: string;
    /** 1=월 … 7=일 */
    dow: number;
}

function kstDay(utcMidnightMs: number): KstDay {
    const d = new Date(utcMidnightMs);
    const js = d.getUTCDay(); // 0=일
    return { key: d.toISOString().slice(0, 10), dow: js === 0 ? 7 : js };
}

const DAY_MS = 86_400_000;

export function formatMinute(m: number): string {
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function rulesFor(schedules: ScheduleTuple[], day: KstDay, isHoliday: (key: string) => boolean): ScheduleTuple[] | null {
    if (isHoliday(day.key)) {
        const holiday = schedules.filter((s) => s[0] === HOLIDAY);
        if (holiday.length > 0) return holiday;
    }
    const rules = schedules.filter((s) => s[0] === day.dow);
    return rules.length > 0 ? rules : null;
}

interface Evaluated {
    kind: ServerOpenStatus["kind"];
    closesAt: number | null;
    nextOpen: { daysFromToday: number; dow: number; minute: number } | null;
}

function evaluateCore(status: ScheduleStatusCode, schedules: ScheduleTuple[], nowMs: number, isHoliday: (key: string) => boolean): Evaluated {
    if (status === "AlwaysOpen") return { kind: "AlwaysOpen", closesAt: null, nextOpen: null };
    if (status !== "Scheduled") return { kind: "Unknown", closesAt: null, nextOpen: null }; // 미개방·불규칙·건물 운영시간은 "열림"으로 단정하지 않음

    const kst = nowMs + 9 * 3_600_000;
    const todayMs = Math.floor(kst / DAY_MS) * DAY_MS;
    const minute = Math.floor((kst - todayMs) / 60_000);
    const today = kstDay(todayMs);

    const todayRules = rulesFor(schedules, today, isHoliday);
    if (!todayRules) return { kind: "Unknown", closesAt: null, nextOpen: null }; // 오늘 요일 정보 없음 (부분 스케줄)

    for (const [, open, close, closed] of todayRules) {
        if (closed || open == null || close == null) continue;
        if (close > open && minute >= open && minute < close) return { kind: "Open", closesAt: close, nextOpen: null };
        if (close <= open && minute >= open) return { kind: "Open", closesAt: close, nextOpen: null }; // 자정 넘김, 오늘 저녁 구간
    }

    // 어제 시작해서 자정을 넘긴 시간대가 아직 이어지는지
    for (const [, open, close, closed] of rulesFor(schedules, kstDay(todayMs - DAY_MS), isHoliday) ?? []) {
        if (closed || open == null || close == null) continue;
        if (close <= open && minute < close) return { kind: "Open", closesAt: close, nextOpen: null };
    }

    // 다음 개방 (오늘 포함 7일 뒤까지)
    for (let d = 0; d <= 7; d++) {
        const day = kstDay(todayMs + d * DAY_MS);
        const rules = rulesFor(schedules, day, isHoliday);
        if (!rules) continue;
        const opens = rules.filter(([, open, , closed]) => !closed && open != null && (d > 0 || open > minute)).map(([, open]) => open!);
        if (opens.length > 0) return { kind: "Closed", closesAt: null, nextOpen: { daysFromToday: d, dow: day.dow, minute: Math.min(...opens) } };
    }
    return { kind: "Closed", closesAt: null, nextOpen: null };
}

function label(status: ScheduleStatusCode, kind: ServerOpenStatus["kind"], closes: string | null, next: ServerOpenStatus["nextOpen"]): string {
    switch (kind) {
        case "AlwaysOpen":
            return "24시간";
        case "Open":
            return closes === "24:00" ? "영업중 · 자정까지" : `영업중 · ${closes}까지`;
        case "Closed":
            if (!next) return "지금은 닫혀 있어요";
            if (next.daysFromToday === 0) return `닫힘 · 오늘 ${next.at}에 열려요`;
            if (next.daysFromToday === 1) return `닫힘 · 내일(${DAY_KO[next.day]}) ${next.at}에 열려요`;
            return `닫힘 · ${DAY_KO[next.day]}요일 ${next.at}에 열려요`;
        default:
            switch (status) {
                case "NotOpen":
                    return "일반 개방 안 함";
                case "Irregular":
                    return "불규칙 운영 · 직접 확인";
                case "FollowsFacility":
                    return "건물 운영시간 내";
                case "Scheduled":
                    return "오늘 운영 정보 없음";
                default:
                    return "운영 정보 없음";
            }
    }
}

/** 서버 응답(`openStatus`)과 같은 모양으로 판정한다 */
export function evaluateOpenStatus(
    status: ScheduleStatusCode,
    schedules: ScheduleTuple[] | null,
    nowMs: number,
    isHoliday: (key: string) => boolean,
): ServerOpenStatus {
    const e = evaluateCore(status, schedules ?? [], nowMs, isHoliday);
    const closesAt = e.closesAt != null ? formatMinute(e.closesAt) : null;
    const nextOpen = e.nextOpen
        ? { daysFromToday: e.nextOpen.daysFromToday, day: DAY_NAMES[e.nextOpen.dow - 1] as Weekday, at: formatMinute(e.nextOpen.minute) }
        : null;
    return { kind: e.kind, closesAt, nextOpen, label: label(status, e.kind, closesAt, nextOpen) };
}

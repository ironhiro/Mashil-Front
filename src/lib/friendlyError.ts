/**
 * 서버·네트워크 오류를 사용자가 읽을 문장으로 바꾼다 (현재 언어로).
 * 원문(HTTP 코드, `{ "error": "<code>" }`, 예외 메시지)은 화면에 내보내지 않고 콘솔에만 남긴다.
 */
import i18n from "../i18n";
import { ko } from "../i18n/locales/ko";

type ErrorCode = keyof typeof ko.errors.code;

function statusOf(msg: string): number | null {
    const m = msg.match(/^HTTP (\d{3})/);
    if (m) return Number(m[1]);
    try {
        const s = (JSON.parse(msg) as { status?: number }).status;
        return typeof s === "number" ? s : null;
    } catch {
        return null;
    }
}

function codeOf(msg: string): ErrorCode | null {
    try {
        const code = (JSON.parse(msg) as { error?: string }).error;
        return typeof code === "string" && code in ko.errors.code ? (code as ErrorCode) : null;
    } catch {
        return null;
    }
}

/** 이미 사용자용 문장으로 만든 오류 (그대로 보여 줌). */
export class UserFacingError extends Error {}

/** @param fallback 이미 번역된 문장. 없으면 공통 문구. */
export function friendlyError(err: unknown, fallback?: string): string {
    const t = i18n.t;
    if (err instanceof UserFacingError) return err.message;
    if (err instanceof TypeError) {
        // fetch 의 네트워크 실패는 TypeError("Failed to fetch")
        console.warn(err);
        return t("errors.network");
    }
    const msg = (err as Error)?.message ?? "";
    console.warn("[mashil]", msg);

    const code = codeOf(msg);
    if (code) return t(`errors.code.${code}`);

    const status = statusOf(msg);
    if (status === 401) return t("errors.unauthorized");
    if (status === 403) return t("errors.forbidden");
    if (status === 404) return t("errors.notFound");
    if (status === 429) return t("errors.tooMany");
    return fallback ?? t("errors.generic");
}

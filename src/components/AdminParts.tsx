import type { ReactNode } from "react";
import { Alert, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Link as RouterLink } from "react-router-dom";
import { ko } from "../i18n/locales/ko";
import { adminErrorMessage } from "../adminApi";
import { friendlyError } from "../lib/friendlyError";

type Console = typeof ko.adminConsole;
/** 값 → 라벨 묶음 (adminConsole.<group>.<값>) */
type LabelGroup = {
    [K in keyof Console]: Console[K] extends Record<string, string> ? K : never;
}[keyof Console];

/** 서버 enum 값을 화면 라벨로. 모르는 값은 그대로 보여 준다. */
export function labelOf(t: TFunction, group: LabelGroup, value: string | null | undefined): string {
    if (!value) return "";
    const table = ko.adminConsole[group] as Record<string, string>;
    return value in table ? (t(`adminConsole.${group}.${value}` as never) as string) : value;
}

/** 관리 화면 공통 머리: 관리로 돌아가기, 제목, 설명. */
export function AdminPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
    const { t } = useTranslation();
    return (
        <Stack spacing={2}>
            <Link component={RouterLink} to="/admin" underline="always" sx={{ alignSelf: "flex-start", fontWeight: 500 }}>
                {t("adminConsole.back")}
            </Link>
            <Typography variant="h4" component="h1">
                {title}
            </Typography>
            {intro && (
                <Typography variant="body2" color="text.secondary">
                    {intro}
                </Typography>
            )}
            {children}
        </Stack>
    );
}

export function Loading() {
    const { t } = useTranslation();
    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} /> <span>{t("common.loading")}</span>
        </Stack>
    );
}

/** 관리자에게는 서버가 준 설명(message)을 그대로 보여 준다. 없으면 공통 문장. */
export function AdminError({ error, fallback }: { error: unknown; fallback: string }) {
    if (!error) return null;
    return <Alert severity="error">{adminErrorMessage(error) ?? friendlyError(error, fallback)}</Alert>;
}

/** 분 → "HH:MM" */
export function hhmm(minute: number | null | undefined): string {
    if (minute === null || minute === undefined) return "";
    const h = Math.floor(minute / 60);
    const m = minute % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 실행 시간 (초, 소수 1자리) */
export function durationSeconds(start: string, end: string | null): number | null {
    if (!end) return null;
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 100) / 10;
}

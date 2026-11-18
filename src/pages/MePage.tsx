import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { fetchMyChangeRequests, fetchMyComments } from "../api";
import type { MyChangeRequest, MyComment } from "../api";
import { useAuth } from "../auth/AuthContext";
import { ChangeRequestStatusTag } from "../components/ChangeRequestStatusTag";
import { MemberCard } from "../components/MemberCard";
import { SupportCards } from "../components/SupportCards";

const SUPPORT_CARDS = import.meta.env.VITE_SUPPORT_CARDS === "on";
import { formatDateTime } from "../i18n";
import { ChangeRequestStatus, UserRole } from "../lib/enums";
import { friendlyError } from "../lib/friendlyError";

/** 처음에 보여 줄 줄 수. 더 있으면 "모두 보기" */
const PREVIEW_ROWS = 3;

/**
 * 하단 탭 "내 정보".
 * 회원: 회원 카드(누르면 설정 화면) → 내 제보 → 내 댓글 → 광고 제거·후원 → 관리자 메뉴.
 * 비회원: 로그인 안내 → 언어.
 */
export function MePage() {
    const auth = useAuth();
    const { t } = useTranslation();
    const isAdmin = auth.user?.role === UserRole.Admin;
    const signedIn = !!auth.user;

    const reports = useQuery({ enabled: signedIn, queryKey: ["me", "change-requests"], queryFn: fetchMyChangeRequests });
    const comments = useQuery({ enabled: signedIn, queryKey: ["me", "comments"], queryFn: fetchMyComments });
    const pending = reports.data?.filter((r) => r.status === ChangeRequestStatus.Pending).length ?? 0;

    return (
        <Stack spacing={3}>
            <Typography variant="h4" component="h1">
                {t("me.title")}
            </Typography>

            {auth.user ? (
                // 회원: 이름 카드. 누르면 설정 화면 (이름 바꾸기, 언어, 로그아웃, 탈퇴)
                <MemberCard user={auth.user} />
            ) : (
                <Box className="plate">
                    <Typography>{t("me.guest")}</Typography>
                    <Button variant="contained" size="large" fullWidth component={RouterLink} to="/login" sx={{ mt: 2 }}>
                        {t("nav.loginOrRegister")}
                    </Button>
                </Box>
            )}

            {signedIn && (
                <ActivitySection
                    title={t("me.reports")}
                    count={pending > 0 ? t("me.pendingCount", { count: pending }) : undefined}
                    query={reports}
                    empty={t("me.reportsEmpty")}
                    renderRow={(r: MyChangeRequest) => <ReportRow key={r.id} row={r} />}
                />
            )}

            {signedIn && (
                <ActivitySection
                    title={t("me.comments")}
                    query={comments}
                    empty={t("me.commentsEmpty")}
                    renderRow={(c: MyComment) => <CommentRowView key={c.id} row={c} />}
                />
            )}

            {/* 광고 제거·후원: 산 것은 계정에 묶이므로 회원만 */}
            {/* 광고 제거·후원은 결제가 붙기 전까지 숨긴다 (비공개 테스트, 2026-11-18). 확인할 때만 VITE_SUPPORT_CARDS=on */}
            {signedIn && SUPPORT_CARDS && <SupportCards />}

            {isAdmin && (
                <Button variant="outlined" size="large" component={RouterLink} to="/admin">
                    {t("adminConsole.hubTitle")}
                </Button>
            )}

            {/* 약관과 데이터 출처 (OSM·서울시 도보 네트워크는 출처 표시가 이용 조건) */}
            <Button color="secondary" component={RouterLink} to="/about" sx={{ alignSelf: "flex-start", px: 1, minHeight: 44 }}>
                {t("about.link")}
            </Button>
        </Stack>
    );
}

/** 안내판 모양 목록: 잉크 머리 줄(제목과 건수) 아래 행들. 처음엔 PREVIEW_ROWS 줄만 */
function ActivitySection<T>({
    title,
    count,
    query,
    empty,
    renderRow,
}: {
    title: string;
    count?: string;
    query: { data?: T[]; isLoading: boolean; isError: boolean; error: unknown };
    empty: string;
    renderRow: (row: T) => ReactNode;
}) {
    const { t } = useTranslation();
    const [all, setAll] = useState(false);
    const rows = query.data ?? [];
    const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
    return (
        <section className="board" aria-label={title}>
            <div className="activity-head">
                <h2>{title}</h2>
                {count && <span>{count}</span>}
            </div>
            {query.isLoading && <p className="board-empty">{t("common.loading")}</p>}
            {query.isError && (
                <Alert severity="error" sx={{ m: 1.5 }}>
                    {friendlyError(query.error, t("me.loadFailed"))}
                </Alert>
            )}
            {query.data && rows.length === 0 && <p className="board-empty">{empty}</p>}
            {shown.map(renderRow)}
            {rows.length > PREVIEW_ROWS && (
                <button type="button" className="activity-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
                    {all ? t("me.showLess") : t("me.showAll", { count: rows.length })}
                </button>
            )}
        </section>
    );
}

function ReportRow({ row }: { row: MyChangeRequest }) {
    const { t } = useTranslation();
    const name = row.toiletName ?? t("me.unnamedToilet");
    const body = (
        <>
            <span style={{ minWidth: 0 }}>
                <span className="board-name" title={name}>{name}</span>
                <span className="board-meta">
                    <span>{t(`report.kind.${row.kind}.label`)}</span>
                    <span>{t("me.sentAt", { time: formatDateTime(row.createdAt) })}</span>
                </span>
                {row.reviewNote && <span className="activity-note">{t("me.reviewNote", { note: row.reviewNote })}</span>}
            </span>
            <ChangeRequestStatusTag status={row.status} label={t(`me.reportStatus.${row.status}`)} />
        </>
    );
    // 대상이 있는 제보는 그 화장실 상세로 (추가 요청은 대상이 없다)
    return row.targetToiletId !== null ? (
        <RouterLink to={`/toilets/${row.targetToiletId}`} className="activity-row">
            {body}
        </RouterLink>
    ) : (
        <div className="activity-row">{body}</div>
    );
}

function CommentRowView({ row }: { row: MyComment }) {
    const { t } = useTranslation();
    const body = (
        <span style={{ minWidth: 0, gridColumn: "1 / -1" }}>
            <span className="board-name" title={row.toiletName ?? undefined}>{row.toiletName ?? t("me.goneToilet")}</span>
            <span className="activity-text">{row.text}</span>
            <span className="board-meta">
                <span>{formatDateTime(row.createdAt)}</span>
            </span>
            {row.hidden && <span className="activity-note">{t("me.hiddenComment")}</span>}
        </span>
    );
    return row.toiletName !== null ? (
        <RouterLink to={`/toilets/${row.toiletId}`} className="activity-row">
            {body}
        </RouterLink>
    ) : (
        <div className="activity-row">{body}</div>
    );
}

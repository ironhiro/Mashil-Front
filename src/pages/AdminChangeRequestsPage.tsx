import { Fragment, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { formatDateTime } from "../i18n";
import { ko } from "../i18n/locales/ko";
import { friendlyError } from "../lib/friendlyError";
import { fetchChangeRequests, fetchToilet, reviewChangeRequest } from "../api";
import type { ChangeRequestRow } from "../api";
import { ChangeRequestStatusTag } from "../components/ChangeRequestStatusTag";
import { CHANGE_REQUEST_KIND_OPTIONS, ChangeRequestStatus } from "../lib/enums";
import type { ChangeRequestKind } from "../lib/enums";

function statusLabel(t: TFunction, status: string): string {
    return status in ko.admin.status ? t(`admin.status.${status as ChangeRequestStatus}`) : status;
}

function kindLabel(t: TFunction, kind: string): string {
    return (CHANGE_REQUEST_KIND_OPTIONS as string[]).includes(kind)
        ? t(`report.kind.${kind as ChangeRequestKind}.label`)
        : kind;
}

/** payload JSON 키 → 화면 라벨 (번역 키 `admin.payload.<키>`). 모르는 키는 그대로. */
function parsePayload(t: TFunction, json: string | null): [string, string][] | null {
    if (!json) return [];
    try {
        const obj = JSON.parse(json) as Record<string, unknown>;
        return Object.entries(obj).map(([k, v]) => [
            k in ko.admin.payload ? t(`admin.payload.${k as keyof typeof ko.admin.payload}`) : k,
            v === null ? t("admin.removed") : String(v),
        ]);
    } catch {
        return null; // 깨진 JSON 은 원문 그대로 보여줌
    }
}

/**
 * 제보 검토 (관리자). 휴대폰 폭에서 읽히도록 표 대신 제보마다 카드 한 장:
 * 머리 줄(종류, 번호) / 대상과 상태 / 접수·내용 표 / 검토 메모와 승인·반려.
 */
export function AdminChangeRequestsPage() {
    const { t } = useTranslation();
    const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | "">(ChangeRequestStatus.Pending);
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: ["admin", "change-requests", statusFilter],
        queryFn: () => fetchChangeRequests(statusFilter || undefined),
    });

    const reviewMut = useMutation({
        mutationFn: (args: { id: number; approve: boolean; note?: string }) =>
            reviewChangeRequest(args.id, args.approve, args.note),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["admin", "change-requests"] });
            void qc.invalidateQueries({ queryKey: ["toilets"] }); // 승인하면 지도·목록에 바로 반영되므로
            void qc.invalidateQueries({ queryKey: ["toilet"] }); // 상세 화면도 (대상 이름·영업시간이 바뀜)
        },
    });

    return (
        <Stack spacing={2}>
            <Typography variant="h4" component="h1">
                {t("admin.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {t("admin.intro")}
            </Typography>

            {/* 상태 고르기: 선택 묶음 칸 */}
            <ToggleButtonGroup
                exclusive
                fullWidth
                value={statusFilter}
                onChange={(_, v: ChangeRequestStatus | "" | null) => v !== null && setStatusFilter(v)}
                aria-label={t("admin.statusFilter")}
            >
                <ToggleButton value={ChangeRequestStatus.Pending}>{statusLabel(t, ChangeRequestStatus.Pending)}</ToggleButton>
                <ToggleButton value={ChangeRequestStatus.Approved}>{statusLabel(t, ChangeRequestStatus.Approved)}</ToggleButton>
                <ToggleButton value={ChangeRequestStatus.Rejected}>{statusLabel(t, ChangeRequestStatus.Rejected)}</ToggleButton>
                {/* "" 는 전체: 백엔드는 status 파라미터가 없으면 전체 반환 */}
                <ToggleButton value="">{t("admin.statusAll")}</ToggleButton>
            </ToggleButtonGroup>

            {query.isLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} /> <span>{t("common.loading")}</span>
                </Stack>
            )}
            {query.isError && <Alert severity="error">{friendlyError(query.error, t("admin.loadFailed"))}</Alert>}
            {reviewMut.isError && <Alert severity="error">{friendlyError(reviewMut.error, t("admin.reviewFailed"))}</Alert>}

            {query.data && query.data.length === 0 && <p className="board board-empty">{t("admin.empty")}</p>}
            {query.data?.map((row) => (
                <ChangeRequestCard
                    key={row.id}
                    row={row}
                    onReview={(approve, note) => reviewMut.mutate({ id: row.id, approve, note })}
                    busy={reviewMut.isPending && reviewMut.variables?.id === row.id}
                    disabled={reviewMut.isPending}
                />
            ))}
        </Stack>
    );
}

function ChangeRequestCard({
    row,
    onReview,
    busy,
    disabled,
}: {
    row: ChangeRequestRow;
    onReview: (approve: boolean, note?: string) => void;
    busy: boolean;
    disabled: boolean;
}) {
    const { t } = useTranslation();
    const [note, setNote] = useState("");
    const pending = row.status === ChangeRequestStatus.Pending;
    return (
        <article className="board" aria-label={`${kindLabel(t, row.kind)} #${row.id}`}>
            <div className="activity-head">
                <h2>{kindLabel(t, row.kind)}</h2>
                <span>#{row.id}</span>
            </div>
            <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                    <TargetToiletCell id={row.targetToiletId} />
                    <ChangeRequestStatusTag status={row.status} label={statusLabel(t, row.status)} />
                </Stack>
                <dl className="facts" style={{ marginTop: "var(--space-sm)" }}>
                    <dt>{t("admin.colCreated")}</dt>
                    <dd>{formatDateTime(row.createdAt)}</dd>
                    <PayloadFacts json={row.payloadJson} />
                    {!pending && (
                        <>
                            <dt>{t("admin.colAction")}</dt>
                            <dd>
                                {row.reviewedAt ? t("admin.reviewedAt", { time: formatDateTime(row.reviewedAt) }) : t("admin.reviewed")}
                                {row.reviewNote && <span className="activity-note">{row.reviewNote}</span>}
                            </dd>
                        </>
                    )}
                </dl>
                {pending && (
                    <Stack spacing={1} sx={{ mt: 2 }}>
                        <TextField
                            size="small"
                            fullWidth
                            label={t("admin.reviewNotePlaceholder")}
                            helperText={t("admin.reviewNoteHint")}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={disabled}
                        />
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                            <Button
                                variant="contained"
                                disabled={disabled}
                                onClick={() => onReview(true, note.trim() || undefined)}
                            >
                                {busy ? t("common.sending") : t("admin.approve")}
                            </Button>
                            <Button
                                variant="outlined"
                                disabled={disabled}
                                onClick={() => onReview(false, note.trim() || undefined)}
                            >
                                {t("admin.reject")}
                            </Button>
                        </Box>
                    </Stack>
                )}
            </Box>
        </article>
    );
}

/** 제보 내용 JSON 을 표의 행(dt/dd)으로. 깨진 JSON 은 원문 한 줄로 */
function PayloadFacts({ json }: { json: string | null }) {
    const { t } = useTranslation();
    const entries = parsePayload(t, json);
    if (entries === null) {
        return (
            <>
                <dt>{t("admin.colPayload")}</dt>
                <dd style={{ overflowWrap: "anywhere" }}>{json}</dd>
            </>
        );
    }
    return (
        <>
            {entries.map(([label, value]) => (
                <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd style={{ overflowWrap: "anywhere" }}>{value}</dd>
                </Fragment>
            ))}
        </>
    );
}

/** id 만 오는 대상 화장실을 이름으로 풀어 보여줌. 상세 조회는 react-query 가 id 단위로 캐시. */
function TargetToiletCell({ id }: { id: number | null }) {
    const { t } = useTranslation();
    const q = useQuery({
        enabled: id !== null,
        queryKey: ["toilet", id],
        queryFn: () => fetchToilet(id!),
        staleTime: 5 * 60_000,
    });
    if (id === null) return <span className="board-name">{t("admin.newToilet")}</span>;
    return (
        <Box sx={{ minWidth: 0 }}>
            <span className="board-name">{q.data?.name ?? (q.isError ? t("admin.targetLoadFailed") : "…")}</span>
            <span className="board-meta">
                <span>#{id}</span>
            </span>
        </Box>
    );
}

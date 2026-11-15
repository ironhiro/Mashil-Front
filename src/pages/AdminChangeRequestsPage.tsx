import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    MenuItem,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { formatDateTime } from "../i18n";
import { ko } from "../i18n/locales/ko";
import { friendlyError } from "../lib/friendlyError";
import { fetchChangeRequests, fetchToilet, reviewChangeRequest } from "../api";
import type { ChangeRequestRow } from "../api";
import { CHANGE_REQUEST_KIND_OPTIONS, ChangeRequestStatus, ChangeRequestStatusOrder } from "../lib/enums";
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
        onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "change-requests"] }),
    });

    return (
        <Stack spacing={2}>
            <Typography variant="h4">{t("admin.title")}</Typography>
            <Typography variant="body2" color="text.secondary">
                {t("admin.intro")}
            </Typography>

            <Box sx={{ maxWidth: 220 }}>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label={t("admin.statusFilter")}
                    slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ChangeRequestStatus | "")}
                >
                    {/* "" 는 전체 — 백엔드는 status 파라미터가 없으면 전체 반환 */}
                    <MenuItem value="">{t("admin.statusAll")}</MenuItem>
                    {ChangeRequestStatusOrder.map((s) => (
                        <MenuItem key={s} value={s}>
                            {statusLabel(t, s)}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>

            {query.isLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} /> <span>{t("common.loading")}</span>
                </Stack>
            )}
            {query.isError && (
                <Alert severity="error">{friendlyError(query.error, t("admin.loadFailed"))}</Alert>
            )}
            {reviewMut.isError && (
                <Alert severity="error">{friendlyError(reviewMut.error, t("admin.reviewFailed"))}</Alert>
            )}

            {query.data && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { whiteSpace: "nowrap" } }}>
                                <TableCell>{t("admin.colId")}</TableCell>
                                <TableCell>{t("admin.colKind")}</TableCell>
                                <TableCell>{t("admin.colTarget")}</TableCell>
                                <TableCell>{t("admin.colStatus")}</TableCell>
                                <TableCell>{t("admin.colCreated")}</TableCell>
                                <TableCell>{t("admin.colPayload")}</TableCell>
                                <TableCell align="right">{t("admin.colAction")}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {query.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t("admin.empty")}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {query.data.map((row) => (
                                <ChangeRequestTableRow
                                    key={row.id}
                                    row={row}
                                    onReview={(approve, note) =>
                                        reviewMut.mutate({ id: row.id, approve, note })
                                    }
                                    disabled={reviewMut.isPending || row.status !== ChangeRequestStatus.Pending}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
}

function ChangeRequestTableRow({
    row,
    onReview,
    disabled,
}: {
    row: ChangeRequestRow;
    onReview: (approve: boolean, note?: string) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation();
    const [note, setNote] = useState("");
    return (
        <TableRow>
            <TableCell>{row.id}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{kindLabel(t, row.kind)}</TableCell>
            <TableCell sx={{ minWidth: 120 }}>
                <TargetToiletCell id={row.targetToiletId} />
            </TableCell>
            <TableCell>
                <Chip
                    size="small"
                    label={statusLabel(t, row.status)}
                    color={
                        row.status === ChangeRequestStatus.Approved
                            ? "success"
                            : row.status === ChangeRequestStatus.Rejected
                                ? "default"
                                : "warning"
                    }
                />
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(row.createdAt)}</TableCell>
            <TableCell sx={{ maxWidth: 320 }}>
                <PayloadCell json={row.payloadJson} />
                {row.reviewNote && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {t("admin.reviewNote", { note: row.reviewNote })}
                    </Typography>
                )}
            </TableCell>
            <TableCell align="right">
                {row.status !== ChangeRequestStatus.Pending ? (
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        {row.reviewedAt ? t("admin.reviewedAt", { time: formatDateTime(row.reviewedAt) }) : t("admin.reviewed")}
                    </Typography>
                ) : (
                <Stack direction="column" spacing={0.5} alignItems="flex-end">
                    <TextField
                        size="small"
                        placeholder={t("admin.reviewNotePlaceholder")}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={disabled}
                        sx={{ minWidth: 180 }}
                    />
                    <Stack direction="row" spacing={0.5}>
                        <Button
                            size="small"
                            color="success"
                            variant="contained"
                            disabled={disabled}
                            onClick={() => onReview(true, note.trim() || undefined)}
                        >
                            {t("admin.approve")}
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant="outlined"
                            disabled={disabled}
                            onClick={() => onReview(false, note.trim() || undefined)}
                        >
                            {t("admin.reject")}
                        </Button>
                    </Stack>
                </Stack>
                )}
            </TableCell>
        </TableRow>
    );
}

function PayloadCell({ json }: { json: string | null }) {
    const { t } = useTranslation();
    const entries = parsePayload(t, json);
    if (entries === null) {
        return (
            <Typography variant="caption" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {json}
            </Typography>
        );
    }
    if (entries.length === 0) return <Typography variant="caption" color="text.secondary">{t("detail.none")}</Typography>;
    return (
        <Stack spacing={0.25}>
            {entries.map(([label, value]) => (
                <Typography key={label} variant="caption" sx={{ display: "block" }}>
                    <b>{label}</b> {value}
                </Typography>
            ))}
        </Stack>
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
    if (id === null) return <Typography variant="body2" color="text.secondary">{t("admin.newToilet")}</Typography>;
    return (
        <Box>
            <Typography variant="body2">{q.data?.name ?? (q.isError ? t("admin.targetLoadFailed") : "…")}</Typography>
            <Typography variant="caption" color="text.secondary">#{id}</Typography>
        </Box>
    );
}

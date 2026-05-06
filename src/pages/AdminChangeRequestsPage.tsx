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
import { fetchChangeRequests, reviewChangeRequest } from "../api";
import type { ChangeRequestRow } from "../api";
import { ChangeRequestStatus, ChangeRequestStatusOrder } from "../lib/enums";

/** "" 는 "전체 (필터 없음)" 의 sentinel — 백엔드는 status 파라미터 미전달 시 전체 반환. */
const STATUS_FILTER_OPTIONS: { value: ChangeRequestStatus | ""; label: string }[] = [
    { value: "", label: "전체" },
    ...ChangeRequestStatusOrder.map((s) => ({ value: s, label: s })),
];

export function AdminChangeRequestsPage() {
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
            <Typography variant="h4">변경 요청 큐</Typography>
            <Typography variant="body2" color="text.secondary">
                사용자가 제출한 화장실 추가/수정/삭제 요청. 승인 시 후속 서비스가 실제 토일렛 레코드에
                반영합니다 (현재는 상태만 변경 — 적용 자동화는 다음 작업).
            </Typography>

            <Box sx={{ maxWidth: 220 }}>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label="상태 필터"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ChangeRequestStatus | "")}
                >
                    {STATUS_FILTER_OPTIONS.map((o) => (
                        <MenuItem key={o.value || "all"} value={o.value}>
                            {o.label}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>

            {query.isLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} /> <span>불러오는 중…</span>
                </Stack>
            )}
            {query.isError && (
                <Alert severity="error">조회 실패: {(query.error as Error).message}</Alert>
            )}
            {reviewMut.isError && (
                <Alert severity="error">처리 실패: {(reviewMut.error as Error).message}</Alert>
            )}

            {query.data && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>종류</TableCell>
                                <TableCell>대상 Toilet</TableCell>
                                <TableCell>상태</TableCell>
                                <TableCell>제출 시각 (UTC)</TableCell>
                                <TableCell>Payload</TableCell>
                                <TableCell align="right">조치</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {query.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Typography variant="body2" color="text.secondary">
                                            요청이 없습니다.
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
    const [note, setNote] = useState("");
    return (
        <TableRow>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.kind}</TableCell>
            <TableCell>{row.targetToiletId ?? "—"}</TableCell>
            <TableCell>
                <Chip
                    size="small"
                    label={row.status}
                    color={
                        row.status === ChangeRequestStatus.Approved
                            ? "success"
                            : row.status === ChangeRequestStatus.Rejected
                                ? "default"
                                : "warning"
                    }
                />
            </TableCell>
            <TableCell>{new Date(row.createdAt).toISOString().slice(0, 16).replace("T", " ")}</TableCell>
            <TableCell sx={{ maxWidth: 280 }}>
                <Typography
                    variant="caption"
                    sx={{
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block",
                    }}
                    title={row.payloadJson}
                >
                    {row.payloadJson}
                </Typography>
            </TableCell>
            <TableCell align="right">
                <Stack direction="column" spacing={0.5} alignItems="flex-end">
                    <TextField
                        size="small"
                        placeholder="검토 메모 (선택)"
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
                            승인
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant="outlined"
                            disabled={disabled}
                            onClick={() => onReview(false, note.trim() || undefined)}
                        >
                            반려
                        </Button>
                    </Stack>
                </Stack>
            </TableCell>
        </TableRow>
    );
}

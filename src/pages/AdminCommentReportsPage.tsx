import { useState } from "react";
import { Box, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { fetchCommentReports, setCommentHidden } from "../adminApi";
import type { ReportQueueItem, ReportReason, ReportStatus } from "../adminApi";
import { AdminError, AdminPage, Loading, labelOf } from "../components/AdminParts";
import { formatDateTime } from "../i18n";

const STATUSES: ReportStatus[] = ["Open", "Actioned", "Dismissed"];

/**
 * 댓글 신고 큐 (ADM-02, UGC-05). 서버가 댓글별로 묶어 신고 수 순으로 준다.
 * 카드마다 화장실과 신고 수, 작성자·사유·최근 신고·신고 내용 표, 댓글 본문, 숨기기 또는 복원.
 */
export function AdminCommentReportsPage() {
    const { t } = useTranslation();
    const [status, setStatus] = useState<ReportStatus>("Open");
    const qc = useQueryClient();
    const query = useQuery({ queryKey: ["admin", "comment-reports", status], queryFn: () => fetchCommentReports(status) });
    const hideMut = useMutation({
        mutationFn: (args: { id: number; hidden: boolean }) => setCommentHidden(args.id, args.hidden),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["admin", "comment-reports"] });
            void qc.invalidateQueries({ queryKey: ["comments"] });
        },
    });

    return (
        <AdminPage title={t("adminConsole.commentsTitle")} intro={t("adminConsole.commentsIntro")}>
            <ToggleButtonGroup
                exclusive
                fullWidth
                value={status}
                onChange={(_, v: ReportStatus | null) => v && setStatus(v)}
                aria-label={t("adminConsole.filterStatus")}
            >
                {STATUSES.map((s) => (
                    <ToggleButton key={s} value={s}>
                        {labelOf(t, "reportStatus", s)}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {query.isLoading && <Loading />}
            <AdminError error={query.error} fallback={t("adminConsole.loadFailed")} />
            <AdminError error={hideMut.error} fallback={t("adminConsole.actionFailed")} />
            {query.data?.length === 0 && <p className="board board-empty">{t("adminConsole.reportsEmpty")}</p>}

            {query.data?.map((item) => (
                <ReportCard
                    key={item.commentId}
                    item={item}
                    busy={hideMut.isPending && hideMut.variables?.id === item.commentId}
                    disabled={hideMut.isPending}
                    onHidden={(hidden) => hideMut.mutate({ id: item.commentId, hidden })}
                />
            ))}
        </AdminPage>
    );
}

function ReportCard({ item, busy, disabled, onHidden }: { item: ReportQueueItem; busy: boolean; disabled: boolean; onHidden: (hidden: boolean) => void }) {
    const { t } = useTranslation();
    const reasons = (Object.entries(item.reasons) as [ReportReason, number][])
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${labelOf(t, "reason", r)} ${n}`);
    return (
        <article className="board" aria-label={`#${item.commentId}`}>
            <div className="activity-head">
                <h2>{t("adminConsole.reportCount", { n: item.totalReports })}</h2>
                <span>#{item.commentId}</span>
            </div>
            <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
                <RouterLink to={`/toilets/${item.toiletId}`} className="board-name">
                    {item.toiletName ?? `#${item.toiletId}`}
                </RouterLink>
                <p className="comment-text">{item.text}</p>
                <dl className="facts" style={{ marginTop: "var(--space-sm)" }}>
                    <dt>{t("adminConsole.colAuthor")}</dt>
                    <dd>{item.authorName ?? item.authorId}</dd>
                    <dt>{t("adminConsole.colReasons")}</dt>
                    <dd>{reasons.join(", ")}</dd>
                    <dt>{t("adminConsole.colLastReported")}</dt>
                    <dd>{formatDateTime(item.lastReportedAt)}</dd>
                    {item.details && item.details.length > 0 && (
                        <>
                            <dt>{t("adminConsole.colDetails")}</dt>
                            <dd>
                                {item.details.map((d, i) => (
                                    <span key={i} className="activity-note">
                                        {d}
                                    </span>
                                ))}
                            </dd>
                        </>
                    )}
                </dl>
                {item.hidden && <p className="board-meta">{t("adminConsole.hiddenNow")}</p>}
                <Box sx={{ mt: 2 }}>
                    {item.hidden ? (
                        <Button variant="outlined" fullWidth disabled={disabled} onClick={() => onHidden(false)}>
                            {busy ? t("common.sending") : t("adminConsole.restore")}
                        </Button>
                    ) : (
                        <Button variant="contained" fullWidth disabled={disabled} onClick={() => onHidden(true)}>
                            {busy ? t("common.sending") : t("adminConsole.hide")}
                        </Button>
                    )}
                </Box>
            </Box>
        </article>
    );
}

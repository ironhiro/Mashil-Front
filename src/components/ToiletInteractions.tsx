import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    IconButton,
    Menu,
    MenuItem,
    Rating,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { fetchComments, postComment, postRating, voteComment } from "../api";
import type { CommentRow } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import { formatRelativeOrDate } from "../i18n";
import { friendlyError } from "../lib/friendlyError";
import { useAppStatus } from "../lib/appStatus";
import { ReportSheet } from "./ReportSheet";

/** 서버 댓글 최대 길이 (InteractionEndpoints.MaxCommentLength) */
const COMMENT_MAX = 1000;

interface Props {
    toiletId: number;
    /** /near 응답에 함께 실려온 집계 평점 — 표시용. 평점 없으면 null. */
    averageRating: number | null;
    /** 그 평균을 낸 평점 수 */
    ratingCount?: number;
}

/**
 * 선택된 화장실의 평점·댓글 UI.
 * 백엔드 endpoint 가 `RequireAuthorization()` (Admin 한정 아님) 이라 일반 사용자/관리자 모두 사용 가능.
 * 비로그인 시 안내만 표시.
 */
export function ToiletInteractions({ toiletId, averageRating, ratingCount = 0 }: Props) {
    const auth = useAuth();
    const { t } = useTranslation();
    const qc = useQueryClient();
    const readOnly = useAppStatus().data?.readOnly ?? false;

    const [pendingScore, setPendingScore] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [error, setError] = useState<string | null>(null);
    // 댓글 ⋮ 메뉴 → 신고 시트
    const [menu, setMenu] = useState<{ anchor: HTMLElement; comment: CommentRow } | null>(null);
    const [reporting, setReporting] = useState<CommentRow | null>(null);
    const [snack, setSnack] = useState<string | null>(null);

    const commentsQuery = useQuery({
        queryKey: ["toilet-comments", toiletId],
        queryFn: () => fetchComments(toiletId),
    });

    const ratingMut = useMutation({
        mutationFn: (score: number) => postRating(toiletId, score),
        onSuccess: () => {
            setError(null);
            // 평균 평점은 /near 응답에 실려 오므로 그 쿼리를 다시 받아야 상단 ★ 와 지도 배지가 갱신됨.
            qc.invalidateQueries({ queryKey: ["toilets", "near"] });
            qc.invalidateQueries({ queryKey: ["toilets", "recommended"] }); // 추천 점수의 절반이 평점
            qc.invalidateQueries({ queryKey: ["toilet", toiletId] }); // 상세 화면의 평균
        },
        onError: (e: Error) => setError(friendlyError(e, t("interactions.ratingFailed"))),
    });

    // 도움돼요 / 아니에요: 같은 버튼을 다시 누르면 취소. 응답의 집계로 그 댓글만 바꾼다
    const voteMut = useMutation({
        mutationFn: (args: { id: number; value: 1 | -1 | 0 }) => voteComment(args.id, args.value),
        onSuccess: (r, args) => {
            setError(null);
            qc.setQueryData<CommentRow[]>(["toilet-comments", toiletId], (rows) =>
                rows?.map((c) => (c.id === args.id ? { ...c, upCount: r.upCount, downCount: r.downCount, myVote: r.myVote } : c)),
            );
            qc.invalidateQueries({ queryKey: ["toilets", "recommended"] }); // 추천의 근거가 바뀜
        },
        onError: (e: Error) => setError(friendlyError(e, t("interactions.voteFailed"))),
    });
    const canVote = !!auth.user && !readOnly;

    const commentMut = useMutation({
        mutationFn: (text: string) => postComment(toiletId, text),
        onSuccess: () => {
            setComment("");
            setError(null);
            qc.invalidateQueries({ queryKey: ["toilet-comments", toiletId] });
            qc.invalidateQueries({ queryKey: ["toilets", "near"] }); // 지도 배지의 댓글 수
            qc.invalidateQueries({ queryKey: ["me", "comments"] }); // 내 정보의 댓글 목록
        },
        onError: (e: Error) => setError(friendlyError(e, t("interactions.commentFailed"))),
    });

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                        {t("interactions.title")}
                    </Typography>
                    {averageRating !== null && (
                        <Typography variant="body2" sx={{ color: "var(--color-accent-text)", fontWeight: 600 }}>
                            ★ {averageRating.toFixed(1)}
                            {ratingCount > 0 && ` (${t("interactions.ratingCount", { count: ratingCount })})`}
                        </Typography>
                    )}
                </Stack>

                {readOnly ? (
                    <Alert severity="info">{t("maintenance.readOnly")}</Alert>
                ) : !auth.user ? (
                    <Alert severity="info">{t("interactions.loginRequired")}</Alert>
                ) : (
                    <>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="body2">{t("interactions.myRating")}</Typography>
                            <Rating
                                value={pendingScore}
                                onChange={(_, v) => {
                                    if (v) {
                                        setPendingScore(v);
                                        ratingMut.mutate(v);
                                    }
                                }}
                                disabled={ratingMut.isPending}
                                // MUI 기본 접근성 이름은 영어("4 Stars")라 현재 언어로
                                getLabelText={(v) => t("interactions.starLabel", { count: v })}
                                emptyLabelText={t("interactions.noRating")}
                            />
                            {ratingMut.isPending && <CircularProgress size={16} />}
                            {ratingMut.isSuccess && !ratingMut.isPending && (
                                <Typography variant="caption" color="success.main">{t("interactions.rated")}</Typography>
                            )}
                        </Stack>

                        <Stack spacing={1}>
                            <TextField
                                label={t("interactions.comment")}
                                value={comment}
                                onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                                placeholder={t("interactions.commentPlaceholder")}
                                multiline
                                minRows={2}
                                fullWidth
                                size="small"
                                helperText={`${comment.length}/${COMMENT_MAX}`}
                            />
                            <Box>
                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={commentMut.isPending || !comment.trim()}
                                    onClick={() => commentMut.mutate(comment.trim())}
                                >
                                    {commentMut.isPending ? t("common.sending") : t("interactions.postComment")}
                                </Button>
                            </Box>
                        </Stack>
                    </>
                )}

                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                    {t("interactions.commentCount", { count: commentsQuery.data?.length ?? 0 })}
                </Typography>
                {commentsQuery.isLoading && (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">{t("common.loading")}</Typography>
                    </Stack>
                )}
                {commentsQuery.isError && (
                    <Alert severity="error">{friendlyError(commentsQuery.error, t("interactions.commentsLoadFailed"))}</Alert>
                )}
                {commentsQuery.data && commentsQuery.data.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {t("interactions.noComments")}
                    </Typography>
                )}
                {commentsQuery.data?.map((c) => {
                    const up = c.upCount ?? 0;
                    const down = c.downCount ?? 0;
                    const mine = c.myVote ?? 0;
                    const busy = voteMut.isPending && voteMut.variables?.id === c.id;
                    return (
                        <article key={c.id} className="comment">
                            <div className="comment-head">
                                <div className="comment-meta">
                                    {/* 탈퇴한 작성자는 서버가 한국어 이름을 주므로 플래그로 현재 언어 문구를 쓴다 */}
                                    {(c.authorName || c.authorDeleted) && (
                                        <b>{c.isMine ? t("interactions.me") : c.authorDeleted ? t("interactions.deletedUser") : c.authorName}</b>
                                    )}
                                    <span>{formatRelativeOrDate(c.createdAt)}</span>
                                </div>
                                {/* 남의 댓글만 신고할 수 있다 (탈퇴한 사용자 댓글도 신고는 된다) */}
                                {!c.isMine && !readOnly && (
                                    <IconButton
                                        size="small"
                                        className="comment-more"
                                        aria-label={t("commentReport.menu")}
                                        aria-haspopup="menu"
                                        onClick={(e) => setMenu({ anchor: e.currentTarget, comment: c })}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </div>
                            <p className="comment-text">{c.text}</p>
                            {c.isMine ? (
                                // 내 댓글: 표는 못 누르고 받은 수만
                                <div className="votes">
                                    <span className="vote-tally">
                                        <ThumbUpOutlinedIcon fontSize="inherit" aria-hidden /> {t("interactions.helpfulCount", { count: up })}
                                    </span>
                                    <span className="vote-tally">
                                        <ThumbDownOutlinedIcon fontSize="inherit" aria-hidden /> {t("interactions.notHelpfulCount", { count: down })}
                                    </span>
                                </div>
                            ) : (
                                <div className="votes" role="group" aria-label={t("interactions.voteGroup")}>
                                    <button
                                        type="button"
                                        className="vote"
                                        aria-pressed={mine === 1}
                                        disabled={busy || readOnly}
                                        onClick={() =>
                                            canVote
                                                ? voteMut.mutate({ id: c.id, value: mine === 1 ? 0 : 1 })
                                                : setError(t("interactions.voteLoginRequired"))
                                        }
                                    >
                                        <ThumbUpOutlinedIcon fontSize="inherit" aria-hidden />
                                        {t("interactions.helpful")} {up}
                                    </button>
                                    <button
                                        type="button"
                                        className="vote"
                                        aria-pressed={mine === -1}
                                        disabled={busy || readOnly}
                                        onClick={() =>
                                            canVote
                                                ? voteMut.mutate({ id: c.id, value: mine === -1 ? 0 : -1 })
                                                : setError(t("interactions.voteLoginRequired"))
                                        }
                                    >
                                        <ThumbDownOutlinedIcon fontSize="inherit" aria-hidden />
                                        {t("interactions.notHelpful")} {down}
                                    </button>
                                </div>
                            )}
                        </article>
                    );
                })}
            </CardContent>

            <Menu anchorEl={menu?.anchor} open={menu !== null} onClose={() => setMenu(null)}>
                <MenuItem
                    onClick={() => {
                        const c = menu!.comment;
                        setMenu(null);
                        if (!auth.user) setError(t("commentReport.loginRequired"));
                        else setReporting(c);
                    }}
                >
                    {t("commentReport.action")}
                </MenuItem>
            </Menu>
            <ReportSheet
                comment={reporting}
                onClose={() => setReporting(null)}
                onDone={({ blocked }) => {
                    setReporting(null);
                    setError(null);
                    setSnack(blocked ? t("commentReport.doneBlocked") : t("commentReport.done"));
                    // 차단했으면 그 사람 댓글이 목록에서 빠진다
                    if (blocked) qc.invalidateQueries({ queryKey: ["toilet-comments"] });
                }}
            />
            <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} message={snack} />
        </Card>
    );
}

import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Rating,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchComments, postComment, postRating } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import { formatRelativeOrDate } from "../i18n";
import { friendlyError } from "../lib/friendlyError";

interface Props {
    toiletId: number;
    /** /near 응답에 함께 실려온 집계 평점 — 표시용. 평점 없으면 null. */
    averageRating: number | null;
}

/**
 * 선택된 화장실의 평점·댓글 UI.
 * 백엔드 endpoint 가 `RequireAuthorization()` (Admin 한정 아님) 이라 일반 사용자/관리자 모두 사용 가능.
 * 비로그인 시 안내만 표시.
 */
export function ToiletInteractions({ toiletId, averageRating }: Props) {
    const auth = useAuth();
    const { t } = useTranslation();
    const qc = useQueryClient();

    const [pendingScore, setPendingScore] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [error, setError] = useState<string | null>(null);

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
        },
        onError: (e: Error) => setError(friendlyError(e, t("interactions.ratingFailed"))),
    });

    const commentMut = useMutation({
        mutationFn: (text: string) => postComment(toiletId, text),
        onSuccess: () => {
            setComment("");
            setError(null);
            qc.invalidateQueries({ queryKey: ["toilet-comments", toiletId] });
            qc.invalidateQueries({ queryKey: ["toilets", "near"] }); // 지도 배지의 댓글 수
        },
        onError: (e: Error) => setError(friendlyError(e, t("interactions.commentFailed"))),
    });

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {t("interactions.title")}
                    </Typography>
                    {averageRating !== null && (
                        <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
                            ★ {averageRating.toFixed(1)}
                            {(commentsQuery.data?.length ?? 0) > 0 && ` (${commentsQuery.data!.length})`}
                        </Typography>
                    )}
                </Stack>

                {!auth.user ? (
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
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t("interactions.commentPlaceholder")}
                                multiline
                                minRows={2}
                                fullWidth
                                size="small"
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
                {commentsQuery.data?.map((c) => (
                    <Box key={c.id} sx={{ borderTop: 1, borderColor: "divider", py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            {formatRelativeOrDate(c.createdAt)}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                            {c.text}
                        </Typography>
                    </Box>
                ))}
            </CardContent>
        </Card>
    );
}

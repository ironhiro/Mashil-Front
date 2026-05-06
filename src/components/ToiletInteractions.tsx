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
        onSuccess: () => setError(null),
        onError: (e: Error) => setError(`평점 등록 실패: ${e.message}`),
    });

    const commentMut = useMutation({
        mutationFn: (text: string) => postComment(toiletId, text),
        onSuccess: () => {
            setComment("");
            setError(null);
            qc.invalidateQueries({ queryKey: ["toilet-comments", toiletId] });
        },
        onError: (e: Error) => setError(`댓글 등록 실패: ${e.message}`),
    });

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        평점 · 댓글
                    </Typography>
                    {averageRating !== null && (
                        <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
                            ★ {averageRating.toFixed(1)}
                            {(commentsQuery.data?.length ?? 0) > 0 && ` (${commentsQuery.data!.length})`}
                        </Typography>
                    )}
                </Stack>

                {!auth.user ? (
                    <Alert severity="info">평점·댓글은 로그인 후 가능해요.</Alert>
                ) : (
                    <>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="body2">내 평점</Typography>
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
                                <Typography variant="caption" color="success.main">등록됨</Typography>
                            )}
                        </Stack>

                        <Stack spacing={1}>
                            <TextField
                                label="댓글"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="이 화장실에 대한 정보를 공유해 주세요"
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
                                    {commentMut.isPending ? "전송 중…" : "댓글 등록"}
                                </Button>
                            </Box>
                        </Stack>
                    </>
                )}

                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                    댓글 {commentsQuery.data?.length ?? 0}개
                </Typography>
                {commentsQuery.isLoading && (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">불러오는 중…</Typography>
                    </Stack>
                )}
                {commentsQuery.isError && (
                    <Alert severity="error">댓글 조회 실패: {(commentsQuery.error as Error).message}</Alert>
                )}
                {commentsQuery.data && commentsQuery.data.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                        아직 댓글이 없어요. 첫 댓글을 남겨보세요.
                    </Typography>
                )}
                {commentsQuery.data?.map((c) => (
                    <Box key={c.id} sx={{ borderTop: 1, borderColor: "divider", py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            {formatRelativeOrAbs(c.createdAt)}
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

/** 24시간 이내는 상대시간, 그 이후는 yyyy-MM-dd HH:mm. */
function formatRelativeOrAbs(iso: string): string {
    const dt = new Date(iso);
    const diffMs = Date.now() - dt.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}시간 전`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}일 전`;
    return dt.toISOString().slice(0, 16).replace("T", " ");
}

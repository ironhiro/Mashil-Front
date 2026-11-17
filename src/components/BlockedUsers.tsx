import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchBlockedUsers, unblockUser } from "../api";
import { formatDateTime } from "../i18n";
import { friendlyError } from "../lib/friendlyError";

/** 설정: 신고 시트에서 "이 사용자 댓글 보지 않기"로 차단한 사람 목록과 해제 */
export function BlockedUsers() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const query = useQuery({ queryKey: ["me", "blocks"], queryFn: fetchBlockedUsers });
    const unblock = useMutation({
        mutationFn: unblockUser,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["me", "blocks"] });
            qc.invalidateQueries({ queryKey: ["toilet-comments"] }); // 그 사람 댓글이 다시 보인다
        },
    });

    return (
        <Box component="section" className="plate" aria-labelledby="settings-blocks" sx={{ gap: 1 }}>
            <Typography id="settings-blocks" component="h2" variant="overline" color="text.secondary">
                {t("blocks.title")}
            </Typography>
            {query.isLoading && <CircularProgress size={16} />}
            {query.isError && <Alert severity="error">{friendlyError(query.error, t("blocks.loadFailed"))}</Alert>}
            {query.data?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    {t("blocks.empty")}
                </Typography>
            )}
            {query.data?.map((u) => (
                <Stack key={u.userId} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{u.displayName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t("blocks.since", { time: formatDateTime(u.blockedAt) })}
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        disabled={unblock.isPending && unblock.variables === u.userId}
                        onClick={() => unblock.mutate(u.userId)}
                        sx={{ flexShrink: 0 }}
                    >
                        {t("blocks.unblock")}
                    </Button>
                </Stack>
            ))}
            {unblock.isError && <Alert severity="error">{friendlyError(unblock.error, t("blocks.unblockFailed"))}</Alert>}
        </Box>
    );
}

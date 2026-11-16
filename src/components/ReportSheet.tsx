import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Drawer,
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { blockUser, reportComment, REPORT_REASONS } from "../api";
import type { CommentRow, ReportReason } from "../api";
import { friendlyError } from "../lib/friendlyError";

/** 서버 Moderation:AutoHideReportCount 기본값. 서로 다른 사람이 이만큼 신고하면 관리자 확인 전까지 가린다 */
const AUTO_HIDE_COUNT = 3;
const DETAIL_MAX = 500;

interface Props {
    /** 신고할 댓글. null 이면 닫힘 */
    comment: CommentRow | null;
    onClose: () => void;
    /** 신고(와 차단)가 끝났을 때. blocked = 작성자를 차단했음 */
    onDone: (result: { blocked: boolean }) => void;
}

/**
 * 댓글 신고 시트 (07-ui-design 댓글·신고): 대상 댓글 인용, 사유 4종, "이 사용자 댓글 보지 않기"(차단),
 * 자동 가림 안내, 취소 / 신고하기 (사유를 골라야 켜짐).
 */
export function ReportSheet({ comment, onClose, onDone }: Props) {
    const { t } = useTranslation();
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [detail, setDetail] = useState("");
    const [block, setBlock] = useState(false);

    const reset = () => {
        setReason(null);
        setDetail("");
        setBlock(false);
        mut.reset();
    };
    const close = () => {
        reset();
        onClose();
    };

    const mut = useMutation({
        mutationFn: async (c: CommentRow) => {
            try {
                await reportComment(c.id, reason!, detail.trim() || undefined);
            } catch (e) {
                // 이미 신고한 댓글이어도 차단은 따로 할 수 있게 한다
                if (!(block && (e as Error).message.includes("already_reported"))) throw e;
            }
            if (block) await blockUser(c.userId);
        },
        onSuccess: () => {
            const blocked = block;
            reset();
            onDone({ blocked });
        },
    });

    const quote = comment?.text ?? "";
    return (
        <Drawer anchor="bottom" open={comment !== null} onClose={close} slotProps={{ paper: { sx: { maxWidth: 640, mx: "auto" } } }}>
            <Box
                component="form"
                sx={{ px: 2, pt: 1.5, pb: "calc(16px + env(safe-area-inset-bottom))" }}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (comment && reason) mut.mutate(comment);
                }}
            >
                <Typography component="h2" variant="h6" id="report-title">
                    {t("commentReport.title")}
                </Typography>
                {/* 무엇을 신고하는지 보이게: 대상 댓글 인용 (길면 세 줄까지) */}
                <blockquote className="report-quote">
                    {comment?.authorName && <b>{comment.authorName}</b>}
                    <span>{quote}</span>
                </blockquote>

                <FormControl component="fieldset" sx={{ mt: 1.5, width: "100%" }}>
                    <FormLabel component="legend" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {t("commentReport.reasonLabel")}
                    </FormLabel>
                    <RadioGroup value={reason ?? ""} onChange={(e) => setReason(e.target.value as ReportReason)}>
                        {REPORT_REASONS.map((r) => (
                            <FormControlLabel key={r} value={r} control={<Radio />} label={t(`commentReport.reasons.${r}`)} />
                        ))}
                    </RadioGroup>
                </FormControl>

                {reason === "Other" && (
                    <TextField
                        label={t("commentReport.detail")}
                        value={detail}
                        onChange={(e) => setDetail(e.target.value.slice(0, DETAIL_MAX))}
                        multiline
                        minRows={2}
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        helperText={`${detail.length}/${DETAIL_MAX}`}
                    />
                )}

                <FormControlLabel
                    sx={{ mt: 1 }}
                    control={<Checkbox checked={block} onChange={(e) => setBlock(e.target.checked)} />}
                    label={t("commentReport.block")}
                />

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t("commentReport.policy", { count: AUTO_HIDE_COUNT })}
                </Typography>

                {mut.isError && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                        {friendlyError(mut.error, t("commentReport.failed"))}
                    </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button variant="outlined" size="large" onClick={close} sx={{ flex: 1 }}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="submit" variant="contained" size="large" disabled={!reason || mut.isPending} sx={{ flex: 1 }}>
                        {mut.isPending ? t("common.sending") : t("commentReport.submit")}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
}

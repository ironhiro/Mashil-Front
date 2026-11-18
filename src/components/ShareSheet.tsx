import { useState } from "react";
import { Alert, Box, Button, Snackbar, Stack, Typography } from "@mui/material";
import ChatBubbleIcon from "@mui/icons-material/ChatBubbleOutline";
import IosShareIcon from "@mui/icons-material/IosShare";
import LinkIcon from "@mui/icons-material/Link";
import { useTranslation } from "react-i18next";
import { copyText } from "../lib/copyText";
import { friendlyError } from "../lib/friendlyError";
import { canSystemShare, share } from "../lib/share";
import type { SharePayload, ShareTarget } from "../lib/share";
import { BottomSheet, sheetBottomPad } from "./BottomSheet";

interface Props {
    open: boolean;
    onClose: () => void;
    payload: SharePayload;
}

/** 공유 시트: 카카오톡으로 보내기 · 다른 앱으로 공유 · 링크 복사. */
export function ShareSheet({ open, onClose, payload }: Props) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<ShareTarget | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [snack, setSnack] = useState<string | null>(null);

    const close = () => {
        setError(null);
        onClose();
    };

    const copy = async (message = t("share.copied")) => {
        if (await copyText(payload.url)) {
            setSnack(message);
            close();
        } else {
            setError(t("share.copyFailed"));
        }
    };

    const send = async (target: ShareTarget) => {
        setBusy(target);
        setError(null);
        try {
            const r = await share(target, payload);
            if (r === "unsupported") await copy(t("share.copiedInstead"));
            else if (r === "done") close();
        } catch (e) {
            setError(friendlyError(e, t("share.failed")));
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <BottomSheet open={open} onClose={close}>
                <Box sx={{ px: 2, pb: sheetBottomPad }}>
                    <Typography component="h2" variant="h6">
                        {t("share.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
                        {payload.title}
                    </Typography>
                    {error && (
                        <Alert severity="warning" sx={{ mt: 1.5 }}>
                            {error}
                        </Alert>
                    )}
                    <Stack spacing={1} sx={{ mt: 2 }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<ChatBubbleIcon />}
                            disabled={busy !== null}
                            onClick={() => void send("kakao")}
                        >
                            {t("share.kakao")}
                        </Button>
                        {canSystemShare() && (
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<IosShareIcon />}
                                disabled={busy !== null}
                                onClick={() => void send("system")}
                            >
                                {t("share.system")}
                            </Button>
                        )}
                        <Button variant="outlined" size="large" startIcon={<LinkIcon />} disabled={busy !== null} onClick={() => void copy()}>
                            {t("share.copy")}
                        </Button>
                    </Stack>
                </Box>
            </BottomSheet>
            <Snackbar open={snack !== null} autoHideDuration={2500} onClose={() => setSnack(null)} message={snack} />
        </>
    );
}

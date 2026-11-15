import { useState } from "react";
import { IconButton, Snackbar } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTranslation } from "react-i18next";
import { copyText } from "../lib/copyText";

interface Props {
    /** 복사할 글자 */
    text: string;
    /** 무엇을 복사하는지 (예: "주소"). 버튼 이름과 완료 안내에 쓴다 */
    what: string;
}

/** 글자 옆의 작은 복사 버튼. 복사하면 아래에 짧게 알린다. */
export function CopyButton({ text, what }: Props) {
    const { t } = useTranslation();
    const [done, setDone] = useState<null | boolean>(null);
    return (
        <>
            <IconButton
                size="small"
                aria-label={t("copy.button", { what })}
                onClick={() => void copyText(text).then(setDone)}
                sx={{ ml: 0.5, my: -0.5, color: "var(--color-muted)" }}
            >
                <ContentCopyIcon fontSize="small" />
            </IconButton>
            <Snackbar
                open={done !== null}
                autoHideDuration={2000}
                onClose={() => setDone(null)}
                message={done ? t("copy.done", { what }) : t("copy.failed")}
            />
        </>
    );
}

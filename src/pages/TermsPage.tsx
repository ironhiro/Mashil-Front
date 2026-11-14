import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { ConsentDocType } from "../api";

const KNOWN: ConsentDocType[] = ["Terms", "Privacy", "LocationTerms"];

/**
 * 약관 보기. 본문은 아직 없다 — 법무 검토를 거친 문서가 나오면 여기에 채운다 (백엔드에 문서 API 가 생기면 그걸로).
 */
export function TermsPage() {
    const { docType } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const version = (useLocation().state as { version?: string } | null)?.version;
    const doc = KNOWN.includes(docType as ConsentDocType) ? (docType as ConsentDocType) : "Terms";

    return (
        <Box sx={{ maxWidth: 640, mx: "auto" }}>
            <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
                {t(`consent.docs.${doc}`)}
            </Typography>
            {version && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    {t("terms.version", { version })}
                </Typography>
            )}
            <Alert severity="info" sx={{ mb: 2 }}>
                {t("terms.preparing")}
            </Alert>
            <Button color="secondary" onClick={() => navigate(-1)}>
                {t("detail.back")}
            </Button>
        </Box>
    );
}

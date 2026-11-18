import { Alert, Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { LegalDocType } from "../legal/documents";
import { hasPlaceholders, LEGAL_DOCS } from "../legal/documents";
import { OPERATOR } from "../legal/operator";

const KNOWN: LegalDocType[] = ["Terms", "Privacy", "LocationTerms"];

/**
 * 약관 보기 (LEG-02, LEG-03). 본문은 src/legal/documents.ts 에 있다 (한국어가 정본).
 * 운영자 정보나 자리표시가 비어 있으면 초안 안내를 띄운다.
 */
export function TermsPage() {
    const { docType } = useParams();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const version = (useLocation().state as { version?: string } | null)?.version;
    const docKey = KNOWN.includes(docType as LegalDocType) ? (docType as LegalDocType) : "Terms";
    const doc = LEGAL_DOCS[docKey];
    const draft = OPERATOR.isDraft || hasPlaceholders(doc);

    return (
        <Box component="article" lang="ko" sx={{ maxWidth: 640, mx: "auto" }}>
            <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
                {doc.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {version ? `${t("terms.version", { version })} ` : null}
                {t("terms.effective", { date: OPERATOR.effectiveDate })}
            </Typography>
            {draft && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {t("terms.draft")}
                </Alert>
            )}
            {!i18n.language.startsWith("ko") && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    {t("terms.koreanOnly")}
                </Alert>
            )}

            {doc.sections.map((s) => (
                <Box component="section" key={s.heading} sx={{ mb: 3 }}>
                    <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                        {s.heading}
                    </Typography>
                    {s.body.map((b, i) =>
                        Array.isArray(b) ? (
                            <Box component="ul" key={i} sx={{ pl: 3, my: 1 }}>
                                {b.map((li) => (
                                    <Typography component="li" variant="body2" key={li} sx={{ mb: 0.5 }}>
                                        {li}
                                    </Typography>
                                ))}
                            </Box>
                        ) : (
                            <Typography variant="body2" key={i} sx={{ mb: 1 }}>
                                {b}
                            </Typography>
                        ),
                    )}
                </Box>
            ))}

            <Button color="secondary" onClick={() => navigate(-1)}>
                {t("detail.back")}
            </Button>
        </Box>
    );
}

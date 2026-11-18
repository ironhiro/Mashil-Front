import { useEffect, useState } from "react";
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Link, Stack, TextField, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { fetchConsents, postConsents, updateDisplayName } from "../api";
import type { ConsentDocType } from "../api";
import { useAuth } from "../auth/AuthContext";
import { friendlyError } from "../lib/friendlyError";
import { userTag } from "../lib/userTag";

/** 화면에 늘어놓는 순서. 실제로 받을 항목은 서버(`/api/me/consents`)가 정한다 (지금은 Terms, Privacy, AgeOver14) */
const DOC_ORDER: ConsentDocType[] = ["Terms", "Privacy", "AgeOver14", "LocationTerms"];
/** 본문 없이 확인만 받는 항목 ("보기" 링크 없음) */
const CONFIRM_ONLY: ConsentDocType[] = ["AgeOver14"];
const NONE_CHECKED: Record<ConsentDocType, boolean> = { Terms: false, Privacy: false, LocationTerms: false, AgeOver14: false };
const NAME_MAX = 20;

/**
 * 약관 동의 (docs/07-ui-design.md §7 "약관 동의"): 첫 로그인 직후 한 번.
 * 표시 이름(IdP 닉네임 기본값, 중복 허용 · 이름#1234 로 보임) + 모두 동의 + 필수 항목(이용약관, 개인정보, 만 14세 이상)
 * + 위치 정보 안내(보기만). 필수가 모두 체크되고 이름이 있어야 시작 버튼이 켜진다.
 */
export function ConsentPage() {
    const auth = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [name, setName] = useState(auth.user?.displayName ?? "");
    const [checked, setChecked] = useState<Record<ConsentDocType, boolean>>(NONE_CHECKED);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const query = useQuery({ enabled: !!auth.user, queryKey: ["consents"], queryFn: fetchConsents });

    useEffect(() => {
        if (auth.user?.displayName && !name) setName(auth.user.displayName);
    }, [auth.user?.displayName, name]);

    if (!auth.user) return <Navigate to="/login" replace />;

    const docs = DOC_ORDER.map((d) => query.data?.documents.find((x) => x.docType === d)).filter(Boolean) as {
        docType: ConsentDocType;
        version: string;
    }[];
    const allChecked = docs.length > 0 && docs.every((d) => checked[d.docType]);
    const trimmed = name.trim();
    const canStart = allChecked && trimmed.length > 0 && trimmed.length <= NAME_MAX && !saving;

    const start = async () => {
        setError(null);
        setSaving(true);
        try {
            if (trimmed !== (auth.user?.displayName ?? "")) {
                await updateDisplayName(trimmed);
                auth.setDisplayName(trimmed);
            }
            await postConsents(docs.map((d) => ({ docType: d.docType, version: d.version })));
            navigate("/", { replace: true });
        } catch (e) {
            if ((e as Error).message.includes("consent_version_mismatch")) {
                // 약관이 그 사이 바뀜 — 새 버전을 받아 다시 보여 준다
                setChecked(NONE_CHECKED);
                await qc.invalidateQueries({ queryKey: ["consents"] });
                setError(t("consent.versionChanged"));
            } else {
                setError(friendlyError(e, t("consent.saveFailed")));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 480, mx: "auto" }}>
            <Typography component="h1" variant="h5">
                {t("consent.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t("consent.intro")}
            </Typography>

            <TextField
                label={t("consent.displayName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                helperText={t("consent.displayNameHelp", { name: trimmed || t("app.defaultUserName"), tag: userTag(auth.user.id) })}
                slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
                fullWidth
                sx={{ mb: 3 }}
            />

            {query.isLoading && <CircularProgress size={20} />}
            {query.isError && <Alert severity="error">{friendlyError(query.error, t("consent.loadFailed"))}</Alert>}

            {docs.length > 0 && (
                <Box sx={{ border: "var(--rule-bar) solid var(--color-ink)", bgcolor: "var(--color-paper-3)", mb: 2 }}>
                    <FormControlLabel
                        sx={{ m: 0, px: 1.5, py: 1, width: "100%", borderBottom: "var(--rule-bar) solid var(--color-ink)" }}
                        control={
                            <Checkbox
                                checked={allChecked}
                                indeterminate={!allChecked && docs.some((d) => checked[d.docType])}
                                onChange={(e) => setChecked(Object.fromEntries(docs.map((d) => [d.docType, e.target.checked])) as Record<ConsentDocType, boolean>)}
                            />
                        }
                        label={<Typography sx={{ fontWeight: 700 }}>{t("consent.agreeAll")}</Typography>}
                    />
                    {docs.map((d) => (
                        <Stack key={d.docType} direction="row" alignItems="center" sx={{ px: 1.5, py: 0.5 }}>
                            <FormControlLabel
                                sx={{ m: 0, flex: 1 }}
                                control={
                                    <Checkbox
                                        checked={checked[d.docType]}
                                        onChange={(e) => setChecked((c) => ({ ...c, [d.docType]: e.target.checked }))}
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        {t(`consent.docs.${d.docType}`)}{" "}
                                        <Box component="span" sx={{ color: "text.secondary" }}>
                                            {t("consent.required")}
                                        </Box>
                                    </Typography>
                                }
                            />
                            {!CONFIRM_ONLY.includes(d.docType) && (
                                <Link component={RouterLink} to={`/terms/${d.docType}`} state={{ version: d.version }} color="secondary" variant="body2" sx={{ fontWeight: 600, px: 1, py: 1.25 }}>
                                    {t("consent.view")}
                                </Link>
                            )}
                        </Stack>
                    ))}
                </Box>
            )}

            {/* 위치 정보 안내는 별도 칸 (NFR-06). 위치를 기기에서만 써서 동의가 아니라 안내만 한다 */}
            <Box className="plate" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                        {t("consent.locationNote")}
                    </Typography>
                    <Link component={RouterLink} to="/terms/LocationTerms" color="secondary" variant="body2" sx={{ fontWeight: 600, px: 1, py: 1.25, flexShrink: 0 }}>
                        {t("consent.view")}
                    </Link>
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            <Button variant="contained" fullWidth size="large" disabled={!canStart} onClick={() => void start()}>
                {saving ? t("common.sending") : t("consent.start")}
            </Button>
        </Box>
    );
}

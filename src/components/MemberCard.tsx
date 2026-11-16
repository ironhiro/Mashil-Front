import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Link,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { accountErrorCode, updateMyDisplayName } from "../api";
import { useAuth, userLabel } from "../auth/AuthContext";
import type { AuthUser } from "../auth/AuthContext";
import { SUPPORTED_LANGUAGES, currentLanguage } from "../i18n";
import type { LanguageCode } from "../i18n";
import { UserRole } from "../lib/enums";
import { NativeSignInCancelled, isApp } from "../lib/nativeBridge";

/** 언어 고르기. 비회원은 내 정보에 그대로(h2), 회원은 회원 카드의 "설정"(h3) 아래(h4) */
export function LanguagePicker({ headingLevel = "h2" }: { headingLevel?: "h2" | "h4" }) {
    const { t, i18n } = useTranslation();
    return (
        <Box>
            <Typography variant="subtitle1" component={headingLevel} sx={{ mb: 1, fontWeight: 800 }}>
                {/* 언어 이름은 번역하지 않고 각 언어로 표기 (내가 못 읽는 언어로 바뀌어도 돌아올 수 있게) */}
                {t("nav.language")}
                {currentLanguage() !== "en" && " / Language"}
            </Typography>
            <ToggleButtonGroup
                exclusive
                fullWidth
                value={currentLanguage()}
                onChange={(_, v: LanguageCode | null) => v && void i18n.changeLanguage(v)}
                aria-label={t("nav.language")}
            >
                {SUPPORTED_LANGUAGES.map((l) => (
                    <ToggleButton key={l.code} value={l.code} lang={l.code}>
                        {l.label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
        </Box>
    );
}

/**
 * 회원 카드: 이름과 로그인 방법, 그 아래 설정 (이름 바꾸기, 언어, 로그아웃, 회원 탈퇴).
 * 탈퇴는 되돌릴 수 없어 맨 아래 글자 링크로 두고, 누르면 확인 창을 거친다.
 */
export function MemberCard({ user }: { user: AuthUser }) {
    const { t } = useTranslation();
    const auth = useAuth();
    const navigate = useNavigate();
    const [renaming, setRenaming] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const provider = user.provider ? t(`me.providers.${user.provider}`) : null;

    return (
        <Box component="section" className="plate" aria-labelledby="member-name" sx={{ gap: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography id="member-name" component="h2" sx={{ fontWeight: 800, fontSize: "var(--text-xl)", overflowWrap: "anywhere" }}>
                        {userLabel(user)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {user.role === UserRole.Admin ? t("app.roleAdmin") : t("app.roleUser")}
                        {provider && ` · ${t("me.signedInWith", { provider })}`}
                    </Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={() => setRenaming(true)} sx={{ flexShrink: 0 }}>
                    {t("me.rename")}
                </Button>
            </Stack>

            <Box sx={{ borderTop: "var(--rule-hair) solid var(--color-rule)", pt: 2 }}>
                <Typography variant="overline" component="h3" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    {t("me.settings")}
                </Typography>
                <Stack spacing={2}>
                    <LanguagePicker headingLevel="h4" />
                    <Button
                        variant="outlined"
                        size="large"
                        onClick={() => {
                            auth.logout();
                            navigate("/");
                        }}
                    >
                        {t("nav.logout")}
                    </Button>
                    <Link component="button" type="button" variant="body2" color="error" onClick={() => setWithdrawing(true)} sx={{ alignSelf: "center" }}>
                        {t("me.withdraw")}
                    </Link>
                </Stack>
            </Box>

            <RenameDialog open={renaming} current={user.displayName ?? ""} onClose={() => setRenaming(false)} />
            <WithdrawDialog open={withdrawing} user={user} onClose={() => setWithdrawing(false)} />
        </Box>
    );
}

function RenameDialog({ open, current, onClose }: { open: boolean; current: string; onClose: () => void }) {
    const { t } = useTranslation();
    const auth = useAuth();
    const [name, setName] = useState(current);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const trimmed = name.trim();

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const saved = await updateMyDisplayName(trimmed);
            auth.setDisplayName(saved ?? trimmed);
            onClose();
        } catch (e) {
            setError(accountErrorCode(e) === "display_name_required" ? t("me.renameHelp") : t("me.renameFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            slotProps={{ transition: { onEnter: () => (setName(current), setError(null)) } }}
        >
            <DialogTitle>{t("me.renameTitle")}</DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    margin="dense"
                    label={t("me.renameLabel")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 20 } }}
                    helperText={error ?? t("me.renameHelp")}
                    error={!!error}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    {t("common.cancel")}
                </Button>
                <Button variant="contained" onClick={() => void save()} disabled={busy || !trimmed || trimmed === current}>
                    {t("me.renameSave")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function WithdrawDialog({ open, user, onClose }: { open: boolean; user: AuthUser; onClose: () => void }) {
    const { t } = useTranslation();
    const auth = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const provider = user.provider ? t(`me.providers.${user.provider}`) : null;
    // 소셜 로그인은 앱 SDK 로만 다시 확인할 수 있다
    const appOnly = !!user.provider && !isApp();

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            await auth.deleteAccount(user.provider ? undefined : password);
            onClose();
            navigate("/", { replace: true, state: { notice: t("me.withdrawDone") } });
        } catch (e) {
            if (e instanceof NativeSignInCancelled) return;
            const code = accountErrorCode(e);
            setError(
                code === "reauth_required" || code === "identity_mismatch" || code === "invalid_credential"
                    ? t(`me.withdrawErrors.${code}`)
                    : t("me.withdrawErrors.generic"),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            slotProps={{ transition: { onEnter: () => (setPassword(""), setError(null)) } }}
        >
            <DialogTitle>{t("me.withdrawTitle")}</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5}>
                    <Typography variant="body2">{t("me.withdrawBody1")}</Typography>
                    <Typography variant="body2">{t("me.withdrawBody2")}</Typography>
                    {appOnly ? (
                        <Alert severity="info">{t("me.withdrawAppOnly", { provider })}</Alert>
                    ) : provider ? (
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {t("me.withdrawReauth", { provider })}
                        </Typography>
                    ) : (
                        <TextField
                            type="password"
                            autoComplete="current-password"
                            label={t("me.withdrawPasswordLabel")}
                            helperText={t("me.withdrawPassword")}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            fullWidth
                        />
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={() => void confirm()}
                    disabled={busy || appOnly || (!user.provider && !password)}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" aria-hidden /> : undefined}
                >
                    {t("me.withdrawConfirm")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

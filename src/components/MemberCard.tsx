import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    ButtonBase,
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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { accountErrorCode, updateMyDisplayName } from "../api";
import { useAuth, userLabel } from "../auth/AuthContext";
import type { AuthUser } from "../auth/AuthContext";
import { SUPPORTED_LANGUAGES, currentLanguage } from "../i18n";
import type { LanguageCode } from "../i18n";
import { UserRole } from "../lib/enums";
import { NativeSignInCancelled, isApp } from "../lib/nativeBridge";
import { BlockedUsers } from "./BlockedUsers";

/** 언어 고르기. 비회원은 내 정보에, 회원은 설정 화면에 */
export function LanguagePicker() {
    const { t, i18n } = useTranslation();
    return (
        <Box>
            <Typography variant="subtitle1" component="h2" sx={{ mb: 1, fontWeight: 800 }}>
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
 * 내 정보의 회원 카드: 이름과 로그인 방법만. 누르면 설정 화면(/me/settings)으로 간다.
 */
export function MemberCard({ user }: { user: AuthUser }) {
    const { t } = useTranslation();
    return (
        <ButtonBase
            component={RouterLink}
            to="/me/settings"
            // .plate 모양을 직접 준다 (ButtonBase 기본 스타일이 테두리·바탕·여백을 지운다)
            sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: "var(--space-md)",
                textAlign: "left",
                border: "var(--rule-bar) solid var(--color-ink)",
                bgcolor: "var(--color-paper-3)",
                color: "var(--color-ink)",
                "&:hover": { bgcolor: "var(--color-paper-2)" },
                "&.Mui-focusVisible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 },
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h2" sx={{ fontWeight: 800, fontSize: "var(--text-xl)", overflowWrap: "anywhere" }}>
                    {userLabel(user)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {user.role === UserRole.Admin ? t("app.roleAdmin") : t("app.roleUser")}
                </Typography>
            </Box>
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "var(--color-ink)", fontWeight: 800, flexShrink: 0 }}>
                <SettingsOutlinedIcon fontSize="small" aria-hidden />
                {t("me.settings")}
                <ChevronRightIcon aria-hidden />
            </Box>
        </ButtonBase>
    );
}

/**
 * 설정 화면의 내용: 계정(이름, 이름 바꾸기), 언어, 로그아웃, 회원 탈퇴.
 * 탈퇴는 되돌릴 수 없어 맨 아래 글자 링크로 두고, 누르면 확인 창을 거친다.
 */
export function AccountSettings({ user }: { user: AuthUser }) {
    const { t } = useTranslation();
    const auth = useAuth();
    const navigate = useNavigate();
    const [renaming, setRenaming] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);

    return (
        <Stack spacing={3}>
            <Box component="section" className="plate" aria-labelledby="settings-account" sx={{ gap: 1.5 }}>
                <Typography id="settings-account" component="h2" variant="overline" color="text.secondary">
                    {t("me.account")}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "var(--text-lg)", overflowWrap: "anywhere" }}>{userLabel(user)}</Typography>
                    </Box>
                    <Button variant="outlined" size="small" onClick={() => setRenaming(true)} sx={{ flexShrink: 0 }}>
                        {t("me.rename")}
                    </Button>
                </Stack>
            </Box>

            <Box component="section" className="plate">
                <LanguagePicker />
            </Box>

            <BlockedUsers />

            <Stack spacing={2}>
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
                <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setWithdrawing(true)}
                    sx={{ alignSelf: "center", color: "var(--color-error)", fontWeight: 700, textDecorationColor: "currentColor" }}
                >
                    {t("me.withdraw")}
                </Link>
            </Stack>

            <RenameDialog open={renaming} current={user.displayName ?? ""} onClose={() => setRenaming(false)} />
            <WithdrawDialog open={withdrawing} user={user} onClose={() => setWithdrawing(false)} />
        </Stack>
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
            // 되돌릴 수 없는 일이라 경고창으로: 테마 오류색 테두리와 제목, 화면 낭독기에는 alertdialog
            slotProps={{
                transition: { onEnter: () => (setPassword(""), setError(null)) },
                paper: {
                    role: "alertdialog",
                    "aria-labelledby": "withdraw-title",
                    "aria-describedby": "withdraw-desc",
                    sx: { border: "var(--rule-bar) solid var(--color-error)", borderTopWidth: 6 },
                },
            }}
        >
            <DialogTitle id="withdraw-title" sx={{ color: "var(--color-error)", display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
                <WarningAmberIcon aria-hidden />
                {t("me.withdrawAsk")}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={1.5}>
                    <Alert id="withdraw-desc" severity="error" icon={false}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {t("me.withdrawBody1")}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            {t("me.withdrawBody2")}
                        </Typography>
                    </Alert>
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

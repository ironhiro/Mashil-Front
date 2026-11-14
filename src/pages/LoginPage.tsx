import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Divider,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { getAppProviders, NativeSignInCancelled } from "../lib/nativeBridge";
import { friendlyError } from "../lib/friendlyError";
import { fonts, tileGrid } from "../design/tokens";
import type { SocialProvider } from "../lib/nativeBridge";

type Mode = "login" | "register";

const PROVIDER_ORDER: SocialProvider[] = ["kakao", "google", "apple"];

/** 제공자별 버튼 색 (각 사 브랜드 가이드). 문구는 번역 키 `login.continueWith.<제공자>`. */
const PROVIDER_BUTTON: Record<SocialProvider, { sx: object }> = {
    kakao: {
        sx: { bgcolor: "#FEE500", color: "rgba(0,0,0,0.85)", "&:hover": { bgcolor: "#F5DC00" } },
    },
    google: {
        sx: { bgcolor: "#fff", color: "#1f1f1f", border: "1px solid #747775", "&:hover": { bgcolor: "#f5f5f5" } },
    },
    apple: {
        sx: { bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } },
    },
};

/** 앱 안에서만 보이는 네이티브 소셜 로그인 버튼 (웹뷰 안 OAuth 는 Google 이 막음). */
function SocialLoginButtons({ onError }: { onError: (msg: string | null) => void }) {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [providers, setProviders] = useState<SocialProvider[]>([]);
    const [busy, setBusy] = useState<SocialProvider | null>(null);

    useEffect(() => {
        void getAppProviders().then((ps) => setProviders(PROVIDER_ORDER.filter((p) => ps.includes(p))));
    }, []);

    if (providers.length === 0) return null;

    async function signIn(p: SocialProvider) {
        onError(null);
        setBusy(p);
        try {
            const r = await auth.loginWithProvider(p);
            // 첫 로그인(또는 약관이 바뀜)이면 약관 동의부터
            navigate(r.consentRequired ? "/consent" : "/", { replace: true });
        } catch (err) {
            if (!(err instanceof NativeSignInCancelled)) onError(friendlyError(err, t("login.socialFailed")));
        } finally {
            setBusy(null);
        }
    }

    return (
        <Stack spacing={1.5} sx={{ mb: 3 }}>
            {providers.map((p) => (
                <Button
                    key={p}
                    size="large"
                    fullWidth
                    disabled={busy !== null}
                    onClick={() => void signIn(p)}
                    // 세 버튼은 같은 높이(52px)·같은 폭 (Apple 심사 4.8)
                    sx={{ ...PROVIDER_BUTTON[p].sx, height: 52, fontSize: 15, fontWeight: 600 }}
                >
                    {busy === p ? t("login.signingIn") : t(`login.continueWith.${p}`)}
                </Button>
            ))}
            <Divider sx={{ pt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    {t("login.orEmail")}
                </Typography>
            </Divider>
        </Stack>
    );
}

export function LoginPage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [socialError, setSocialError] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            if (mode === "login") {
                await auth.login(email.trim(), password);
            } else {
                await auth.register(email.trim(), password, displayName.trim() || undefined);
            }
            navigate("/", { replace: true });
        } catch (err) {
            // 이메일 로그인 실패는 대부분 401 — 공통 문구("다시 로그인") 대신 입력 확인을 안내
            setError(err instanceof TypeError ? friendlyError(err) : t("login.emailFailed"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Box sx={{ maxWidth: 420, mx: "auto" }}>
            {/* 아이콘 · 로고 · 슬로건 · 로그인으로 할 수 있는 일 (줄눈 격자 바탕) */}
            <Stack
                alignItems="center"
                spacing={1.25}
                sx={{
                    py: 4,
                    px: 2,
                    mb: 2,
                    borderRadius: 1,
                    textAlign: "center",
                    backgroundImage: tileGrid("var(--mui-palette-mashil-surfaceSunken)"),
                }}
            >
                <Box component="img" src="/icon-door.svg" alt="" sx={{ width: 88, height: 88 }} />
                <Typography component="h1" sx={{ fontFamily: fonts.logo, fontSize: 38, lineHeight: 1 }}>
                    {t("app.name")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("app.tagline")}
                </Typography>
                <Typography variant="body2" sx={{ pt: 1, maxWidth: 300, bgcolor: "mashil.bg", px: 0.5 }}>
                    {t("login.intro")}
                </Typography>
            </Stack>

            {socialError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {socialError}
                </Alert>
            )}
            <SocialLoginButtons onError={setSocialError} />

            <Stack alignItems="center" spacing={0.5} sx={{ mb: 3 }}>
                <Button component={RouterLink} to="/" color="secondary" sx={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {t("login.browseWithout")}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                    {t("login.consentNote")}
                </Typography>
            </Stack>


            <Tabs
                value={mode}
                onChange={(_, v: Mode) => setMode(v)}
                sx={{ mb: 2 }}
            >
                <Tab value="login" label={t("login.tabLogin")} />
                <Tab value="register" label={t("login.tabRegister")} />
            </Tabs>

            <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                    <TextField
                        type="email"
                        label={t("login.email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        fullWidth
                    />
                    <TextField
                        type="password"
                        label={t("login.password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        fullWidth
                    />
                    {mode === "register" && (
                        <TextField
                            label={t("login.displayName")}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            fullWidth
                        />
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                    <Button type="submit" variant="contained" disabled={submitting}>
                        {submitting ? t("login.processing") : mode === "login" ? t("login.submitLogin") : t("login.submitRegister")}
                    </Button>
                </Stack>
            </form>
        </Box>
    );
}

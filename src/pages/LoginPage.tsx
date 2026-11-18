import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Divider,
    IconButton,
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
import type { SocialProvider } from "../lib/nativeBridge";
import { isOnboarded, markOnboarded } from "../lib/firstRun";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

type Mode = "login" | "register";

/**
 * 이메일·비밀번호 로그인 칸. 운영은 카카오·Google 만 쓰고 서버도 이메일 로그인을 꺼 둔다(Auth:LegacyPasswordLogin).
 * 개발 빌드도 운영과 같은 화면이 되도록 기본은 숨긴다 (2026-11-18). 개발 중 이메일 테스트 계정이 필요하면 .env.local 에 VITE_EMAIL_LOGIN=on.
 */
const EMAIL_LOGIN = import.meta.env.VITE_EMAIL_LOGIN === "on";

const PROVIDER_ORDER: SocialProvider[] = ["kakao", "google", "apple"];

/**
 * Apple 로고. Apple 공식 Sign in with Apple JS SDK(appleid.auth.js)에 들어 있는 경로를 그대로 옮겼다 (56pt 정사각 로고 파일 기준).
 * HIG: 로고 높이 = 버튼 높이, 로고를 따로 그리지 않는다. 색은 버튼 글자색(검정 또는 흰색)을 따른다.
 */
function AppleLogo() {
    return (
        <svg className="provider-btn-logo" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
            <path d="M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z" />
        </svg>
    );
}

/** 제공자 로고. Kakao·Google 은 공식 PNG 를 CSS 로 잘라 보인다 (app.css .provider-btn). */
function ProviderLogo({ provider }: { provider: SocialProvider }) {
    return provider === "apple" ? <AppleLogo /> : <span className="provider-btn-logo" aria-hidden="true" />;
}

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
                // 세 버튼은 같은 높이(52px)·같은 폭 (Apple 심사 4.8, Google·Kakao 가이드: 다른 버튼보다 덜 눈에 띄게 하지 않는다)
                <button
                    key={p}
                    type="button"
                    className={`provider-btn provider-btn--${p}`}
                    disabled={busy !== null}
                    aria-busy={busy === p}
                    onClick={() => void signIn(p)}
                >
                    <ProviderLogo provider={p} />
                    {busy === p ? t("login.signingIn") : t(`login.continueWith.${p}`)}
                </button>
            ))}
            {EMAIL_LOGIN && (
                <Divider sx={{ pt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {t("login.orEmail")}
                    </Typography>
                </Divider>
            )}
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
    const [missing, setMissing] = useState<"email" | "password" | null>(null);
    const emailRef = useRef<HTMLInputElement | null>(null);
    const passwordRef = useRef<HTMLInputElement | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        // 필수 칸은 브라우저 말풍선 대신 칸 아래에 알린다
        const missing = !email.trim() ? "email" : !password ? "password" : null;
        setMissing(missing);
        if (missing) {
            (missing === "email" ? emailRef : passwordRef).current?.focus();
            return;
        }
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

    // 첫 실행(아직 로그인도 둘러보기도 안 함)이면 "로그인 없이 둘러보기"를, 내 정보·설정 등에서 들어왔으면 위쪽 뒤로 단추를 보인다
    const firstRun = !isOnboarded();
    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/me"));

    return (
        <Box sx={{ maxWidth: 420, mx: "auto" }}>
            {!firstRun && (
                <IconButton aria-label={t("detail.back")} onClick={goBack} sx={{ width: 44, height: 44, ml: -1, mb: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
            )}
            {/* 아이콘 · 이름 · 슬로건 (줄눈 격자 바탕). 소개 문구는 버튼 아래 */}
            <Stack
                alignItems="center"
                spacing={1.25}
                sx={{
                    py: 4,
                    px: 2,
                    mb: 2,
                    borderRadius: 1,
                    textAlign: "center",
                    border: "var(--rule-bar) solid var(--color-ink)",
                    bgcolor: "var(--color-paper-3)",
                }}
            >
                <Box component="img" src="/icon-door.svg" alt="" sx={{ width: 88, height: 88 }} />
                <Typography component="h1" variant="h4">
                    {t("app.name")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("app.tagline")}
                </Typography>
            </Stack>

            {socialError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {socialError}
                </Alert>
            )}
            <SocialLoginButtons onError={setSocialError} />

            <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: "center", mb: 3 }}>
                {t("login.consentNote")}
            </Typography>


            {EMAIL_LOGIN && (
                <>
                <Tabs
                    value={mode}
                    onChange={(_, v: Mode) => setMode(v)}
                    sx={{ mb: 2 }}
                >
                    <Tab value="login" label={t("login.tabLogin")} />
                    <Tab value="register" label={t("login.tabRegister")} />
                </Tabs>

                <form onSubmit={onSubmit} noValidate>
                    <Stack spacing={2}>
                        <TextField
                            type="email"
                            label={t("login.email")}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (missing === "email") setMissing(null);
                            }}
                            inputRef={emailRef}
                            error={missing === "email"}
                            helperText={missing === "email" ? t("login.emailRequired") : undefined}
                            required
                            autoComplete="email"
                            fullWidth
                        />
                        <TextField
                            type="password"
                            label={t("login.password")}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (missing === "password") setMissing(null);
                            }}
                            inputRef={passwordRef}
                            error={missing === "password"}
                            helperText={missing === "password" ? t("login.passwordRequired") : undefined}
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
                </>
            )}

            {/* 맨 아래: 로그인으로 할 수 있는 일과 로그인 없이 둘러보기 (로그인 버튼이 화면 위쪽에 오게) */}
            <Stack alignItems="center" spacing={1} sx={{ mt: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    {t("login.intro")}
                </Typography>
                {firstRun && (
                    <Button component={RouterLink} to="/" replace onClick={markOnboarded} color="secondary" sx={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                        {t("login.browseWithout")}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}

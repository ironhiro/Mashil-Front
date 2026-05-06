import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";

export function LoginPage() {
    const auth = useAuth();
    const navigate = useNavigate();

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
            setError((err as Error).message || "요청 실패");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Box sx={{ maxWidth: 420, mx: "auto" }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
                {mode === "login" ? "로그인" : "회원가입"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                평점·댓글·변경 요청은 로그인이 필요해요. 둘러보기는 로그인 없이 가능.
            </Typography>

            <Tabs
                value={mode}
                onChange={(_, v: Mode) => setMode(v)}
                sx={{ mb: 2 }}
            >
                <Tab value="login" label="로그인" />
                <Tab value="register" label="회원가입" />
            </Tabs>

            <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                    <TextField
                        type="email"
                        label="이메일"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        fullWidth
                    />
                    <TextField
                        type="password"
                        label="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        fullWidth
                    />
                    {mode === "register" && (
                        <TextField
                            label="표시 이름 (선택)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            fullWidth
                        />
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                    <Button type="submit" variant="contained" disabled={submitting}>
                        {submitting ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
                    </Button>
                </Stack>
            </form>
        </Box>
    );
}

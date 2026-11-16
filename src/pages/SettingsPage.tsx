import { IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AccountSettings } from "../components/MemberCard";

/** 설정 (회원만): 내 정보의 회원 카드를 누르면 온다. 이름 바꾸기, 언어, 로그아웃, 회원 탈퇴 */
export function SettingsPage() {
    const { t } = useTranslation();
    const auth = useAuth();
    const navigate = useNavigate();
    // 비회원(또는 방금 로그아웃·탈퇴)이면 내 정보로
    if (!auth.user) return <Navigate to="/me" replace />;
    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/me"));
    return (
        <Stack spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton aria-label={t("detail.back")} onClick={goBack} sx={{ width: 44, height: 44, ml: -1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" component="h1">
                    {t("me.settings")}
                </Typography>
            </Stack>
            <AccountSettings user={auth.user} />
        </Stack>
    );
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { UserRole } from "../lib/enums";

/** 라우트 가드: 비로그인 → /login, 로그인했지만 Admin 아님 → 안내 메시지. */
export function RequireAdmin({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { t } = useTranslation();
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== UserRole.Admin) {
        return (
            <Stack spacing={1}>
                <Alert severity="warning">{t("admin.forbidden")}</Alert>
            </Stack>
        );
    }
    return <>{children}</>;
}

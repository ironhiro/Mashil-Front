import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Stack } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { UserRole } from "../lib/enums";

/** 라우트 가드: 비로그인 → /login, 로그인했지만 Admin 아님 → 안내 메시지. */
export function RequireAdmin({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== UserRole.Admin) {
        return (
            <Stack spacing={1}>
                <Alert severity="warning">관리자 전용 페이지입니다. 권한이 없어요.</Alert>
            </Stack>
        );
    }
    return <>{children}</>;
}

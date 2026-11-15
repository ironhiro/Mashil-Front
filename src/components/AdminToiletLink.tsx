import { Link } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { UserRole } from "../lib/enums";

/** 상세 화면의 관리자 전용 링크: 화장실 직접 수정 (ADM-04). 관리자가 아니면 아무것도 그리지 않는다. */
export function AdminToiletLink({ toiletId }: { toiletId: number }) {
    const { user } = useAuth();
    const { t } = useTranslation();
    if (user?.role !== UserRole.Admin) return null;
    return (
        <Link component={RouterLink} to={`/admin/toilets/${toiletId}`} variant="body2" sx={{ mt: 1, ml: 2, fontWeight: 800 }}>
            {t("adminConsole.editLink")}
        </Link>
    );
}

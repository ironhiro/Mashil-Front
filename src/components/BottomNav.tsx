import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import WcIcon from "@mui/icons-material/Wc";

/** 하단 탭이 보이는 경로. 자기 하단 바가 있는 상세나 로그인·동의·약관 같은 한 번 거치는 화면에서는 숨긴다. */
export const BOTTOM_NAV_PATHS = ["/", "/change-requests/new", "/me", "/admin", "/admin/change-requests", "/admin/comments", "/admin/issues", "/admin/imports", "/admin/status"];

export function showsBottomNav(pathname: string) {
    return BOTTOM_NAV_PATHS.includes(pathname);
}

/**
 * 하단 탭 세 칸: 화장실 찾기 / 제보하기 / 내 정보.
 * 안내판의 선택 묶음처럼 2px 테두리를 공유하는 칸, 고른 칸은 잉크로 채운다 (docs/07 §5).
 */
export function BottomNav() {
    const { t } = useTranslation();
    const tabs = [
        { to: "/", label: t("nav.find"), icon: <WcIcon aria-hidden /> },
        { to: "/change-requests/new", label: t("nav.reportTab"), icon: <EditNoteIcon aria-hidden /> },
        { to: "/me", label: t("nav.me"), icon: <PersonOutlineIcon aria-hidden /> },
    ];
    return (
        <nav className="bottom-nav" aria-label={t("nav.label")}>
            {/* 넓은 화면(64rem~)에서만 보이는 워드마크. 그때 탭 줄은 화면 위쪽 바가 된다 */}
            <Link to="/" className="bottom-nav-brand">
                {t("app.name")}
            </Link>
            {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end className="bottom-nav-tab">
                    {tab.icon}
                    <span>{tab.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}

/** 하단 탭의 실제 높이 (없거나 넓은 화면에서 위쪽 바가 됐으면 0). 지도 칸처럼 화면 아래까지 채우는 요소가 뺀다. */
export function bottomNavHeight() {
    const r = document.querySelector(".bottom-nav")?.getBoundingClientRect();
    if (!r) return 0;
    return r.top < window.innerHeight / 2 ? 0 : r.height;
}

import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

/** 하단 탭이 보이는 경로. 자기 하단 바가 있는 상세나 로그인·동의·약관 같은 한 번 거치는 화면에서는 숨긴다. */
export const BOTTOM_NAV_PATHS = ["/", "/change-requests/new", "/me", "/admin/change-requests"];

export function showsBottomNav(pathname: string) {
    return BOTTOM_NAV_PATHS.includes(pathname);
}

/**
 * 하단 탭 세 칸: 찾기 / 제보 / 내 정보.
 * 안내판의 선택 묶음처럼 2px 테두리를 공유하는 칸, 고른 칸은 잉크로 채운다 (docs/07 §5).
 */
export function BottomNav() {
    const { t } = useTranslation();
    const tabs = [
        { to: "/", label: t("nav.find"), icon: <PlaceOutlinedIcon aria-hidden /> },
        { to: "/change-requests/new", label: t("nav.reportTab"), icon: <EditNoteIcon aria-hidden /> },
        { to: "/me", label: t("nav.me"), icon: <PersonOutlineIcon aria-hidden /> },
    ];
    return (
        <nav className="bottom-nav" aria-label={t("nav.label")}>
            {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end className="bottom-nav-tab">
                    {tab.icon}
                    <span>{tab.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}

/** 하단 탭의 실제 높이 (없으면 0). 지도 칸처럼 화면 아래까지 채우는 요소가 뺀다. */
export function bottomNavHeight() {
    return document.querySelector(".bottom-nav")?.getBoundingClientRect().height ?? 0;
}

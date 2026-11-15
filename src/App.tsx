import { useState } from "react";
import {
    AppBar,
    Box,
    Button,
    Container,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import {
    Link as RouterLink,
    Route,
    Routes,
    useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth, userLabel } from "./auth/AuthContext";
import { RequireAdmin } from "./components/RequireAdmin";
import { SUPPORTED_LANGUAGES, currentLanguage } from "./i18n";
import type { LanguageCode } from "./i18n";
import { UserRole } from "./lib/enums";
import { AdminChangeRequestsPage } from "./pages/AdminChangeRequestsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NewChangeRequestPage } from "./pages/NewChangeRequestPage";
import { ConsentPage } from "./pages/ConsentPage";
import { TermsPage } from "./pages/TermsPage";
import { ToiletDetailPage } from "./pages/ToiletDetailPage";
import { MaintenanceScreen, ReadOnlyBanner } from "./components/Maintenance";
import { useAppStatus } from "./lib/appStatus";

export function App() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [navOpen, setNavOpen] = useState(false);
    const appStatus = useAppStatus();

    const closeNav = () => setNavOpen(false);

    // 전체 점검이면 다른 화면 대신 점검 화면 (OPS-05)
    if (appStatus.data?.maintenance) {
        return <MaintenanceScreen status={appStatus.data} onRetry={() => void appStatus.refetch()} retrying={appStatus.isFetching} />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" color="primary">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label={t("app.openMenu")}
                        onClick={() => setNavOpen(true)}
                        sx={{ mr: 1 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Stack
                        direction="row"
                        alignItems="baseline"
                        spacing={1.5}
                        component={RouterLink}
                        to="/"
                        sx={{ color: "inherit", textDecoration: "none", flexGrow: 1 }}
                    >
                        <Typography
                            component="span"
                            sx={{ fontWeight: 800, fontSize: "var(--text-xl)", letterSpacing: "var(--tracking-display)", lineHeight: 1 }}
                        >
                            {t("app.name")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
                            {t("app.tagline")}
                        </Typography>
                    </Stack>

                    {auth.user ? (
                        <Typography variant="body2" sx={{ opacity: 0.9, display: { xs: "none", sm: "inline" } }}>
                            {userLabel(auth.user)}
                            {auth.user.role === UserRole.Admin && <Box component="span" sx={{ ml: 1, fontWeight: 500 }}>{t("app.roleAdmin")}</Box>}
                        </Typography>
                    ) : (
                        <Button color="secondary" component={RouterLink} to="/login">
                            {t("nav.login")}
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            {appStatus.data?.readOnly && <ReadOnlyBanner status={appStatus.data} />}

            <Drawer anchor="left" open={navOpen} onClose={closeNav}>
                <Box sx={{ width: 260, pt: 1 }} role="navigation">
                    {auth.user && (
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {userLabel(auth.user)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {auth.user.role === UserRole.Admin ? t("app.roleAdmin") : t("app.roleUser")}
                            </Typography>
                        </Box>
                    )}
                    <Divider />
                    <List>
                        <ListItemButton
                            onClick={() => {
                                closeNav();
                                navigate("/");
                            }}
                        >
                            <ListItemText primary={t("nav.home")} secondary={t("nav.homeHint")} />
                        </ListItemButton>
                        {auth.user && (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/change-requests/new");
                                }}
                            >
                                <ListItemText primary={t("nav.report")} secondary={t("nav.reportHint")} />
                            </ListItemButton>
                        )}
                        {auth.user?.role === UserRole.Admin && (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/admin/change-requests");
                                }}
                            >
                                <ListItemText primary={t("nav.review")} secondary={t("nav.reviewHint")} />
                            </ListItemButton>
                        )}
                    </List>
                    <Divider />
                    <List>
                        {auth.user ? (
                            <ListItemButton
                                onClick={() => {
                                    auth.logout();
                                    closeNav();
                                    navigate("/");
                                }}
                            >
                                <ListItemText primary={t("nav.logout")} />
                            </ListItemButton>
                        ) : (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/login");
                                }}
                            >
                                <ListItemText primary={t("nav.loginOrRegister")} />
                            </ListItemButton>
                        )}
                    </List>
                    <Divider />
                    <List
                        subheader={
                            // 언어 이름은 번역하지 않고 각 언어로 표기 (내가 못 읽는 언어로 바뀌어도 돌아올 수 있게)
                            <ListSubheader disableSticky sx={{ bgcolor: "transparent" }}>
                                {t("nav.language")}
                                {currentLanguage() !== "en" && " / Language"}
                            </ListSubheader>
                        }
                    >
                        <Box sx={{ px: 2, pb: 2 }}>
                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
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
                    </List>
                </Box>
            </Drawer>

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/consent" element={<ConsentPage />} />
                    <Route path="/terms/:docType" element={<TermsPage />} />
                    <Route path="/toilets/:id" element={<ToiletDetailPage />} />
                    <Route path="/change-requests/new" element={<NewChangeRequestPage />} />
                    <Route
                        path="/admin/change-requests"
                        element={
                            <RequireAdmin>
                                <AdminChangeRequestsPage />
                            </RequireAdmin>
                        }
                    />
                </Routes>
            </Container>
        </Box>
    );
}

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
    Stack,
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
import { useAuth } from "./auth/AuthContext";
import { RequireAdmin } from "./components/RequireAdmin";
import { UserRole } from "./lib/enums";
import { AdminChangeRequestsPage } from "./pages/AdminChangeRequestsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NewChangeRequestPage } from "./pages/NewChangeRequestPage";

export function App() {
    const auth = useAuth();
    const navigate = useNavigate();
    const [navOpen, setNavOpen] = useState(false);

    const closeNav = () => setNavOpen(false);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AppBar position="static" color="primary">
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="메뉴 열기"
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
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            마실
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85, display: { xs: "none", sm: "inline" } }}>
                            잠깐, 다녀와
                        </Typography>
                    </Stack>

                    {auth.user ? (
                        <Typography variant="body2" sx={{ opacity: 0.9, display: { xs: "none", sm: "inline" } }}>
                            {auth.user.email}
                            {auth.user.role === UserRole.Admin && " · 관리자"}
                        </Typography>
                    ) : (
                        <Button color="inherit" component={RouterLink} to="/login">
                            로그인
                        </Button>
                    )}
                </Toolbar>
            </AppBar>

            <Drawer anchor="left" open={navOpen} onClose={closeNav}>
                <Box sx={{ width: 260, pt: 1 }} role="navigation">
                    {auth.user && (
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {auth.user.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {auth.user.role === UserRole.Admin ? "관리자" : "사용자"}
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
                            <ListItemText primary="홈" secondary="내 주변 화장실 지도/목록" />
                        </ListItemButton>
                        {auth.user && (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/change-requests/new");
                                }}
                            >
                                <ListItemText primary="변경요청 작성" secondary="추가/수정/삭제 제안" />
                            </ListItemButton>
                        )}
                        {auth.user?.role === UserRole.Admin && (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/admin/change-requests");
                                }}
                            >
                                <ListItemText primary="변경요청 큐" secondary="사용자 제출 요청 검토" />
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
                                <ListItemText primary="로그아웃" />
                            </ListItemButton>
                        ) : (
                            <ListItemButton
                                onClick={() => {
                                    closeNav();
                                    navigate("/login");
                                }}
                            >
                                <ListItemText primary="로그인 / 회원가입" />
                            </ListItemButton>
                        )}
                    </List>
                </Box>
            </Drawer>

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
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

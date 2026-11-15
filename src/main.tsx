import { StrictMode } from "react";
import "./styles/app.css";
import "./i18n";
import "./i18n/syncAppLanguage";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { theme } from "./theme";
import { App } from "./App";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
);

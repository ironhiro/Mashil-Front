import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

/** 없는 경로 (NFR-08). 빈 화면 대신 안내와 홈으로 가는 길. */
export function NotFoundPage() {
    const { t } = useTranslation();
    return (
        <Box sx={{ maxWidth: 480, mx: "auto", py: 4 }}>
            <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
                {t("notFound.title")}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t("notFound.body")}
            </Typography>
            <Button component={RouterLink} to="/" variant="contained">
                {t("common.backHome")}
            </Button>
        </Box>
    );
}

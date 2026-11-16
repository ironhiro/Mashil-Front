import { Box, Button, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useTranslation } from "react-i18next";

/**
 * 광고 제거와 후원 (회원만). 결제(스토어 인앱 결제)와 광고는 아직 없어서 자리만 잡아 두고 버튼은 "준비 중"으로 막아 둔다.
 * 산 것은 계정에 묶이므로 로그인한 사람에게만 보인다.
 */
export function SupportCards() {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
            <OfferCard
                icon={<BlockIcon aria-hidden />}
                title={t("me.removeAds.title")}
                body={t("me.removeAds.body")}
                note={t("me.removeAds.price")}
            />
            <OfferCard icon={<FavoriteBorderIcon aria-hidden />} title={t("me.support.title")} body={t("me.support.body")} />
        </Box>
    );
}

function OfferCard({ icon, title, body, note }: { icon: React.ReactNode; title: string; body: string; note?: string }) {
    const { t } = useTranslation();
    return (
        <Box component="section" className="plate" aria-label={title} sx={{ gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {icon}
                <Typography component="h2" sx={{ fontWeight: 800, fontSize: "var(--text-lg)" }}>
                    {title}
                </Typography>
            </Box>
            <Typography variant="body2">{body}</Typography>
            {note && (
                <Typography variant="body2" color="text.secondary">
                    {note}
                </Typography>
            )}
            {/* 결제가 붙으면 여기서 스토어 결제를 연다 */}
            <Button variant="outlined" disabled fullWidth>
                {t("me.comingSoon")}
            </Button>
        </Box>
    );
}

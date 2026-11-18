import { useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { ButtonProps } from "@mui/material";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import { useTranslation } from "react-i18next";
import type { LatLng } from "../api";
import { isApp, openDirectionsInApp } from "../lib/nativeBridge";
import type { DirectionsMode } from "../lib/nativeBridge";
import { BottomSheet, sheetBottomPad } from "./BottomSheet";

export interface DirectionsTarget {
    name: string;
    lat: number;
    lng: number;
}

/**
 * 카카오맵 길찾기 주소 (https://apis.map.kakao.com/web/guide/ "지도 URL").
 * 출발점이 있으면 수단을 정한 경로 결과(/link/by/walk|car/출발/도착), 없으면 도착만 정한 길찾기(/link/to).
 */
export function kakaoDirectionsUrl(dest: DirectionsTarget, from: LatLng | null, mode: DirectionsMode, myLabel: string): string {
    const end = `${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`;
    if (!from) return `https://map.kakao.com/link/to/${end}`;
    return `https://map.kakao.com/link/by/${mode}/${encodeURIComponent(myLabel)},${from.lat},${from.lng}/${end}`;
}

interface Props extends Omit<ButtonProps, "onClick" | "href" | "children"> {
    dest: DirectionsTarget;
    /** 내 위치 (있으면 출발점으로) */
    from: LatLng | null;
    children: ReactNode;
}

/**
 * "카카오맵 길찾기" 단추. 누르면 도보 / 차 중에서 고르는 시트가 뜬다.
 * 차는 실시간 교통·음성 안내가 있는 카카오맵에 맡긴다 (앱 안 방향 안내는 도보만).
 */
export function KakaoDirectionsButton({ dest, from, children, ...buttonProps }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const option = (mode: DirectionsMode, icon: ReactNode, title: string, note: string) => (
        <Button
            variant={mode === "walk" ? "contained" : "outlined"}
            size="large"
            component="a"
            href={kakaoDirectionsUrl(dest, from, mode, t("home.myLocation"))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e: React.MouseEvent) => {
                setOpen(false);
                // 앱 웹뷰는 새 창을 열지 못하므로 브리지로 카카오맵 앱(없으면 웹)을 연다
                if (!isApp()) return;
                e.preventDefault();
                void openDirectionsInApp(dest.lat, dest.lng, dest.name, mode);
            }}
            sx={{ justifyContent: "flex-start", textAlign: "left", gap: 1.5, py: 1.25 }}
        >
            {icon}
            <Box component="span" sx={{ display: "flex", flexDirection: "column" }}>
                <span>{title}</span>
                <Typography component="span" variant="caption" sx={{ color: "inherit", opacity: 0.85, fontWeight: 500 }}>
                    {note}
                </Typography>
            </Box>
        </Button>
    );

    return (
        <>
            <Button {...buttonProps} aria-haspopup="dialog" onClick={() => setOpen(true)}>
                {children}
            </Button>
            <BottomSheet open={open} onClose={() => setOpen(false)}>
                <Box sx={{ px: 2, pb: sheetBottomPad }}>
                    <Typography component="h2" variant="h6">
                        {t("directions.title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
                        {dest.name}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 2 }}>
                        {option("walk", <DirectionsWalkIcon aria-hidden />, t("directions.walk"), t("directions.walkNote"))}
                        {option("car", <DirectionsCarIcon aria-hidden />, t("directions.car"), t("directions.carNote"))}
                    </Stack>
                </Box>
            </BottomSheet>
        </>
    );
}

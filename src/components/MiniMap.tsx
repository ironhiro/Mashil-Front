import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { tileCss } from "../design/statusTile";
import type { TileState } from "../design/statusTile";
import { fonts, tileGrid } from "../design/tokens";
import { loadKakaoMaps } from "../lib/kakaoMap";

interface Props {
    lat: number;
    lng: number;
    label: string;
    state: TileState;
    height?: number;
}

/** 상세 화면 상단 지도 띠 — 화장실 한 곳만 상태 타일 마커로. 지도 조작은 막는다 (스크롤 방해 방지). */
export function MiniMap({ lat, lng, label, state, height = 168 }: Props) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadKakaoMaps()
            .then((maps) => {
                if (cancelled || !ref.current) return;
                const pos = new maps.LatLng(lat, lng);
                const map = new maps.Map(ref.current, { center: pos, level: 3 });
                map.setDraggable(false);
                map.setZoomable(false);
                const el = document.createElement("div");
                el.textContent = label;
                el.style.cssText =
                    tileCss(state) +
                    `height:32px;padding:0 10px;border-radius:6px;box-sizing:border-box;display:inline-flex;align-items:center;` +
                    `font:700 13px ${fonts.body};white-space:nowrap;transform:translateY(-4px);`;
                new maps.CustomOverlay({ position: pos, content: el, xAnchor: 0.5, yAnchor: 1 }).setMap(map);
            })
            .catch(() => undefined); // 지도가 안 떠도 격자 바탕은 남는다
        return () => {
            cancelled = true;
        };
    }, [lat, lng, label, state]);

    return (
        <Box
            ref={ref}
            aria-hidden
            sx={{
                height,
                bgcolor: "mashil.surfaceSunken",
                backgroundImage: tileGrid("var(--mui-palette-mashil-line)"),
            }}
        />
    );
}

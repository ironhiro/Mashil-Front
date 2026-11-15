import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { stateClass } from "../design/statusTile";
import type { TileState } from "../design/statusTile";
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
                el.className = `pin ${stateClass(state)}`;
                el.style.cursor = "default";
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
                bgcolor: "var(--color-paper-2)",
                borderBottom: "var(--rule-bar) solid var(--color-ink)",
            }}
        />
    );
}

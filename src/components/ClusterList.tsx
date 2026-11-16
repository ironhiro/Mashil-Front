import { forwardRef, useMemo } from "react";
import { IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import type { ToiletNear } from "../api";
import { sortCluster } from "../lib/mapCluster";
import type { ClusterSort } from "../lib/mapCluster";
import { BoardRowContent } from "./BoardRow";

interface Props {
    items: ToiletNear[];
    sort: ClusterSort;
    onSortChange: (s: ClusterSort) => void;
    /** 추천 점수의 거리 기준 (검색 반경) */
    radiusM: number;
    onSelect: (t: ToiletNear) => void;
    onClose: () => void;
}

/**
 * 지도에서 겹쳐 하나로 묶인 마커를 눌렀을 때의 목록. 근처 안내판과 같은 행 모양에 거리순·추천순 전환.
 */
export const ClusterList = forwardRef<HTMLElement, Props>(function ClusterList(
    { items, sort, onSortChange, radiusM, onSelect, onClose },
    ref,
) {
    const { t } = useTranslation();
    const sorted = useMemo(() => sortCluster(items, sort, radiusM), [items, sort, radiusM]);
    return (
        <section className="board" aria-labelledby="cluster-title" ref={ref} style={{ scrollMarginTop: "var(--space-md)" }}>
            <div className="activity-head" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <h2 id="cluster-title" style={{ flex: 1 }}>
                    {t("cluster.title", { count: items.length })}
                </h2>
                <IconButton aria-label={t("common.close")} onClick={onClose} sx={{ width: 44, height: 44, color: "inherit" }}>
                    <CloseIcon />
                </IconButton>
            </div>
            {/* 정렬은 잉크 머리 줄 밖, 종이 위에 (머리 줄 위에서는 고른 칸이 바탕과 같은 색이라 안 보인다) */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-sm) var(--space-md) 0" }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={sort}
                    onChange={(_, v: ClusterSort | null) => v && onSortChange(v)}
                    aria-label={t("cluster.sortLabel")}
                >
                    <ToggleButton value="distance">{t("cluster.byDistance")}</ToggleButton>
                    <ToggleButton value="recommend">{t("cluster.byRecommend")}</ToggleButton>
                </ToggleButtonGroup>
            </div>
            {sort === "recommend" && <p className="rec-intro">{t("cluster.recommendNote")}</p>}
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {sorted.map((toilet) => (
                    <li key={toilet.id}>
                        <button type="button" className="board-row" onClick={() => onSelect(toilet)}>
                            <BoardRowContent toilet={toilet} />
                        </button>
                    </li>
                ))}
            </ol>
        </section>
    );
});

import { useTranslation } from "react-i18next";
import type { ToiletNear } from "../api";
import { stateClass, tileStateOf } from "../design/statusTile";
import { formatDistance } from "../i18n";
import { facilityChipLabels } from "../lib/facilityChips";
import { statusOf } from "../lib/openStatus";
import { openStatusLabel } from "./OpenStatusBadge";

/**
 * 안내판 한 행의 내용: 거리 · 이름과 시설 · 오른쪽 끝 상태.
 * 목록(ToiletList)의 행과 지도 카드의 머리 줄이 같은 모양을 쓰도록 한 곳에 둔다.
 */
export function BoardRowContent({ toilet, facilities = "compact" }: { toilet: ToiletNear; facilities?: "compact" | "detailed" }) {
    const { t } = useTranslation();
    const status = statusOf(toilet);
    const labels = facilityChipLabels(t, toilet, facilities);
    return (
        <>
            <span className="board-dist">{formatDistance(toilet.distanceM, true)}</span>
            <span style={{ minWidth: 0 }}>
                <span className="board-name">{toilet.name}</span>
                {labels.length > 0 && (
                    <span className="board-meta">
                        {labels.map((f) => (
                            <span key={f}>{f}</span>
                        ))}
                    </span>
                )}
            </span>
            <span className={`board-state ${stateClass(tileStateOf(status))}`}>{openStatusLabel(t, status, "short")}</span>
        </>
    );
}

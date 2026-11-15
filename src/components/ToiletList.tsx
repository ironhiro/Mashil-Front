import { useTranslation } from "react-i18next";
import type { ToiletNear } from "../api";
import { stateClass, tileStateOf } from "../design/statusTile";
import { formatDistance } from "../i18n";
import { facilityChipLabels } from "../lib/facilityChips";
import { statusOf } from "../lib/openStatus";
import { openStatusLabel } from "./OpenStatusBadge";

interface Props {
    toilets: ToiletNear[];
    /** 필터 적용 전 전체 개수. 같으면 필터가 걸리지 않은 것으로 보고 안내하지 않음. */
    totalBeforeFilter?: number;
    selectedId: number | null;
    onSelect: (t: ToiletNear) => void;
}

/**
 * 근처 안내판 (시그니처) — 출발 안내판처럼 잉크 띠 위에 거리순으로.
 * 한 행: 거리(앰버, 크게), 이름과 시설, 오른쪽 끝에 상태. 행을 누르면 상세로.
 */
export function ToiletList({ toilets, totalBeforeFilter, selectedId, onSelect }: Props) {
    const { t } = useTranslation();
    const filtered = totalBeforeFilter !== undefined && totalBeforeFilter !== toilets.length;

    return (
        <section className="board" aria-labelledby="board-title">
            <div className="board-head">
                <h2 id="board-title" style={{ fontSize: "inherit", fontWeight: 800, letterSpacing: 0, maxWidth: "none" }}>
                    {t("list.total", { count: toilets.length })}
                </h2>
                {filtered ? <span>{t("list.filtered", { total: totalBeforeFilter!.toLocaleString() })}</span> : <span aria-hidden="true" className="board-spacer" />}
                <span className="end">{t("list.stateHead")}</span>
            </div>

            {toilets.length === 0 ? (
                <p className="board-empty">{t("list.empty")}</p>
            ) : (
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {toilets.map((toilet) => {
                        const status = statusOf(toilet);
                        const facilities = facilityChipLabels(t, toilet, "compact");
                        return (
                            <li key={toilet.id}>
                                <button
                                    type="button"
                                    className="board-row"
                                    aria-current={toilet.id === selectedId ? "true" : undefined}
                                    onClick={() => onSelect(toilet)}
                                >
                                    <span className="board-dist">{formatDistance(toilet.distanceM, true)}</span>
                                    <span style={{ minWidth: 0 }}>
                                        <span className="board-name">{toilet.name}</span>
                                        {facilities.length > 0 && (
                                            <span className="board-meta">
                                                {facilities.map((f) => (
                                                    <span key={f}>{f}</span>
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                    <span className={`board-state ${stateClass(tileStateOf(status))}`}>
                                        {openStatusLabel(t, status, "short")}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

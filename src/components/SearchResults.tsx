import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { haversineMeters } from "../api";
import type { LatLng, ToiletSearchResult } from "../api";
import { formatDistance } from "../i18n";

interface Props {
    results: ToiletSearchResult[] | undefined;
    /** 맞는 곳 전체 수. 받은 수보다 많으면 "더 보기" 가 나온다 */
    total: number | undefined;
    loading: boolean;
    failed: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    onMore: () => void;
    /** 거리 표시 기준 (내 위치나 지도 가운데). 좌표가 없는 곳은 거리를 비운다 */
    origin: LatLng | null;
    onSelect: (r: ToiletSearchResult) => void;
}

/**
 * 이름·주소 검색 결과 (MAP-06). 근처 안내판과 같은 모양이고, 지도에 없는(좌표 미확정) 곳도 나온다.
 * 행을 누르면 상세로 간다.
 */
export function SearchResults({ results, total, loading, failed, hasMore, loadingMore, onMore, origin, onSelect }: Props) {
    const { t } = useTranslation();
    // 가까운 곳부터. 지도 위치가 아직 없는 곳은 뒤로 (위치를 못 받았으면 서버는 이름순으로 준다)
    const rows = useMemo(
        () =>
            (results ?? [])
                .map((r) => ({
                    r,
                    dist:
                        origin && r.latitude != null && r.longitude != null
                            ? haversineMeters(origin, { lat: r.latitude, lng: r.longitude })
                            : null,
                }))
                .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity)),
        [results, origin],
    );
    return (
        <section className="board" aria-labelledby="search-title" aria-busy={loading}>
            <div className="board-head">
                <h2 id="search-title" style={{ fontSize: "inherit", fontWeight: 800, letterSpacing: 0, maxWidth: "none" }}>
                    {/* 결과 수가 바뀌면 스크린리더가 조용히 읽는다 */}
                    <span role="status">{loading ? t("search.loading") : t("search.total", { count: total ?? results?.length ?? 0 })}</span>
                </h2>
                <span aria-hidden="true" className="board-spacer" />
                <span className="end" />
            </div>

            {failed ? (
                <p className="board-empty">{t("search.failed")}</p>
            ) : !loading && (results?.length ?? 0) === 0 ? (
                <p className="board-empty">{t("search.empty")}</p>
            ) : (
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {rows.map(({ r, dist }) => {
                        const address = r.roadAddress ?? r.lotAddress;
                        return (
                            <li key={r.id}>
                                <button type="button" className="board-row" onClick={() => onSelect(r)}>
                                    <span className="board-dist">{dist != null ? formatDistance(dist, true) : ""}</span>
                                    <span style={{ minWidth: 0 }}>
                                        <span className="board-name" title={r.name}>{r.name}</span>
                                        {(address || r.latitude == null || r.longitude == null) && (
                                            <span className="board-meta">
                                                {address && <span>{address}</span>}
                                                {(r.latitude == null || r.longitude == null) && <span>{t("search.noLocation")}</span>}
                                            </span>
                                        )}
                                    </span>
                                    <span />
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
            {!failed && hasMore && (
                <button type="button" className="activity-more" onClick={onMore} disabled={loadingMore} aria-busy={loadingMore}>
                    {loadingMore ? t("search.loading") : t("search.more", { shown: results?.length ?? 0, total: total ?? 0 })}
                </button>
            )}
        </section>
    );
}

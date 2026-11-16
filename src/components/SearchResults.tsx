import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { haversineMeters } from "../api";
import type { LatLng, ToiletSearchResult } from "../api";
import { formatDistance } from "../i18n";

interface Props {
    /** 지금 쪽의 결과 */
    results: ToiletSearchResult[] | undefined;
    /** 맞는 곳 전체 수 */
    total: number | undefined;
    /** 첫 쪽을 아직 못 받음 */
    loading: boolean;
    failed: boolean;
    /** 0부터 */
    page: number;
    pageCount: number;
    /** 다른 쪽을 받는 중 (지금 쪽은 그대로 보임) */
    pageLoading: boolean;
    onPage: (page: number) => void;
    /** 거리 표시 기준 (내 위치나 지도 가운데). 좌표가 없는 곳은 거리를 비운다 */
    origin: LatLng | null;
    onSelect: (r: ToiletSearchResult) => void;
}

/** 이만큼 옆으로 밀면 쪽을 넘긴다 (px) */
const SWIPE_PX = 60;

/**
 * 이름·주소 검색 결과 (MAP-06). 근처 안내판과 같은 모양이고, 지도에 없는(좌표 미확정) 곳도 나온다.
 * 20건씩 쪽으로 나눠 보여 준다. 목록을 왼쪽으로 밀면 다음 쪽, 오른쪽으로 밀면 이전 쪽 (아래 쪽 단추로도).
 * 행을 누르면 상세로 간다.
 */
export function SearchResults({ results, total, loading, failed, page, pageCount, pageLoading, onPage, origin, onSelect }: Props) {
    const { t } = useTranslation();
    const headRef = useRef<HTMLDivElement>(null);
    // 밀기: 손가락이 옆으로 움직인 만큼 목록이 따라오고, 놓을 때 SWIPE_PX 를 넘었으면 쪽을 넘긴다
    const drag = useRef<{ id: number; x: number; y: number; horizontal: boolean | null } | null>(null);
    const [dx, setDx] = useState(0);
    const swiped = useRef(false);
    // 넘긴 방향으로 새 쪽이 들어오게 (애니메이션 클래스)
    const [enter, setEnter] = useState<"next" | "prev" | null>(null);

    const rows = useMemo(
        () =>
            // 한 쪽 안에서 가까운 곳부터. 지도 위치가 아직 없는 곳은 뒤로 (서버도 기준 위치에서 가까운 순으로 준다)
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

    const go = (next: number) => {
        if (next < 0 || next >= pageCount || next === page) return;
        setEnter(next > page ? "next" : "prev");
        onPage(next);
        // 긴 목록 아래에서 넘겼으면 새 쪽의 처음이 보이게
        headRef.current?.scrollIntoView({ block: "nearest" });
    };

    const onPointerDown = (e: ReactPointerEvent) => {
        // 마우스 끌기는 글자 선택과 겹쳐서 손가락·펜만
        if (e.pointerType === "mouse" || pageCount <= 1) return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: null };
        swiped.current = false;
    };
    const onPointerMove = (e: ReactPointerEvent) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const mx = e.clientX - d.x;
        const my = e.clientY - d.y;
        if (d.horizontal === null && Math.hypot(mx, my) > 8) d.horizontal = Math.abs(mx) > Math.abs(my) * 1.2;
        if (!d.horizontal) return;
        // 끝 쪽에서는 더 못 간다는 느낌만 (조금만 따라옴)
        const atEdge = (mx < 0 && page >= pageCount - 1) || (mx > 0 && page <= 0);
        setDx(atEdge ? mx / 4 : mx);
    };
    const onPointerEnd = (e: ReactPointerEvent) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        const mx = e.clientX - d.x;
        setDx(0);
        if (!d.horizontal) return;
        swiped.current = Math.abs(mx) > 8; // 민 뒤에 따라오는 클릭(행 열기)은 무시
        if (mx <= -SWIPE_PX) go(page + 1);
        else if (mx >= SWIPE_PX) go(page - 1);
    };

    const showPager = !failed && !loading && pageCount > 1;

    return (
        <section className="board" aria-labelledby="search-title" aria-busy={loading || pageLoading}>
            <div className="board-head" ref={headRef}>
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
                <div
                    className="search-pages"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerEnd}
                    onPointerCancel={onPointerEnd}
                    onClickCapture={(e) => {
                        if (swiped.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            swiped.current = false;
                        }
                    }}
                >
                    <ol
                        key={page}
                        className={`search-page${enter ? ` enter-${enter}` : ""}${pageLoading ? " is-loading" : ""}`}
                        style={dx !== 0 ? { transform: `translateX(${dx}px)`, transition: "none" } : undefined}
                        aria-label={showPager ? t("search.page", { page: page + 1, pages: pageCount }) : undefined}
                    >
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
                </div>
            )}

            {showPager && (
                <nav className="search-pager" aria-label={t("search.swipeHint")}>
                    <button type="button" className="search-pager-btn" onClick={() => go(page - 1)} disabled={page <= 0} aria-label={t("search.prev")}>
                        <ChevronLeftIcon fontSize="small" />
                    </button>
                    <span className="search-pager-label">
                        <span>{t("search.page", { page: page + 1, pages: pageCount })}</span>
                        <span className="search-pager-hint" aria-hidden="true">{t("search.swipeHint")}</span>
                    </span>
                    <button type="button" className="search-pager-btn" onClick={() => go(page + 1)} disabled={page >= pageCount - 1} aria-label={t("search.next")}>
                        <ChevronRightIcon fontSize="small" />
                    </button>
                </nav>
            )}
        </section>
    );
}

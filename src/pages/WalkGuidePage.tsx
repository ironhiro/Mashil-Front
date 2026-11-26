import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Typography, useMediaQuery } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchToilet, fetchWalkRoute, WALK_ROUTE_ENABLED } from "../api";
import type { LatLng, WalkRoute, WalkRouteError } from "../api";
import { openStatusLabel } from "../components/OpenStatusBadge";
import { tileStateOf } from "../design/statusTile";
import type { TileState } from "../design/statusTile";
import { createMarkerElement } from "../lib/mapMarker";
import { darkMirror, lightMirror } from "../design/tokens";
import { formatDistance } from "../i18n";
import { loadKakaoMaps } from "../lib/kakaoMap";
import { isApp, openAppSettings, watchPosition } from "../lib/nativeBridge";
import { KakaoDirectionsButton } from "../components/KakaoDirections";
import type { LocationFailure, WatchedPosition } from "../lib/nativeBridge";
import { statusOf } from "../lib/openStatus";
import {
    OFF_ROUTE_FIXES,
    OFF_ROUTE_M,
    REROUTE_MIN_INTERVAL_MS,
    WEAK_ACCURACY_M,
    appendTrail,
    bearingDeg,
    direction8,
    estimate,
    hasArrived,
    projectOnPath,
    remainingOnRoute,
} from "../lib/walkGuide";
import type { WalkGuideState } from "../lib/walkGuide";
import { LANDSCAPE_SPLIT, useMapRelayout } from "../lib/layout";

/**
 * 방향 안내 (직선): 내 위치에서 화장실까지 점선을 긋고, 걸어가는 동안 위치를 따라가며 남은 거리를 보여 준다.
 * 실제 길이 아니라 방향이므로 걷는 시간은 어림값이고, 카카오맵 길찾기를 늘 옆에 둔다.
 */
export function WalkGuidePage() {
    const { id } = useParams();
    const toiletId = Number(id);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const snap = (useLocation().state ?? null) as WalkGuideState | null;

    const query = useQuery({
        enabled: Number.isFinite(toiletId),
        queryKey: ["toilet", toiletId],
        queryFn: () => fetchToilet(toiletId),
    });

    const exit = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(`/toilets/${toiletId}`, { replace: true }));

    const toilet = query.data;
    const dest: LatLng | null =
        toilet?.latitude != null && toilet.longitude != null
            ? { lat: toilet.latitude, lng: toilet.longitude }
            : snap
              ? { lat: snap.lat, lng: snap.lng }
              : null;
    const name = toilet?.name ?? snap?.name ?? "";

    if (!dest) {
        return (
            <Stack spacing={2}>
                <Typography component="h1" variant="h5">
                    {t("guide.title")}
                </Typography>
                {query.isLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center" role="status">
                        <CircularProgress size={18} color="inherit" aria-hidden />
                        <span>{t("common.loading")}</span>
                    </Stack>
                ) : (
                    <>
                        <Alert severity="error">{t("guide.noCoords")}</Alert>
                        <Button variant="outlined" onClick={exit}>
                            {t("detail.back")}
                        </Button>
                    </>
                )}
            </Stack>
        );
    }

    const pin = toilet ? (() => {
        const status = statusOf(toilet);
        return { label: openStatusLabel(t, status, "short"), state: tileStateOf(status) };
    })() : null;

    return <GuideBody toiletId={toiletId} name={name} dest={dest} pin={pin} onExit={exit} />;
}

function GuideBody({
    toiletId,
    name,
    dest,
    pin,
    onExit,
}: {
    toiletId: number;
    name: string;
    dest: LatLng;
    pin: { label: string; state: TileState } | null;
    onExit: () => void;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [me, setMe] = useState<WatchedPosition | null>(null);
    const [trail, setTrail] = useState<LatLng[]>([]);
    const [failure, setFailure] = useState<LocationFailure | null>(null);
    const [arrived, setArrived] = useState(false);
    // 다시 시도·다시 안내를 누르면 올려서 위치 따라가기를 새로 시작한다
    const [attempt, setAttempt] = useState(0);
    // 사용자가 지도를 직접 움직이면 자동 맞추기를 멈춘다
    const [follow, setFollow] = useState(true);

    const est = useMemo(() => (me ? estimate(me, dest) : null), [me, dest]);

    // 실제 도보 경로 (서버, OpenStreetMap). 꺼져 있거나 못 받으면 직선 안내 그대로
    const [route, setRoute] = useState<WalkRoute | null>(null);
    const routeReq = useRef({ inFlight: false, lastAt: 0, offCount: 0, failures: 0, gaveUp: false });
    useEffect(() => {
        if (!WALK_ROUTE_ENABLED || !me || arrived) return; // 꺼져 있으면 위치를 서버로 보내지 않는다
        const r = routeReq.current;
        if (r.inFlight || r.gaveUp) return;
        // 위치가 너무 부정확하면 엉뚱한 길에 붙으므로 기다린다
        if (me.accuracy != null && me.accuracy > 80) return;
        if (route) {
            r.offCount = projectOnPath(me, route.points).offM > OFF_ROUTE_M ? r.offCount + 1 : 0;
            if (r.offCount < OFF_ROUTE_FIXES) return; // 아직 경로 위
        }
        if (Date.now() - r.lastAt < REROUTE_MIN_INTERVAL_MS) return; // 요청 사이 최소 간격
        r.inFlight = true;
        r.lastAt = Date.now();
        fetchWalkRoute({ lat: me.lat, lng: me.lng }, dest)
            .then((next) => {
                r.offCount = 0;
                r.failures = 0;
                setRoute(next);
            })
            .catch((e: { code?: WalkRouteError }) => {
                // 다시 물어도 같은 답일 이유면 그만 묻는다 (꺼짐, 범위 밖, 너무 멂). 나머지는 몇 번까지만
                if (e.code === "routing_disabled" || e.code === "out_of_area" || e.code === "too_far" || ++r.failures >= 3) r.gaveUp = true;
            })
            .finally(() => {
                r.inFlight = false;
            });
    }, [me, arrived, route, dest]);
    const onRoute = route && me ? remainingOnRoute(me, route.points, route.minutes) : null;

    // 1) 위치 따라가기. 도착하면 멈춘다 (GPS 절약)
    useEffect(() => {
        if (arrived) return;
        setFailure(null);
        return watchPosition(
            (p) => {
                setMe(p);
                setTrail((tr) => appendTrail(tr, p, p.accuracy));
                if (hasArrived(estimate(p, dest).straightM, p.accuracy)) setArrived(true);
            },
            (e) => setFailure(e.reason),
        );
    }, [attempt, arrived, dest.lat, dest.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    // 2) 안내 중에는 화면이 꺼지지 않게 (지원하는 곳에서만)
    useEffect(() => {
        if (arrived || failure) return;
        let lock: WakeLockSentinel | null = null;
        let released = false;
        const request = () => {
            if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
            navigator.wakeLock
                .request("screen")
                .then((l) => {
                    if (released) void l.release();
                    else lock = l;
                })
                .catch(() => undefined);
        };
        request();
        document.addEventListener("visibilitychange", request);
        return () => {
            released = true;
            document.removeEventListener("visibilitychange", request);
            void lock?.release().catch(() => undefined);
        };
    }, [arrived, failure]);


    // 화면 낭독기에는 50m 단위로만 알린다 (위치가 올 때마다 읽으면 시끄럽다)
    const spoken = arrived
        ? t("guide.arrivedTitle")
        : onRoute
          ? t("guide.spokenRoute", { distance: formatDistance(Math.ceil(onRoute.remainingM / 50) * 50) })
          : est
            ? t("guide.spoken", { distance: formatDistance(Math.ceil(est.straightM / 50) * 50) })
            : "";

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1100,
                display: "flex",
                flexDirection: "column",
                bgcolor: "var(--color-paper)",
                // 가로로 넓으면 지도(왼쪽) | 안내 판(오른쪽). 세로는 지도 위, 판 아래
                [`@media ${LANDSCAPE_SPLIT}`]: { flexDirection: "row" },
            }}
        >
            <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
                <GuideMap
                    dest={dest}
                    me={me}
                    trail={trail}
                    route={route?.points ?? null}
                    attribution={route?.attribution ?? null}
                    pin={pin}
                    follow={follow}
                    onUserMove={() => setFollow(false)}
                />
                <IconButton
                    aria-label={t("guide.end")}
                    onClick={onExit}
                    sx={{ ...overlayButtonSx, position: "absolute", top: 12, left: 12, zIndex: 2 }}
                >
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                {!follow && me && (
                    <Button
                        onClick={() => setFollow(true)}
                        startIcon={<MyLocationIcon />}
                        sx={{ ...overlayButtonSx, width: "auto", px: 1.5, position: "absolute", bottom: 12, right: 12, zIndex: 2 }}
                    >
                        {t("guide.refit")}
                    </Button>
                )}
            </Box>

            <Box
                sx={{
                    bgcolor: "var(--color-paper)",
                    borderTop: "var(--rule-bar) solid var(--color-ink)",
                    px: 2,
                    pt: 1.5,
                    pb: "calc(12px + var(--app-safe-bottom))",
                    [`@media ${LANDSCAPE_SPLIT}`]: {
                        width: "22rem",
                        flexShrink: 0,
                        borderTop: 0,
                        borderLeft: "var(--rule-bar) solid var(--color-ink)",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                    },
                }}
            >
                <Stack spacing={1.25}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {t("guide.title")}
                        </Typography>
                        <Typography component="h1" variant="h6" sx={{ overflowWrap: "anywhere" }}>
                            {name}
                        </Typography>
                    </Box>

                    <Box className="visually-hidden" aria-live="polite">
                        {spoken}
                    </Box>

                    {failure ? (
                        <Alert
                            severity="warning"
                            action={
                                failure === "deniedForever" && isApp() ? (
                                    <Button color="inherit" size="small" onClick={() => void openAppSettings()}>
                                        {t("home.openSettings")}
                                    </Button>
                                ) : (
                                    <Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>
                                        {t("guide.retry")}
                                    </Button>
                                )
                            }
                        >
                            {t(`location.${failure}`)}
                        </Alert>
                    ) : arrived ? (
                        <div className="plate">
                            <span className="figure">{t("guide.arrivedTitle")}</span>
                            <span className="unit">{t("guide.arrivedBody")}</span>
                        </div>
                    ) : est && me ? (
                        <>
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                                <div className="plate">
                                    <span className="figure">{t("guide.minutes", { count: onRoute?.minutes ?? est.minutes })}</span>
                                    <span className="unit">{t(onRoute ? "guide.minutesRouteUnit" : "guide.minutesUnit")}</span>
                                </div>
                                <div className="plate">
                                    {onRoute ? (
                                        <>
                                            <span className="figure">{formatDistance(onRoute.remainingM, true)}</span>
                                            <span className="unit">{t("guide.routeUnit")}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="figure">{formatDistance(est.straightM, true)}</span>
                                            <span className="unit">
                                                {t("guide.straightUnit", { dir: t(`guide.dir.${direction8(bearingDeg(me, dest))}`) })}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {me.accuracy != null && me.accuracy > WEAK_ACCURACY_M
                                    ? t("guide.weakAccuracy", { meters: Math.round(me.accuracy) })
                                    : route
                                      ? t(route.steps > 0 ? "guide.routeNoteSteps" : "guide.routeNote")
                                      : t("guide.note")}
                            </Typography>
                        </>
                    ) : (
                        <Stack direction="row" spacing={1} alignItems="center" role="status">
                            <CircularProgress size={24} thickness={5} aria-hidden sx={{ flexShrink: 0 }} />
                            <span>{t("map.locating")}</span>
                        </Stack>
                    )}

                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        {arrived ? (
                            <>
                                <Button variant="outlined" onClick={() => navigate(`/toilets/${toiletId}`, { replace: true })}>
                                    {t("detail.more")}
                                </Button>
                                <Button variant="contained" onClick={onExit}>
                                    {t("guide.end")}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outlined" onClick={onExit}>
                                    {t("guide.end")}
                                </Button>
                                <KakaoDirectionsButton variant="outlined" dest={{ name, lat: dest.lat, lng: dest.lng }} from={me}>
                                    {t("guide.kakao")}
                                </KakaoDirectionsButton>
                            </>
                        )}
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}

const overlayButtonSx = {
    width: 44,
    height: 44,
    bgcolor: "var(--color-paper-3)",
    color: "var(--color-ink)",
    border: "var(--rule-bar) solid var(--color-ink)",
    "&:hover": { bgcolor: "var(--color-paper-2)" },
} as const;

/** 지도: 화장실 마커, 내 위치 점과 오차 원, 실제 경로(굵은 실선, 있을 때), 직선 또는 경로까지 잇는 점선, 지나온 길. */
function GuideMap({
    dest,
    me,
    trail,
    route,
    attribution,
    pin,
    follow,
    onUserMove,
}: {
    dest: LatLng;
    me: WatchedPosition | null;
    trail: LatLng[];
    /** 서버가 찾은 도보 경로. 없으면 직선 안내 */
    route: LatLng[] | null;
    /** 경로 데이터 출처 (서버가 준 문구: OSM, 서울 도보 네트워크를 지났으면 서울시도) */
    attribution: string | null;
    pin: { label: string; state: TileState } | null;
    follow: boolean;
    onUserMove: () => void;
}) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement | null>(null);
    const dark = useMediaQuery("(prefers-color-scheme: dark)");
    const tokens = dark ? darkMirror : lightMirror;
    const [error, setError] = useState(false);
    const objs = useRef<{
        map: kakao.maps.Map;
        dest: kakao.maps.CustomOverlay;
        destEl: HTMLDivElement;
        guide: kakao.maps.Polyline;
        route: kakao.maps.Polyline;
        /** 경로 끝에서 화장실까지 (경로는 길 위에서 끝나서 건물 안 화장실까지 비는 경우) */
        tail: kakao.maps.Polyline;
        trail: kakao.maps.Polyline;
        me: kakao.maps.CustomOverlay;
        accuracy: kakao.maps.Circle;
        fitted: boolean;
    } | null>(null);
    // 회전·가로 배치로 칸 크기가 바뀌면 다시 그린다 (가운데는 따라가기 효과가 다시 맞춘다)
    useMapRelayout(ref, () => objs.current?.map);
    // 지도와 도형이 만들어지면 올린다 (아래 효과들이 다시 돌게)
    const [readyTick, setReadyTick] = useState(0);
    const onUserMoveRef = useRef(onUserMove);
    useEffect(() => {
        onUserMoveRef.current = onUserMove;
    }, [onUserMove]);

    // 지도와 도형은 한 번만 만들고, 아래 효과들이 위치만 바꾼다
    useEffect(() => {
        let cancelled = false;
        loadKakaoMaps()
            .then((maps) => {
                if (cancelled || !ref.current) return;
                const destPos = new maps.LatLng(dest.lat, dest.lng);
                const map = new maps.Map(ref.current, { center: destPos, level: 3 });
                const destEl = document.createElement("div");
                destEl.setAttribute("aria-hidden", "true");
                const destOverlay = new maps.CustomOverlay({ position: destPos, content: destEl, xAnchor: 0.5, yAnchor: 1, zIndex: 10 });
                destOverlay.setMap(map);
                const trailLine = new maps.Polyline({ path: [], strokeWeight: 5, strokeColor: tokens.muted, strokeOpacity: 0.55, strokeStyle: "solid" });
                trailLine.setMap(map);
                const routeLine = new maps.Polyline({ path: [], strokeWeight: 7, strokeColor: tokens.accent, strokeOpacity: 0.85, strokeStyle: "solid" });
                routeLine.setMap(map);
                const guide = new maps.Polyline({ path: [], strokeWeight: 4, strokeColor: tokens.accent, strokeOpacity: 0.95, strokeStyle: "shortdash" });
                guide.setMap(map);
                const tail = new maps.Polyline({ path: [], strokeWeight: 4, strokeColor: tokens.accent, strokeOpacity: 0.95, strokeStyle: "shortdash" });
                tail.setMap(map);
                const accuracy = new maps.Circle({
                    center: destPos,
                    radius: 0,
                    strokeWeight: 1,
                    strokeColor: tokens.accent,
                    strokeOpacity: 0.4,
                    fillColor: tokens.accent,
                    fillOpacity: 0.08,
                });
                const dot = document.createElement("div");
                dot.setAttribute("aria-hidden", "true");
                dot.className = "me-dot";
                const meOverlay = new maps.CustomOverlay({ position: destPos, content: dot, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20 });
                // 손으로 끌 때만 (setBounds 같은 코드의 이동에는 dragstart 가 오지 않는다)
                maps.event.addListener(map, "dragstart", () => onUserMoveRef.current());
                objs.current = { map, dest: destOverlay, destEl, guide, route: routeLine, tail, trail: trailLine, me: meOverlay, accuracy, fitted: false };
                setReadyTick((n) => n + 1);
            })
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 화장실 핀 (상태 모양)
    useEffect(() => {
        const o = objs.current;
        if (!o) return;
        // 상태를 받기 전에는 "모름" 핀
        o.destEl.replaceChildren(createMarkerElement(pin?.state ?? "unknown"));
        o.dest.setPosition(new window.kakao.maps.LatLng(dest.lat, dest.lng));
    }, [readyTick, pin?.state, dest.lat, dest.lng]);

    // 라이트·다크 전환
    useEffect(() => {
        const o = objs.current;
        if (!o) return;
        o.accuracy.setOptions({ strokeColor: tokens.accent, fillColor: tokens.accent });
    }, [readyTick, tokens.accent]);

    // 실제 경로
    useEffect(() => {
        const o = objs.current;
        if (!o) return;
        const maps = window.kakao.maps;
        o.route.setPath((route ?? []).map((p) => new maps.LatLng(p.lat, p.lng)));
        // 경로 끝과 화장실 사이 점선 (짧으면 생략)
        const end = route?.[route.length - 1];
        o.tail.setPath(end && estimate(end, dest).straightM > 8
            ? [new maps.LatLng(end.lat, end.lng), new maps.LatLng(dest.lat, dest.lng)]
            : []);
    }, [readyTick, route, dest.lat, dest.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    // 내 위치, 점선(경로가 있으면 경로 위 가장 가까운 점까지, 없으면 화장실까지 일직선), 오차 원
    useEffect(() => {
        const o = objs.current;
        if (!o || !me) return;
        const maps = window.kakao.maps;
        const here = new maps.LatLng(me.lat, me.lng);
        const target = route ? projectOnPath(me, route).point : dest;
        const there = new maps.LatLng(target.lat, target.lng);
        o.me.setPosition(here);
        o.me.setMap(o.map);
        o.guide.setPath([here, there]);
        o.accuracy.setPosition(here);
        o.accuracy.setRadius(me.accuracy ?? 0);
        o.accuracy.setMap(me.accuracy != null && me.accuracy > 10 ? o.map : null);
    }, [readyTick, me, route, dest.lat, dest.lng]);

    // 지나온 길
    useEffect(() => {
        const o = objs.current;
        if (!o) return;
        const maps = window.kakao.maps;
        o.trail.setPath(trail.map((p) => new maps.LatLng(p.lat, p.lng)));
    }, [readyTick, trail]);

    // 나와 화장실이 함께 보이게. 처음 한 번, 따라가기를 다시 켰을 때, 그리고 둘 중 하나가 화면 밖으로 나가면 다시
    // 경로를 새로 받으면(처음, 다시 찾기) 경로 전체가 보이게 다시 맞춘다
    const wasFollowing = useRef(follow);
    const fittedRoute = useRef<LatLng[] | null>(null);
    useEffect(() => {
        const o = objs.current;
        const refollow = follow && !wasFollowing.current;
        wasFollowing.current = follow;
        if (!o || !me || !follow) return;
        const maps = window.kakao.maps;
        const here = new maps.LatLng(me.lat, me.lng);
        const there = new maps.LatLng(dest.lat, dest.lng);
        const view = o.map.getBounds();
        const newRoute = route !== fittedRoute.current;
        if (o.fitted && !refollow && !newRoute && view.contain(here) && view.contain(there)) return;
        const b = new maps.LatLngBounds();
        b.extend(here);
        b.extend(there);
        for (const p of route ?? []) b.extend(new maps.LatLng(p.lat, p.lng));
        o.map.setBounds(b, 72, 48, 48, 48);
        o.fitted = true;
        fittedRoute.current = route;
    }, [readyTick, me, follow, route, dest.lat, dest.lng]);

    return (
        <>
            {/* 지도 안에 카카오 로고 링크(조작 요소)가 있어 role="img" 로 감싸지 않는다. 남은 거리·방향은 아래 판이 글로 알린다 */}
            <Box
                ref={ref}
                sx={{ position: "absolute", inset: 0, bgcolor: "var(--color-paper-2)" }}
            />
            {error && (
                <Alert severity="error" sx={{ position: "absolute", top: 68, left: 12, right: 12, zIndex: 2 }}>
                    {t("map.loadFailed")}
                </Alert>
            )}
            {/* 경로 데이터 출처 (OSM ODbL, 서울시 공공누리 1유형 모두 출처 표시가 조건) */}
            {route && (
                <Box
                    component="a"
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    // 오른쪽 위: 아래에는 카카오 로고(가리면 안 됨)와 축척, "나와 화장실 보기"가 있다
                    sx={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                        maxWidth: "calc(100% - 80px)",
                        textAlign: "right",
                        zIndex: 2,
                        px: 0.75,
                        py: 0.25,
                        font: "500 var(--text-xs)/1.4 var(--font-body)",
                        color: "var(--color-ink)",
                        bgcolor: "color-mix(in srgb, var(--color-paper-3) 80%, transparent)",
                    }}
                >
                    {attribution ?? t("guide.osmAttribution")}
                </Box>
            )}
        </>
    );
}

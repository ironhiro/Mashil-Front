import { useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, Link, Snackbar, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IosShareIcon from "@mui/icons-material/IosShare";
import PhoneIcon from "@mui/icons-material/Phone";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { computeStraightRoute, fetchToilet } from "../api";
import type { LatLng, ScheduleDay, ToiletDetail } from "../api";
import { useAuth } from "../auth/AuthContext";
import { MiniMap } from "../components/MiniMap";
import { StatusTile, openStatusLabel } from "../components/OpenStatusBadge";
import { ToiletInteractions } from "../components/ToiletInteractions";
import { tileStateOf } from "../design/statusTile";
import { fonts } from "../design/tokens";
import { formatDistance } from "../i18n";
import { ChangeRequestKind } from "../lib/enums";
import { toiletKindLabel } from "../lib/facilityChips";
import { friendlyError } from "../lib/friendlyError";
import { isApp, openDirectionsInApp } from "../lib/nativeBridge";
import { statusOf, todayKst } from "../lib/openStatus";

const DAYS: ScheduleDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Holiday"];

interface DetailState {
    /** 거리 기준점 (홈의 내 위치 또는 지도 가운데) */
    origin?: LatLng | null;
    fromMe?: boolean;
}

/**
 * 화장실 상세 (docs/07-ui-design.md §7 "상세"):
 * 지도 띠 · 거리 타일 + 상태 타일 · 요일 8칸 개방 시간(오늘 강조) · 묶음 표 + 원문 · 시설 4칸 · 편의시설 칩 ·
 * 평점·댓글 · 출처와 "정보 수정 요청" · 하단 고정 바(전화 + 길찾기).
 */
export function ToiletDetailPage() {
    const { id } = useParams();
    const toiletId = Number(id);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const nav = (routerLocation.state ?? {}) as DetailState;

    const query = useQuery({
        enabled: Number.isFinite(toiletId),
        queryKey: ["toilet", toiletId],
        queryFn: () => fetchToilet(toiletId),
    });

    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));

    if (query.isLoading) {
        return (
            <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <span>{t("common.loading")}</span>
            </Stack>
        );
    }
    if (query.isError || !query.data) {
        return (
            <Stack spacing={2}>
                <Alert severity="error">{query.isError ? friendlyError(query.error, t("detail.notFound")) : t("detail.notFound")}</Alert>
                <Button color="secondary" onClick={goBack}>{t("detail.back")}</Button>
            </Stack>
        );
    }
    return <DetailBody toilet={query.data} nav={nav} onBack={goBack} />;
}

function DetailBody({ toilet, nav, onBack }: { toilet: ToiletDetail; nav: DetailState; onBack: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const auth = useAuth();
    const [copied, setCopied] = useState(false);
    const status = statusOf(toilet);
    const state = tileStateOf(status);

    const distanceM = useMemo(() => {
        if (!nav.origin || toilet.latitude == null || toilet.longitude == null) return null;
        return computeStraightRoute(nav.origin, { lat: toilet.latitude, lng: toilet.longitude }).distanceM;
    }, [nav.origin, toilet.latitude, toilet.longitude]);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: toilet.name, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            /* 사용자가 공유 창을 닫음 */
        }
    };

    const requestFix = () => {
        const state = { kind: ChangeRequestKind.Update, targetToiletId: toilet.id, targetName: toilet.name };
        if (auth.user) navigate("/change-requests/new", { state });
        else navigate("/login");
    };

    const hasCoords = toilet.latitude != null && toilet.longitude != null;

    return (
        // App 의 Container 여백을 걷어 지도 띠를 가장자리까지
        <Box sx={{ mx: { xs: -2, sm: -3 }, mt: -3 }}>
            <Box sx={{ position: "relative" }}>
                {hasCoords ? (
                    <MiniMap lat={toilet.latitude!} lng={toilet.longitude!} label={openStatusLabel(t, status, "short")} state={state} />
                ) : (
                    <Box sx={{ height: 72 }} />
                )}
                <Stack direction="row" justifyContent="space-between" sx={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 2 }}>
                    <OverlayButton label={t("detail.back")} onClick={onBack}>
                        <ArrowBackIcon fontSize="small" />
                    </OverlayButton>
                    <OverlayButton label={t("detail.share")} onClick={() => void share()}>
                        <IosShareIcon fontSize="small" />
                    </OverlayButton>
                </Stack>
            </Box>

            {/* 시트 — 상단 14px 둥근 모서리 */}
            <Box sx={{ position: "relative", mt: "-14px", zIndex: 1, bgcolor: "mashil.surface", borderRadius: "14px 14px 0 0", px: 2, pt: 2, pb: 2 }}>
                <Stack spacing={2.5}>
                    <Box sx={{ display: "grid", gridTemplateColumns: distanceM !== null ? "1fr 1fr" : "1fr", gap: 1 }}>
                        {distanceM !== null && (
                            <Box sx={{ border: "1.5px solid", borderColor: "mashil.line", bgcolor: "mashil.bg", borderRadius: 1, p: 1.5, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 0.5 }}>
                                <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 30, lineHeight: 1 }}>
                                    {formatDistance(distanceM, true)}
                                </Box>
                                <Box component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
                                    {t(nav.fromMe ? "home.distanceFromMe" : "home.distanceFromCenter")}
                                </Box>
                            </Box>
                        )}
                        <StatusTile toilet={toilet} />
                    </Box>

                    <Box>
                        <Typography component="h1" variant="h5" sx={{ lineHeight: 1.3 }}>
                            {toilet.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {toiletKindLabel(t, toilet.kind)}
                        </Typography>
                        {(toilet.roadAddress || toilet.lotAddress) && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {toilet.roadAddress ?? toilet.lotAddress}
                            </Typography>
                        )}
                    </Box>

                    <HoursSection toilet={toilet} />
                    <FacilitiesSection toilet={toilet} />

                    <ToiletInteractions toiletId={toilet.id} averageRating={null} />

                    <Box>
                        {toilet.source && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                {t("detail.source", { date: toilet.source.dataReferenceDate ?? "—" })}
                                {toilet.source.editedByPeople && ` · ${t("detail.sourceEdited")}`}
                            </Typography>
                        )}
                        <Link component="button" variant="body2" color="secondary" onClick={requestFix} sx={{ mt: 0.5, fontWeight: 600 }}>
                            {t("detail.requestFix")}
                        </Link>
                    </Box>
                </Stack>
            </Box>

            {/* 하단 고정 바: 전화(아이콘) + 길찾기(주 행동) */}
            <Box
                sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 3,
                    bgcolor: "mashil.surface",
                    borderTop: "1px solid",
                    borderColor: "mashil.line",
                    px: 2,
                    py: 1.25,
                    display: "flex",
                    gap: 1,
                }}
            >
                {toilet.phone && (
                    <IconButton
                        component="a"
                        href={`tel:${toilet.phone}`}
                        aria-label={`${t("detail.call")} ${toilet.phone}`}
                        sx={{ width: 52, height: 52, borderRadius: 1, border: "1px solid", borderColor: "mashil.line", color: "mashil.text" }}
                    >
                        <PhoneIcon />
                    </IconButton>
                )}
                {hasCoords && (
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{ minHeight: 52, fontSize: 16 }}
                        component="a"
                        href={`https://map.kakao.com/link/to/${encodeURIComponent(toilet.name)},${toilet.latitude},${toilet.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e: React.MouseEvent) => {
                            if (!isApp()) return;
                            e.preventDefault();
                            void openDirectionsInApp(toilet.latitude!, toilet.longitude!, toilet.name);
                        }}
                    >
                        {t("home.kakaoDirections")}
                    </Button>
                )}
            </Box>

            <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message={t("detail.copied")} />
        </Box>
    );
}

function OverlayButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <IconButton
            aria-label={label}
            onClick={onClick}
            sx={{
                width: 44,
                height: 44,
                borderRadius: 1,
                bgcolor: "mashil.surface",
                color: "mashil.text",
                border: "1px solid",
                borderColor: "mashil.line",
                "&:hover": { bgcolor: "mashil.surface" },
            }}
        >
            {children}
        </IconButton>
    );
}

/** 요일 하나의 표시 문구. */
function dayText(t: TFunction, toilet: ToiletDetail, day: ScheduleDay): { text: string; kind: "hours" | "closed" | "none" } {
    if (toilet.scheduleStatus === "AlwaysOpen") return { text: t("detail.allDay"), kind: "hours" };
    const slots = (toilet.schedules ?? []).filter((s) => s.day === day);
    if (slots.length === 0) return { text: t("detail.noInfo"), kind: "none" };
    if (slots.every((s) => s.closed)) return { text: t("detail.closedDay"), kind: "closed" };
    const parts = slots
        .filter((s) => !s.closed && s.open && s.close)
        .map((s) => (s.open === "00:00" && s.close === "24:00" ? t("detail.allDay") : `${s.open}–${s.close}`));
    return parts.length ? { text: parts.join("\n"), kind: "hours" } : { text: t("detail.noInfo"), kind: "none" };
}

function HoursSection({ toilet }: { toilet: ToiletDetail }) {
    const { t } = useTranslation();
    const today = todayKst();
    const raw = [toilet.openHours, toilet.openHoursDetail].filter(Boolean).join(" · ");
    const texts = Object.fromEntries(DAYS.map((d) => [d, dayText(t, toilet, d)])) as Record<ScheduleDay, ReturnType<typeof dayText>>;
    const group = (days: ScheduleDay[]) => {
        const vals = new Set(days.map((d) => texts[d].text));
        return vals.size === 1 ? [...vals][0] : t("detail.varies");
    };
    const note =
        toilet.scheduleStatus && toilet.scheduleStatus !== "Scheduled" && toilet.scheduleStatus !== "AlwaysOpen"
            ? t(`detail.schedule.${toilet.scheduleStatus as "Irregular" | "FollowsFacility" | "NotOpen" | "Unknown"}`, {
                  defaultValue: t("detail.schedule.Unknown"),
              })
            : null;

    return (
        <Box component="section">
            <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                {t("detail.hoursTitle")}
            </Typography>
            {note && (
                <Alert severity="info" sx={{ mb: 1 }}>
                    {note}
                </Alert>
            )}
            <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
                {DAYS.map((d) => {
                    const { text, kind } = texts[d];
                    const isToday = d === today;
                    return (
                        <Box
                            component="li"
                            key={d}
                            aria-current={isToday ? "date" : undefined}
                            sx={{
                                borderRadius: 1,
                                p: 1,
                                minHeight: 62,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                                ...(kind === "hours"
                                    ? { bgcolor: "mashil.surface", border: "1.5px solid", borderColor: "mashil.line" }
                                    : kind === "closed"
                                      ? { bgcolor: "mashil.surface", border: "1.5px dashed", borderColor: "mashil.closedBorder", color: "mashil.closedText" }
                                      : { bgcolor: "mashil.surfaceSunken", border: "1.5px solid", borderColor: "mashil.line", color: "text.secondary" }),
                                // 오늘은 굵은 먹색 테두리
                                ...(isToday && { border: "2.5px solid", borderColor: "mashil.selected" }),
                            }}
                        >
                            <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>
                                {t(`days.${d}`)}
                                {isToday && ` · ${t("detail.today")}`}
                            </Box>
                            <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 12, whiteSpace: "pre-line", lineHeight: 1.35 }}>
                                {text}
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            <Box component="table" sx={{ width: "100%", mt: 1.5, borderCollapse: "collapse", fontSize: 14, "& th, & td": { py: 0.75, borderBottom: "1px solid", borderColor: "mashil.line", textAlign: "left", verticalAlign: "top" }, "& th": { fontWeight: 600, width: 96, color: "text.secondary" } }}>
                <tbody>
                    <tr>
                        <th scope="row">{t("detail.weekdays")}</th>
                        <td style={{ whiteSpace: "pre-line" }}>{group(["Mon", "Tue", "Wed", "Thu", "Fri"])}</td>
                    </tr>
                    <tr>
                        <th scope="row">{t("detail.weekend")}</th>
                        <td style={{ whiteSpace: "pre-line" }}>{group(["Sat", "Sun"])}</td>
                    </tr>
                    <tr>
                        <th scope="row">{t("detail.holiday")}</th>
                        <td style={{ whiteSpace: "pre-line" }}>{texts.Holiday.text}</td>
                    </tr>
                </tbody>
            </Box>
            {raw && (
                // 정규화 결과를 사용자가 검증할 수 있게 원문도 함께
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {t("detail.rawHours", { raw })}
                </Typography>
            )}
        </Box>
    );
}

function FacilitiesSection({ toilet }: { toilet: ToiletDetail }) {
    const { t } = useTranslation();
    const f = toilet.facilities;
    if (!f) return null;
    const tiles: { label: string; total: number; detail: string }[] = [
        {
            label: t("detail.men"),
            total: f.maleStall + f.maleUrinal,
            detail: [f.maleStall && t("detail.stalls", { count: f.maleStall }), f.maleUrinal && t("detail.urinals", { count: f.maleUrinal })].filter(Boolean).join(" · "),
        },
        { label: t("detail.women"), total: f.femaleStall, detail: f.femaleStall ? t("detail.stalls", { count: f.femaleStall }) : "" },
        { label: t("detail.accessible"), total: f.maleAccessibleStall + f.maleAccessibleUrinal + f.femaleAccessibleStall, detail: "" },
        { label: t("detail.child"), total: f.maleChildStall + f.maleChildUrinal + f.femaleChildStall, detail: "" },
    ];
    const amenities = (["emergencyBell", "entranceCctv", "diaperChanger"] as const).filter((k) => f[k] !== null && f[k] !== undefined);

    return (
        <Box component="section">
            <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                {t("detail.facilitiesTitle")}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
                {tiles.map((tile) => (
                    <Box
                        key={tile.label}
                        sx={{
                            borderRadius: 1,
                            p: 1,
                            minHeight: 72,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            ...(tile.total > 0
                                ? { bgcolor: "mashil.surface", border: "1.5px solid", borderColor: "mashil.line" }
                                : { bgcolor: "mashil.surfaceSunken", border: "1.5px solid", borderColor: "mashil.line", color: "text.secondary" }),
                        }}
                    >
                        <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>
                            {tile.label}
                        </Box>
                        <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 22, lineHeight: 1.1 }}>
                            {tile.total > 0 ? tile.total : "–"}
                        </Box>
                        <Box component="span" sx={{ fontSize: 11, opacity: 0.85, minHeight: 14 }}>
                            {tile.total > 0 ? tile.detail : t("detail.none")}
                        </Box>
                    </Box>
                ))}
            </Box>
            {amenities.length > 0 && (
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    {amenities.map((k) => {
                        const has = f[k] === true;
                        const name = t(`detail.amenities.${k}`);
                        return (
                            <Box
                                key={k}
                                component="span"
                                // 없는 항목은 취소선 (시안) — 화면 낭독기에는 "없음"으로 읽히게
                                aria-label={has ? name : t("detail.amenityMissing", { name })}
                                sx={{
                                    px: 1.25,
                                    height: 30,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: 1,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    border: "1px solid",
                                    borderColor: "mashil.line",
                                    ...(has ? { bgcolor: "mashil.surface" } : { color: "text.secondary", textDecoration: "line-through" }),
                                }}
                            >
                                {name}
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}

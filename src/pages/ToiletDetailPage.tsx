import { useMemo, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { ShareSheet } from "../components/ShareSheet";
import { LANDSCAPE_SPLIT } from "../lib/layout";
import { toiletShareUrl } from "../lib/share";
import { Alert, Box, Button, CircularProgress, IconButton, Link, Stack, Typography, useMediaQuery } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IosShareIcon from "@mui/icons-material/IosShare";
import PhoneIcon from "@mui/icons-material/Phone";
import NavigationIcon from "@mui/icons-material/NavigationOutlined";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { computeStraightRoute, fetchToilet } from "../api";
import type { LatLng, ScheduleDay, ToiletDetail } from "../api";
import { AdminToiletLink } from "../components/AdminToiletLink";
import { MiniMap } from "../components/MiniMap";
import { StatusTile, openStatusLabel } from "../components/OpenStatusBadge";
import { ToiletInteractions } from "../components/ToiletInteractions";
import { tileStateOf } from "../design/statusTile";
import { formatDistance } from "../i18n";
import { ChangeRequestKind } from "../lib/enums";
import { toiletKindLabel } from "../lib/facilityChips";
import { friendlyError } from "../lib/friendlyError";
import { KakaoDirectionsButton } from "../components/KakaoDirections";
import { statusOf, todayKst } from "../lib/openStatus";
import { walkGuidePath } from "../lib/walkGuide";
import type { WalkGuideState } from "../lib/walkGuide";

const DAYS: ScheduleDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Holiday"];

interface DetailState {
    /** 거리 기준점 (홈의 내 위치 또는 지도 가운데) */
    origin?: LatLng | null;
    fromMe?: boolean;
}

/**
 * 화장실 상세 (Hallmark · Wayfind): 지도 띠, 거리 판과 상태 판, 요일 8칸(오늘은 잉크 칸), 묶음 표와 원문,
 * 시설 4칸, 편의시설, 평점·댓글, 출처와 "정보 수정 요청", 하단 고정 바(전화와 길찾기).
 */
/** 누르면 전화 걸기 화면 (앱은 tel: 를 전화 앱으로 넘긴다). 번호는 글자 그대로 보이고 밑줄로 누를 수 있음을 알린다 */
function PhoneLink({ phone, label }: { phone: string; label: string }) {
    return (
        <Link href={`tel:${phone.replace(/[^0-9+]/g, "")}`} aria-label={label} color="inherit" sx={{ textUnderlineOffset: 3, fontWeight: 600 }}>
            {phone}
        </Link>
    );
}

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
            <Stack direction="row" spacing={1} alignItems="center" role="status">
                <CircularProgress size={18} color="inherit" />
                <span>{t("common.loading")}</span>
            </Stack>
        );
    }
    if (query.isError || !query.data) {
        return (
            <Stack spacing={2}>
                <Alert severity="error">{query.isError ? friendlyError(query.error, t("detail.notFound")) : t("detail.notFound")}</Alert>
                <Button variant="outlined" onClick={goBack}>{t("detail.back")}</Button>
            </Stack>
        );
    }
    return <DetailBody toilet={query.data} nav={nav} onBack={goBack} />;
}

function DetailBody({ toilet, nav, onBack }: { toilet: ToiletDetail; nav: DetailState; onBack: () => void }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [shareOpen, setShareOpen] = useState(false);
    const status = statusOf(toilet);

    const distanceM = useMemo(() => {
        if (!nav.origin || toilet.latitude == null || toilet.longitude == null) return null;
        return computeStraightRoute(nav.origin, { lat: toilet.latitude, lng: toilet.longitude }).distanceM;
    }, [nav.origin, toilet.latitude, toilet.longitude]);


    const requestFix = () => {
        const state = { kind: ChangeRequestKind.Edit, targetToiletId: toilet.id, targetName: toilet.name };
        navigate("/change-requests/new", { state }); // 비회원도 제보할 수 있다
    };

    const hasCoords = toilet.latitude != null && toilet.longitude != null;
    const split = useMediaQuery(LANDSCAPE_SPLIT);

    return (
        // App 의 Container 여백을 걷어 지도 띠를 가장자리까지
        <Box sx={{ mx: { xs: -2, sm: -3 }, mt: -3 }}>
            {/* 가로로 넓으면 지도 | 내용 (app.css .detail-split). 지도 칸은 화면 높이에서 하단 바를 뺀 만큼 */}
            <Box className="detail-split">
            <Box
                className="detail-map"
                // 가로: 지도는 화면 높이에 붙어 있고 오른쪽 내용만 스크롤된다. sx 의 position 이 CSS 를 덮으므로 여기서 정한다
                sx={split ? { position: "sticky", top: 0, height: "calc(100dvh - 76px - env(safe-area-inset-bottom))" } : { position: "relative" }}
            >
                {hasCoords ? (
                    <MiniMap lat={toilet.latitude!} lng={toilet.longitude!} label={openStatusLabel(t, status, "short")} state={tileStateOf(status)} fill={split} />
                ) : (
                    <Box sx={{ height: 72, borderBottom: "var(--rule-bar) solid var(--color-ink)" }} />
                )}
                <Stack direction="row" justifyContent="space-between" sx={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 2 }}>
                    <OverlayButton label={t("detail.back")} onClick={onBack}>
                        <ArrowBackIcon fontSize="small" />
                    </OverlayButton>
                    <OverlayButton label={t("detail.share")} onClick={() => setShareOpen(true)}>
                        <IosShareIcon fontSize="small" />
                    </OverlayButton>
                </Stack>
            </Box>

            <Box sx={{ px: 2, pt: 2.5, pb: 3 }}>
                <Stack spacing={3}>
                    <Box sx={{ display: "grid", gridTemplateColumns: distanceM !== null ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 1 }}>
                        {distanceM !== null && (
                            <div className="plate">
                                <span className="figure">{formatDistance(distanceM, true)}</span>
                                <span className="unit">{t(nav.fromMe ? "home.distanceFromMe" : "home.distanceFromCenter")}</span>
                            </div>
                        )}
                        <StatusTile toilet={toilet} />
                    </Box>

                    <Box>
                        <Typography component="h1" variant="h4">
                            {toilet.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {toiletKindLabel(t, toilet.kind)}
                        </Typography>
                        {(toilet.roadAddress || toilet.lotAddress) && (
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                                {toilet.roadAddress ?? toilet.lotAddress}
                                <CopyButton text={(toilet.roadAddress ?? toilet.lotAddress)!} what={t("copy.address")} />
                            </Typography>
                        )}
                        {toilet.phone ? (
                            <Typography variant="body1" sx={{ mt: 0.5 }}>
                                <PhoneLink phone={toilet.phone} label={`${t("detail.call")} ${toilet.phone}`} />
                                <CopyButton text={toilet.phone} what={t("copy.phone")} />
                            </Typography>
                        ) : (
                            toilet.orgPhone && (
                                // 화장실 번호가 아니라 관리기관 번호 — 그렇다고 밝힌다
                                <Typography variant="body1" sx={{ mt: 0.5 }}>
                                    <PhoneLink phone={toilet.orgPhone} label={`${t("detail.callOrg")} ${toilet.orgPhone}`} />
                                    <CopyButton text={toilet.orgPhone} what={t("copy.phone")} />
                                    <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
                                        {t("detail.orgPhone", { org: toilet.managementOrg ?? "" })}
                                    </Typography>
                                </Typography>
                            )
                        )}
                    </Box>

                    <HoursSection toilet={toilet} />
                    <FacilitiesSection toilet={toilet} />

                    <ToiletInteractions toiletId={toilet.id} averageRating={toilet.averageRating ?? null} ratingCount={toilet.ratingCount ?? 0} />

                    <Box>
                        {toilet.source && (
                            <Typography variant="body2" color="text.secondary">
                                {t("detail.source", { date: toilet.source.dataReferenceDate ?? t("detail.noInfo") })}
                            </Typography>
                        )}
                        {toilet.source?.lastRefreshedAt && (
                            <Typography variant="body2" color="text.secondary">
                                {t("detail.sourceRefreshed", { date: new Date(toilet.source.lastRefreshedAt).toLocaleDateString(i18n.language) })}
                            </Typography>
                        )}
                        {toilet.source?.editedByPeople && (
                            <Typography variant="body2" color="text.secondary">
                                {t("detail.sourceEdited")}
                            </Typography>
                        )}
                        <Link component="button" type="button" variant="body2" onClick={requestFix} sx={{ mt: 1, fontWeight: 800 }}>
                            {t("detail.requestFix")}
                        </Link>
                        <AdminToiletLink toiletId={toilet.id} />
                    </Box>
                </Stack>
            </Box>
            </Box>

            {/* 하단 고정 바: 전화(아이콘)와 길찾기(주 행동) */}
            <Box
                sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 3,
                    bgcolor: "var(--color-paper)",
                    borderTop: "var(--rule-bar) solid var(--color-ink)",
                    px: 2,
                    pt: 1.25,
                    // 제스처 막대 위로 (앱은 웹뷰를 화면 맨 아래까지 그린다)
                    pb: "calc(10px + env(safe-area-inset-bottom))",
                    // 페이지 끝에서도 화면 맨 아래에 붙도록, App 의 아래 여백(24px + 제스처 막대)만큼 내려 앉힌다
                    mb: "calc(-24px - env(safe-area-inset-bottom))",
                    display: "flex",
                    gap: 1,
                }}
            >
                {(toilet.phone || toilet.orgPhone) && (
                    <IconButton
                        component="a"
                        href={`tel:${toilet.phone ?? toilet.orgPhone}`}
                        aria-label={toilet.phone ? `${t("detail.call")} ${toilet.phone}` : `${t("detail.callOrg")} ${toilet.orgPhone}`}
                        sx={{ width: 52, height: 52, border: "var(--rule-bar) solid var(--color-ink)", color: "var(--color-ink)" }}
                    >
                        <PhoneIcon />
                    </IconButton>
                )}
                {hasCoords && (
                    // 앱 안 방향 안내 (일직선과 남은 거리). 주 행동은 그대로 카카오맵 길찾기
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<NavigationIcon />}
                        onClick={() =>
                            navigate(walkGuidePath(toilet.id), {
                                state: { name: toilet.name, lat: toilet.latitude!, lng: toilet.longitude! } satisfies WalkGuideState,
                            })
                        }
                        // 두 버튼이 폭을 나눠 쓰고, 영어처럼 긴 글자는 두 줄까지 접힌다
                        sx={{ flex: "1 1 0", minWidth: 0, whiteSpace: "normal", wordBreak: "keep-all", lineHeight: 1.2 }}
                    >
                        {t("guide.start")}
                    </Button>
                )}
                {hasCoords && (
                    // 누르면 도보 / 차 고르기. 홈에서 내 위치로 왔으면 그 위치를 출발점으로
                    <KakaoDirectionsButton
                        variant="contained"
                        fullWidth
                        size="large"
                        dest={{ name: toilet.name, lat: toilet.latitude!, lng: toilet.longitude! }}
                        from={nav.fromMe ? (nav.origin ?? null) : null}
                        // 영어처럼 긴 글자는 두 줄로 (한 줄 고정이면 좁은 폰에서 버튼 밖으로 넘친다)
                        sx={{ flex: "1.3 1 0", minWidth: 0, whiteSpace: "normal", wordBreak: "keep-all", lineHeight: 1.2, textAlign: "center" }}
                    >
                        {t("home.kakaoDirections")}
                    </KakaoDirectionsButton>
                )}
            </Box>

            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                payload={{
                    title: toilet.name,
                    url: toiletShareUrl(toilet.id),
                    description: toiletKindLabel(t, toilet.kind),
                    address: toilet.roadAddress ?? toilet.lotAddress ?? undefined,
                }}
            />
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
                bgcolor: "var(--color-paper-3)",
                color: "var(--color-ink)",
                border: "var(--rule-bar) solid var(--color-ink)",
                "&:hover": { bgcolor: "var(--color-paper-2)" },
            }}
        >
            {children}
        </IconButton>
    );
}

/** 요일 하나의 표시 문구. */
function dayText(t: TFunction, toilet: ToiletDetail, day: ScheduleDay, cell = false): { text: string; kind: "hours" | "closed" | "none" } {
    if (toilet.scheduleStatus === "AlwaysOpen") return { text: t("detail.allDay"), kind: "hours" };
    const slots = (toilet.schedules ?? []).filter((s) => s.day === day);
    // 공휴일 규칙이 없으면 서버는 그날 요일 규칙을 그대로 쓴다 (OpenStatusEvaluator). 요일 정보가 있을 때만 그렇게 안내
    if (slots.length === 0 && day === "Holiday" && (toilet.schedules ?? []).some((s) => s.day !== "Holiday"))
        return { text: t(cell ? "detail.holidayAsDayShort" : "detail.holidayAsDay"), kind: "hours" };
    if (slots.length === 0) return { text: t("detail.noInfo"), kind: "none" };
    if (slots.every((s) => s.closed)) return { text: t("detail.closedDay"), kind: "closed" };
    const parts = slots
        .filter((s) => !s.closed && s.open && s.close)
        // 칸 안에서는 여는 시각과 닫는 시각을 두 줄로 (고정폭 글꼴이라 한 줄이면 칸을 넘친다)
        .map((s) => (s.open === "00:00" && s.close === "24:00" ? t("detail.allDay") : cell ? `${s.open}
~${s.close}` : `${s.open}~${s.close}`));
    return parts.length ? { text: parts.join("\n"), kind: "hours" } : { text: t("detail.noInfo"), kind: "none" };
}

function HoursSection({ toilet }: { toilet: ToiletDetail }) {
    const { t } = useTranslation();
    const today = todayKst();
    const raw = [toilet.openHours, toilet.openHoursDetail].filter(Boolean).join(", ");
    const texts = Object.fromEntries(DAYS.map((d) => [d, dayText(t, toilet, d)])) as Record<ScheduleDay, ReturnType<typeof dayText>>;
    const cellTexts = Object.fromEntries(DAYS.map((d) => [d, dayText(t, toilet, d, true)])) as Record<ScheduleDay, ReturnType<typeof dayText>>;
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
        <Box component="section" aria-labelledby="hours-title">
            <Typography id="hours-title" component="h2" variant="h6" sx={{ mb: 1.5 }}>
                {t("detail.hoursTitle")}
            </Typography>
            {note && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                    {note}
                </Alert>
            )}
            {/* 요일 8칸: 2px 테두리를 공유하는 정사각 칸, 오늘은 잉크 칸 */}
            <Box component="ol" className="cells" sx={{ listStyle: "none", m: 0, p: 0, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {DAYS.map((d) => {
                    const { text, kind } = cellTexts[d];
                    const isToday = d === today;
                    return (
                        <li key={d} aria-current={isToday ? "date" : undefined} className={isToday ? "is-today" : kind === "hours" ? undefined : "is-off"}>
                            {/* 오늘은 잉크 칸으로만 표시 (화면 낭독기는 aria-current 로 안다) */}
                            <span className="cell-day">{t(`days.${d}`)}</span>
                            <span className="cell-hours" style={{ display: "block" }}>
                                {text}
                            </span>
                        </li>
                    );
                })}
            </Box>

            <Box
                component="table"
                sx={{
                    width: "100%",
                    mt: 2,
                    borderCollapse: "collapse",
                    fontSize: "var(--text-sm)",
                    "& th, & td": { py: 1, textAlign: "left", verticalAlign: "top", borderBottom: "var(--rule-hair) solid var(--color-rule)" },
                    "& th": { fontWeight: 500, color: "var(--color-muted)", width: "7rem" },
                    "& td": { whiteSpace: "pre-line" },
                }}
            >
                <tbody>
                    <tr>
                        <th scope="row">{t("detail.weekdays")}</th>
                        <td>{group(["Mon", "Tue", "Wed", "Thu", "Fri"])}</td>
                    </tr>
                    <tr>
                        <th scope="row">{t("detail.weekend")}</th>
                        <td>{group(["Sat", "Sun"])}</td>
                    </tr>
                    <tr>
                        <th scope="row">{t("detail.holiday")}</th>
                        <td>{texts.Holiday.text}</td>
                    </tr>
                </tbody>
            </Box>
            {raw && (
                // 정규화 결과를 사용자가 검증할 수 있게 원문도 함께
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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
    const tiles: { label: string; total: number; detail: string[] }[] = [
        {
            label: t("detail.men"),
            total: f.maleStall + f.maleUrinal,
            detail: [f.maleStall ? t("detail.stalls", { count: f.maleStall }) : "", f.maleUrinal ? t("detail.urinals", { count: f.maleUrinal }) : ""].filter(Boolean),
        },
        { label: t("detail.women"), total: f.femaleStall, detail: f.femaleStall ? [t("detail.stalls", { count: f.femaleStall })] : [] },
        { label: t("detail.accessible"), total: f.maleAccessibleStall + f.maleAccessibleUrinal + f.femaleAccessibleStall, detail: [] },
        { label: t("detail.child"), total: f.maleChildStall + f.maleChildUrinal + f.femaleChildStall, detail: [] },
    ];
    const amenities = (["emergencyBell", "entranceCctv", "diaperChanger"] as const).filter((k) => f[k] !== null && f[k] !== undefined);

    return (
        <Box component="section" aria-labelledby="facilities-title">
            <Typography id="facilities-title" component="h2" variant="h6" sx={{ mb: 1.5 }}>
                {t("detail.facilitiesTitle")}
            </Typography>
            <Box component="dl" className="cells" sx={{ m: 0, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {tiles.map((tile) => (
                    <div key={tile.label} className={tile.total > 0 ? undefined : "is-off"}>
                        <dt className="cell-day">{tile.label}</dt>
                        <dd style={{ margin: 0 }}>
                            <span className="cell-figure" style={{ display: "block" }}>
                                {tile.total > 0 ? tile.total : t("detail.none")}
                            </span>
                            {tile.detail.map((line) => (
                                <span key={line} className="cell-hours" style={{ display: "block" }}>
                                    {line}
                                </span>
                            ))}
                        </dd>
                    </div>
                ))}
            </Box>
            {amenities.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                    {amenities.map((k) => {
                        const has = f[k] === true;
                        const name = t(`detail.amenities.${k}`);
                        return (
                            // 없는 항목은 취소선. 화면 낭독기에는 "없음"으로 읽히게
                            <span key={k} className={has ? "amenity" : "amenity is-missing"} aria-label={has ? name : t("detail.amenityMissing", { name })}>
                                {name}
                            </span>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}

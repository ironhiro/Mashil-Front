import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchToilet, submitChangeRequest } from "../api";
import { getCurrentPosition, LocationError } from "../lib/nativeBridge";
import { reverseGeocode, type ReverseAddress } from "../lib/kakaoMap";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { friendlyError } from "../lib/friendlyError";
import { toiletKindLabel } from "../lib/facilityChips";
import {
    CHANGE_REQUEST_KIND_OPTIONS,
    ChangeRequestKind,
    TOILET_KIND_OPTIONS,
} from "../lib/enums";

interface PrefillState {
    kind?: ChangeRequestKind;
    targetToiletId?: number;
    targetName?: string;
}

/** 8개 핵심 필드 — Add/Edit 둘 다 사용. */
interface ToiletFormFields {
    name: string;
    kind: string;
    roadAddress: string;
    lotAddress: string;
    latitude: string;  // text input → submit 시 파싱
    longitude: string;
    openHours: string;
    openHoursDetail: string;
    phone: string;
}

const EMPTY_FIELDS: ToiletFormFields = {
    name: "",
    kind: TOILET_KIND_OPTIONS[0],
    roadAddress: "",
    lotAddress: "",
    latitude: "",
    longitude: "",
    openHours: "",
    openHoursDetail: "",
    phone: "",
};

export function NewChangeRequestPage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const location = useLocation();
    const prefill = (location.state ?? {}) as PrefillState;

    const [kind, setKind] = useState<ChangeRequestKind>(prefill.kind ?? ChangeRequestKind.Add);
    const [targetId, setTargetId] = useState<string>(
        prefill.targetToiletId !== undefined ? String(prefill.targetToiletId) : "",
    );
    const [fields, setFields] = useState<ToiletFormFields>(EMPTY_FIELDS);
    /** "지금 내 위치로 입력"이 채운 주소 — 지우기 때 사용자가 고치지 않은 주소만 같이 지우려고 기억한다 */
    const autoAddress = useRef<ReverseAddress | null>(null);
    /** Edit 모드 일 때 fetch 직후 스냅샷 — 제출 시 fields 와 비교해 변경된 항목만 payload 에 담음. */
    const [originalFields, setOriginalFields] = useState<ToiletFormFields | null>(null);
    const [note, setNote] = useState("");        // Add/Edit 시 자유 메모
    const [reason, setReason] = useState("");    // Delete 시 사유 (필수)

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneId, setDoneId] = useState<number | null>(null);

    const requiresTargetId = kind !== ChangeRequestKind.Add;
    const targetIdNum = Number(targetId);
    const targetIdValid = requiresTargetId && targetId !== "" && !isNaN(targetIdNum);

    const qc = useQueryClient();

    // Edit 시 대상 toilet 현재값을 fetch — fields 에 prefill, 제출 시 diff 비교 기준.
    // 키는 상세 화면·관리자 화면과 같은 ["toilet", id] (같은 fetchToilet 응답, 승인 시 함께 무효화)
    const detailQuery = useQuery({
        enabled: kind === ChangeRequestKind.Edit && targetIdValid,
        queryKey: ["toilet", targetIdNum],
        queryFn: () => fetchToilet(targetIdNum),
    });

    // 종류 전환 시 폼 초기화 (Add 기본값으로 / originalFields 도 리셋)
    useEffect(() => {
        setFields(EMPTY_FIELDS);
        setOriginalFields(null);
    }, [kind]);

    // Edit 모드에서 detail fetch 완료되면 fields + originalFields 동시 채움
    useEffect(() => {
        if (kind !== ChangeRequestKind.Edit || !detailQuery.data) return;
        const populated = toFormFields(detailQuery.data);
        setFields(populated);
        setOriginalFields(populated);
    }, [kind, detailQuery.data]);


    if (!auth.user) {
        return (
            <Alert severity="info">
                {t("report.loginRequired")}{" "}
                <Button size="small" onClick={() => navigate("/login")}>{t("nav.login")}</Button>
            </Alert>
        );
    }

    if (doneId !== null) {
        return (
            <Stack spacing={2}>
                <Alert severity="success">
                    <Trans i18nKey="report.done" values={{ id: doneId }} components={{ b: <b /> }} />
                </Alert>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setDoneId(null);
                            setKind(ChangeRequestKind.Add);
                            setTargetId("");
                            setFields(EMPTY_FIELDS);
                            setNote("");
                            setReason("");
                            setError(null);
                        }}
                    >
                        {t("report.another")}
                    </Button>
                    <Button onClick={() => navigate("/")}>{t("common.backHome")}</Button>
                </Stack>
            </Stack>
        );
    }

    function patch<K extends keyof ToiletFormFields>(key: K, value: ToiletFormFields[K]) {
        setFields((f) => ({ ...f, [key]: value }));
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (requiresTargetId && !targetIdValid) {
            setError(t("report.errorNoTarget"));
            return;
        }
        if (kind === ChangeRequestKind.Add && !fields.name.trim()) {
            setError(t("report.errorNoName"));
            return;
        }
        if (kind === ChangeRequestKind.Delete && !reason.trim()) {
            setError(t("report.errorNoReason"));
            return;
        }

        const payload = buildPayload(kind, fields, originalFields, note, reason);
        if (!payload) {
            setError(t("report.errorNoChange"));
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitChangeRequest({
                kind,
                targetToiletId: requiresTargetId ? targetIdNum : null,
                payloadJson: JSON.stringify(payload),
            });
            setDoneId(result.id);
            void qc.invalidateQueries({ queryKey: ["me", "change-requests"] }); // 내 정보의 제보 목록
        } catch (err) {
            setError(friendlyError(err, t("report.errorSubmit")));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
            <Typography variant="h4" component="h1" sx={{ mb: 1 }}>{t("report.title")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("report.intro")}
            </Typography>

            <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                    <TextField
                        select
                        label={t("report.kindLabel")}
                        value={kind}
                        onChange={(e) => setKind(e.target.value as ChangeRequestKind)}
                        helperText={t(`report.kind.${kind}.description`)}
                        fullWidth
                    >
                        {CHANGE_REQUEST_KIND_OPTIONS.map((k) => (
                            <MenuItem key={k} value={k}>
                                {t(`report.kind.${k}.label`)}
                            </MenuItem>
                        ))}
                    </TextField>

                    {requiresTargetId && (
                        <TextField
                            label={t("report.targetId")}
                            type="number"
                            value={targetId}
                            onChange={(e) => setTargetId(e.target.value)}
                            helperText={
                                prefill.targetName
                                    ? t("report.targetSelected", { name: prefill.targetName })
                                    : t("report.targetHint")
                            }
                            required
                            fullWidth
                        />
                    )}

                    {(kind === ChangeRequestKind.Add || kind === ChangeRequestKind.Edit) && (
                        <>
                            {kind === ChangeRequestKind.Edit && (
                                <Alert severity="info">
                                    <Trans i18nKey="report.updateInfo" components={{ b: <b /> }} />
                                </Alert>
                            )}

                            <Divider textAlign="left">{t("report.sectionBasic")}</Divider>
                            <TextField
                                label={t("report.name")}
                                value={fields.name}
                                onChange={(e) => patch("name", e.target.value)}
                                placeholder={detailQuery.data?.name ?? ""}
                                required={kind === ChangeRequestKind.Add}
                                fullWidth
                            />
                            <TextField
                                select
                                label={t("report.toiletKind")}
                                value={fields.kind}
                                onChange={(e) => patch("kind", e.target.value)}
                                helperText={
                                    detailQuery.data
                                        ? t("report.currentKind", { kind: toiletKindLabel(t, detailQuery.data.kind) })
                                        : undefined
                                }
                                fullWidth
                            >
                                {TOILET_KIND_OPTIONS.map((k) => (
                                    <MenuItem key={k} value={k}>{toiletKindLabel(t, k)}</MenuItem>
                                ))}
                            </TextField>

                            <Divider textAlign="left">{t("report.sectionLocation")}</Divider>
                            {kind === ChangeRequestKind.Add && (
                                <CoordinateCapture
                                    captured={fields.latitude !== "" && fields.longitude !== ""}
                                    onSet={(lat, lng, address) => {
                                        setFields((f) => ({
                                            ...f,
                                            latitude: lat,
                                            longitude: lng,
                                            // 찾은 주소만 덮어쓴다. 못 찾은 칸은 사용자가 쓴 값을 그대로 둔다
                                            roadAddress: address?.roadAddress || f.roadAddress,
                                            lotAddress: address?.lotAddress || f.lotAddress,
                                        }));
                                        autoAddress.current = address;
                                    }}
                                    onClear={() => {
                                        const auto = autoAddress.current;
                                        setFields((f) => ({
                                            ...f,
                                            latitude: "",
                                            longitude: "",
                                            // 자동으로 채운 주소를 손대지 않았으면 같이 지운다
                                            roadAddress: auto?.roadAddress && f.roadAddress === auto.roadAddress ? "" : f.roadAddress,
                                            lotAddress: auto?.lotAddress && f.lotAddress === auto.lotAddress ? "" : f.lotAddress,
                                        }));
                                        autoAddress.current = null;
                                    }}
                                />
                            )}
                            <TextField
                                label={t("report.roadAddress")}
                                value={fields.roadAddress}
                                onChange={(e) => patch("roadAddress", e.target.value)}
                                placeholder={detailQuery.data?.roadAddress ?? ""}
                                fullWidth
                            />
                            <TextField
                                label={t("report.lotAddress")}
                                value={fields.lotAddress}
                                onChange={(e) => patch("lotAddress", e.target.value)}
                                placeholder={detailQuery.data?.lotAddress ?? ""}
                                fullWidth
                            />
                            {kind === ChangeRequestKind.Add ? null : (
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                    <TextField
                                        label={t("report.latitude")}
                                        helperText={t("report.coordHint")}
                                        type="number"
                                        value={fields.latitude}
                                        onChange={(e) => patch("latitude", e.target.value)}
                                        placeholder={detailQuery.data?.latitude?.toString() ?? t("report.latitudeExample")}
                                        fullWidth
                                        slotProps={{ htmlInput: { step: "any" } }}
                                    />
                                    <TextField
                                        label={t("report.longitude")}
                                        type="number"
                                        value={fields.longitude}
                                        onChange={(e) => patch("longitude", e.target.value)}
                                        placeholder={detailQuery.data?.longitude?.toString() ?? t("report.longitudeExample")}
                                        fullWidth
                                        slotProps={{ htmlInput: { step: "any" } }}
                                    />
                                </Stack>
                            )}

                            <Divider textAlign="left">{t("report.sectionHours")}</Divider>
                            <TextField
                                label={t("report.openHours")}
                                value={fields.openHours}
                                onChange={(e) => patch("openHours", e.target.value)}
                                placeholder={detailQuery.data?.openHours ?? t("report.openHoursExample")}
                                fullWidth
                            />
                            <TextField
                                label={t("report.openHoursDetail")}
                                value={fields.openHoursDetail}
                                onChange={(e) => patch("openHoursDetail", e.target.value)}
                                placeholder={detailQuery.data?.openHoursDetail ?? t("report.openHoursDetailExample")}
                                fullWidth
                            />
                            <TextField
                                label={t("report.phone")}
                                value={fields.phone}
                                onChange={(e) => patch("phone", e.target.value)}
                                placeholder={detailQuery.data?.phone ?? ""}
                                fullWidth
                            />

                            <Divider textAlign="left">{t("report.sectionNote")}</Divider>
                            <TextField
                                label={t("report.note")}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t("report.notePlaceholder")}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                        </>
                    )}

                    {kind === ChangeRequestKind.Delete && (
                        <>
                            <Alert severity="warning">
                                {t("report.deleteInfo")}
                            </Alert>
                            <TextField
                                label={t("report.deleteReason")}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={t("report.deleteReasonPlaceholder")}
                                multiline
                                minRows={4}
                                required
                                fullWidth
                            />
                        </>
                    )}

                    {detailQuery.isFetching && kind === ChangeRequestKind.Edit && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography variant="caption" color="text.secondary">{t("report.loadingCurrent")}</Typography>
                        </Stack>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button type="submit" variant="contained" disabled={submitting}>
                            {submitting ? t("common.sending") : t("report.submit")}
                        </Button>
                        <Button onClick={() => navigate(-1)} disabled={submitting}>
                            {t("common.cancel")}
                        </Button>
                    </Stack>
                </Stack>
            </form>
        </Box>
    );
}

type CaptureStatus =
    | { step: "idle" }
    | { step: "locating" }
    | { step: "addressing" }
    | { step: "done"; road: string; lot: string; addressFailed: boolean }
    | { step: "error"; message: string };

/**
 * Add 모드용 위치 입력 — 한 번 눌러 현재 위치를 잡고, 그 좌표의 도로명·지번 주소를 칸에 채운다.
 * 진행·결과·오류를 모두 이 한 칸 안에서 보여 준다. 비워 두면 서버 geocode 워커가 나중에 주소로 좌표를 채운다.
 */
function CoordinateCapture({
    captured,
    onSet,
    onClear,
}: {
    captured: boolean;
    onSet: (lat: string, lng: string, address: ReverseAddress | null) => void;
    onClear: () => void;
}) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<CaptureStatus>({ step: "idle" });
    const busy = status.step === "locating" || status.step === "addressing";
    // 폼이 바깥에서 비워졌으면 (종류 변경 등) 이 칸도 처음으로
    const shown: CaptureStatus = !captured && status.step === "done" ? { step: "idle" } : status;

    async function capture() {
        setStatus({ step: "locating" });
        let lat: number, lng: number;
        try {
            // 앱이면 브리지로 네이티브 GPS, 브라우저면 navigator.geolocation
            ({ lat, lng } = await getCurrentPosition({ enableHighAccuracy: true, timeout: 8_000 }));
        } catch (err) {
            setStatus({ step: "error", message: err instanceof LocationError ? err.message : t("location.failed") });
            return;
        }
        setStatus({ step: "addressing" });
        let address: ReverseAddress | null = null;
        try {
            address = await reverseGeocode(lat, lng);
        } catch {
            address = null;
        }
        onSet(String(lat), String(lng), address);
        const found = !!address && (address.roadAddress !== "" || address.lotAddress !== "");
        setStatus({
            step: "done",
            road: address?.roadAddress ?? "",
            lot: address?.lotAddress ?? "",
            addressFailed: !found,
        });
    }

    function clear() {
        onClear();
        setStatus({ step: "idle" });
    }

    let icon: React.ReactNode;
    let title: string;
    let detail: React.ReactNode = null;
    switch (shown.step) {
        case "idle":
            icon = <MyLocationIcon color="primary" />;
            title = t("report.useMyLocation");
            detail = t("report.locationHint");
            break;
        case "locating":
            title = t("report.locating");
            icon = <CircularProgress size={22} aria-label={title} />;
            break;
        case "addressing":
            title = t("report.findingAddress");
            icon = <CircularProgress size={22} aria-label={title} />;
            break;
        case "done":
            icon = <CheckCircleIcon color="success" />;
            title = t("report.locationSet");
            detail = shown.addressFailed ? t("report.addressNotFound") : (shown.road || shown.lot);
            break;
        case "error":
            icon = <ErrorOutlineIcon color="error" />;
            title = t("report.locationFailedTitle");
            detail = shown.message;
            break;
    }

    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                border: 2,
                borderColor: shown.step === "done" ? "success.main" : shown.step === "error" ? "error.main" : "text.primary",
                borderRadius: 1,
                p: 1.5,
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ display: "flex", flexShrink: 0, width: 24, justifyContent: "center" }}>{icon}</Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
                    {detail && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "keep-all" }}>
                            {detail}
                        </Typography>
                    )}
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    {shown.step === "idle" && (
                        <Button variant="contained" size="small" onClick={capture}>{t("report.useMyLocationShort")}</Button>
                    )}
                    {shown.step === "done" && (
                        <>
                            <Button size="small" onClick={capture} disabled={busy}>{t("report.relocate")}</Button>
                            <Button size="small" onClick={clear}>{t("common.clear")}</Button>
                        </>
                    )}
                    {shown.step === "error" && (
                        <Button size="small" variant="outlined" onClick={capture}>{t("report.relocate")}</Button>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
}

/** ToiletDetail (api.ts) → 폼 필드 형식. lat/lng 는 문자열로 (input value 호환). */
function toFormFields(d: import("../api").ToiletDetail): ToiletFormFields {
    return {
        name: d.name ?? "",
        kind: d.kind ?? TOILET_KIND_OPTIONS[0],
        roadAddress: d.roadAddress ?? "",
        lotAddress: d.lotAddress ?? "",
        latitude: d.latitude !== null && d.latitude !== undefined ? String(d.latitude) : "",
        longitude: d.longitude !== null && d.longitude !== undefined ? String(d.longitude) : "",
        openHours: d.openHours ?? "",
        openHoursDetail: d.openHoursDetail ?? "",
        phone: d.phone ?? "",
    };
}

/**
 * 폼 입력 → payload object.
 * - **Add**: 비어있지 않은 필드만 포함 (`name` 필수). `kind` 는 항상 포함.
 * - **Edit**: `original` 과 비교해 *변경된* 필드만 포함. 빈 값으로 바꾸면 `null` 명시.
 * - **Delete**: `reason` 만.
 */
function buildPayload(
    kind: ChangeRequestKind,
    f: ToiletFormFields,
    original: ToiletFormFields | null,
    note: string,
    reason: string,
): Record<string, unknown> | null {
    if (kind === ChangeRequestKind.Delete) {
        return reason.trim() ? { reason: reason.trim() } : null;
    }

    const out: Record<string, unknown> = {};

    if (kind === ChangeRequestKind.Edit && original) {
        // diff 모드 — 바뀐 필드만 포함. 비워서 의도적 삭제하면 명시적 null.
        const txt = (key: keyof ToiletFormFields, jsonKey: string) => {
            const cur = f[key].trim();
            const orig = original[key].trim();
            if (cur === orig) return;
            out[jsonKey] = cur === "" ? null : cur;
        };
        txt("name", "name");
        if (f.kind !== original.kind) out.kind = f.kind;
        txt("roadAddress", "roadAddress");
        txt("lotAddress", "lotAddress");

        const num = (key: "latitude" | "longitude", jsonKey: string) => {
            const cur = f[key].trim() ? Number(f[key]) : null;
            const orig = original[key].trim() ? Number(original[key]) : null;
            if (cur === orig) return;
            out[jsonKey] = cur !== null && !isNaN(cur) ? cur : null;
        };
        num("latitude", "latitude");
        num("longitude", "longitude");

        txt("openHours", "openHours");
        txt("openHoursDetail", "openHoursDetail");
        txt("phone", "phone");
    } else {
        // Add 모드 — 채워진 필드만, kind 는 항상 포함.
        if (f.name.trim()) out.name = f.name.trim();
        out.kind = f.kind;
        if (f.roadAddress.trim()) out.roadAddress = f.roadAddress.trim();
        if (f.lotAddress.trim()) out.lotAddress = f.lotAddress.trim();
        const lat = f.latitude.trim() ? Number(f.latitude) : null;
        const lng = f.longitude.trim() ? Number(f.longitude) : null;
        if (lat !== null && !isNaN(lat)) out.latitude = lat;
        if (lng !== null && !isNaN(lng)) out.longitude = lng;
        if (f.openHours.trim()) out.openHours = f.openHours.trim();
        if (f.openHoursDetail.trim()) out.openHoursDetail = f.openHoursDetail.trim();
        if (f.phone.trim()) out.phone = f.phone.trim();
    }

    if (note.trim()) out.note = note.trim();

    if (kind === ChangeRequestKind.Add && !out.name) return null;

    // Edit 는 변경 사항이 한 개도 없으면 (note 만 있어도) null — 의미 없는 요청 차단.
    const meaningful = Object.keys(out).filter((k) => k !== "note");
    if (meaningful.length === 0) return null;

    return out;
}


import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { fetchToilet, submitChangeRequest } from "../api";
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

/** 8개 핵심 필드 — Add/Update 둘 다 사용. */
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
    const location = useLocation();
    const prefill = (location.state ?? {}) as PrefillState;

    const [kind, setKind] = useState<ChangeRequestKind>(prefill.kind ?? ChangeRequestKind.Add);
    const [targetId, setTargetId] = useState<string>(
        prefill.targetToiletId !== undefined ? String(prefill.targetToiletId) : "",
    );
    const [fields, setFields] = useState<ToiletFormFields>(EMPTY_FIELDS);
    /** Update 모드 일 때 fetch 직후 스냅샷 — 제출 시 fields 와 비교해 변경된 항목만 payload 에 담음. */
    const [originalFields, setOriginalFields] = useState<ToiletFormFields | null>(null);
    const [note, setNote] = useState("");        // Add/Update 시 자유 메모
    const [reason, setReason] = useState("");    // Delete 시 사유 (필수)

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneId, setDoneId] = useState<number | null>(null);

    const requiresTargetId = kind !== ChangeRequestKind.Add;
    const targetIdNum = Number(targetId);
    const targetIdValid = requiresTargetId && targetId !== "" && !isNaN(targetIdNum);

    // Update 시 대상 toilet 현재값을 fetch — fields 에 prefill, 제출 시 diff 비교 기준.
    const detailQuery = useQuery({
        enabled: kind === ChangeRequestKind.Update && targetIdValid,
        queryKey: ["toilet-detail", targetIdNum],
        queryFn: () => fetchToilet(targetIdNum),
    });

    // 종류 전환 시 폼 초기화 (Add 기본값으로 / originalFields 도 리셋)
    useEffect(() => {
        setFields(EMPTY_FIELDS);
        setOriginalFields(null);
    }, [kind]);

    // Update 모드에서 detail fetch 완료되면 fields + originalFields 동시 채움
    useEffect(() => {
        if (kind !== ChangeRequestKind.Update || !detailQuery.data) return;
        const populated = toFormFields(detailQuery.data);
        setFields(populated);
        setOriginalFields(populated);
    }, [kind, detailQuery.data]);

    const kindMeta = useMemo(
        () => CHANGE_REQUEST_KIND_OPTIONS.find((o) => o.value === kind)!,
        [kind],
    );

    if (!auth.user) {
        return (
            <Alert severity="info">
                요청 작성은 로그인 후 가능해요.{" "}
                <Button size="small" onClick={() => navigate("/login")}>로그인</Button>
            </Alert>
        );
    }

    if (doneId !== null) {
        return (
            <Stack spacing={2}>
                <Alert severity="success">
                    요청이 접수됐어요 (id <b>#{doneId}</b>). 관리자가 검토 후 반영합니다.
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
                        하나 더 작성
                    </Button>
                    <Button onClick={() => navigate("/")}>홈으로</Button>
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
            setError("대상 화장실 ID 가 필요합니다 (숫자).");
            return;
        }
        if (kind === ChangeRequestKind.Add && !fields.name.trim()) {
            setError("이름은 필수입니다.");
            return;
        }
        if (kind === ChangeRequestKind.Delete && !reason.trim()) {
            setError("삭제 사유는 필수입니다.");
            return;
        }

        const payload = buildPayload(kind, fields, originalFields, note, reason);
        if (!payload) {
            setError("변경하거나 입력한 내용이 없어요. 최소 한 항목은 채워주세요.");
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
        } catch (err) {
            setError((err as Error).message || "요청 실패");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
            <Typography variant="h4" sx={{ mb: 1 }}>변경 요청 작성</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                잘못된 정보 / 새 화장실 / 사라진 화장실을 알려주세요. 관리자 검토 후 DB 에 반영됩니다 (즉시 반영 안 됨).
            </Typography>

            <form onSubmit={onSubmit}>
                <Stack spacing={2}>
                    <TextField
                        select
                        label="요청 종류"
                        value={kind}
                        onChange={(e) => setKind(e.target.value as ChangeRequestKind)}
                        helperText={kindMeta.description}
                        fullWidth
                    >
                        {CHANGE_REQUEST_KIND_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {o.label} ({o.value})
                            </MenuItem>
                        ))}
                    </TextField>

                    {requiresTargetId && (
                        <TextField
                            label="대상 화장실 ID"
                            type="number"
                            value={targetId}
                            onChange={(e) => setTargetId(e.target.value)}
                            helperText={
                                prefill.targetName
                                    ? `대상: ${prefill.targetName}`
                                    : "홈 화면에서 핀을 선택한 뒤 단축 버튼으로 들어오면 자동 채움."
                            }
                            required
                            fullWidth
                        />
                    )}

                    {(kind === ChangeRequestKind.Add || kind === ChangeRequestKind.Update) && (
                        <>
                            {kind === ChangeRequestKind.Update && (
                                <Alert severity="info">
                                    현재 정보를 채워뒀어요. 바꿀 항목만 수정하고 나머지는 그대로 두세요.
                                    제출 시 <b>변경된 항목만</b> 요청에 포함됩니다.
                                </Alert>
                            )}

                            <Divider textAlign="left">기본 정보</Divider>
                            <TextField
                                label={kind === ChangeRequestKind.Add ? "이름 *" : "이름"}
                                value={fields.name}
                                onChange={(e) => patch("name", e.target.value)}
                                placeholder={detailQuery.data?.name ?? ""}
                                required={kind === ChangeRequestKind.Add}
                                fullWidth
                            />
                            <TextField
                                select
                                label="종류"
                                value={fields.kind}
                                onChange={(e) => patch("kind", e.target.value)}
                                helperText={
                                    detailQuery.data
                                        ? `현재: ${detailQuery.data.kind}`
                                        : undefined
                                }
                                fullWidth
                            >
                                {TOILET_KIND_OPTIONS.map((k) => (
                                    <MenuItem key={k} value={k}>{k}</MenuItem>
                                ))}
                            </TextField>

                            <Divider textAlign="left">위치</Divider>
                            <TextField
                                label="도로명 주소"
                                value={fields.roadAddress}
                                onChange={(e) => patch("roadAddress", e.target.value)}
                                placeholder={detailQuery.data?.roadAddress ?? ""}
                                fullWidth
                            />
                            <TextField
                                label="지번 주소"
                                value={fields.lotAddress}
                                onChange={(e) => patch("lotAddress", e.target.value)}
                                placeholder={detailQuery.data?.lotAddress ?? ""}
                                fullWidth
                            />
                            {kind === ChangeRequestKind.Add ? (
                                <CoordinateCapture
                                    latitude={fields.latitude}
                                    longitude={fields.longitude}
                                    onSet={(lat, lng) => {
                                        patch("latitude", lat);
                                        patch("longitude", lng);
                                    }}
                                    onClear={() => {
                                        patch("latitude", "");
                                        patch("longitude", "");
                                    }}
                                    onError={setError}
                                />
                            ) : (
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                    <TextField
                                        label="위도"
                                        type="number"
                                        value={fields.latitude}
                                        onChange={(e) => patch("latitude", e.target.value)}
                                        placeholder={detailQuery.data?.latitude?.toString() ?? "예: 37.5666"}
                                        fullWidth
                                        slotProps={{ htmlInput: { step: "any" } }}
                                    />
                                    <TextField
                                        label="경도"
                                        type="number"
                                        value={fields.longitude}
                                        onChange={(e) => patch("longitude", e.target.value)}
                                        placeholder={detailQuery.data?.longitude?.toString() ?? "예: 126.9784"}
                                        fullWidth
                                        slotProps={{ htmlInput: { step: "any" } }}
                                    />
                                </Stack>
                            )}

                            <Divider textAlign="left">운영</Divider>
                            <TextField
                                label="영업시간"
                                value={fields.openHours}
                                onChange={(e) => patch("openHours", e.target.value)}
                                placeholder={detailQuery.data?.openHours ?? "예: 상시, 정시"}
                                fullWidth
                            />
                            <TextField
                                label="영업시간 상세"
                                value={fields.openHoursDetail}
                                onChange={(e) => patch("openHoursDetail", e.target.value)}
                                placeholder={detailQuery.data?.openHoursDetail ?? "예: 07:00~22:00"}
                                fullWidth
                            />
                            <TextField
                                label="전화번호"
                                value={fields.phone}
                                onChange={(e) => patch("phone", e.target.value)}
                                placeholder={detailQuery.data?.phone ?? ""}
                                fullWidth
                            />

                            <Divider textAlign="left">메모 (선택)</Divider>
                            <TextField
                                label="추가 설명"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="검토자에게 전달할 사항이 있으면 적어주세요. (예: 시설 위치 안내, 변경 사유 등)"
                                multiline
                                minRows={2}
                                fullWidth
                            />
                        </>
                    )}

                    {kind === ChangeRequestKind.Delete && (
                        <>
                            <Alert severity="warning">
                                삭제 요청은 이 화장실 레코드를 DB 에서 제거하자는 제안입니다 (예: 사라짐 / 잘못 등록 / 중복).
                            </Alert>
                            <TextField
                                label="삭제 사유 *"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="예: 건물 철거로 사라짐 / 잘못 등록된 위치 / 다른 화장실(#1234)과 중복"
                                multiline
                                minRows={4}
                                required
                                fullWidth
                            />
                        </>
                    )}

                    {detailQuery.isFetching && kind === ChangeRequestKind.Update && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography variant="caption" color="text.secondary">현재 정보 불러오는 중…</Typography>
                        </Stack>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button type="submit" variant="contained" disabled={submitting}>
                            {submitting ? "전송 중…" : "요청 제출"}
                        </Button>
                        <Button onClick={() => navigate(-1)} disabled={submitting}>
                            취소
                        </Button>
                    </Stack>
                </Stack>
            </form>
        </Box>
    );
}

/**
 * Add 모드용 좌표 입력 — 수동 입력 대신 한 번 클릭으로 현재 위치 캡처.
 * 비워두면 서버 geocode 워커가 추후 주소로 자동 보정.
 */
function CoordinateCapture({
    latitude,
    longitude,
    onSet,
    onClear,
    onError,
}: {
    latitude: string;
    longitude: string;
    onSet: (lat: string, lng: string) => void;
    onClear: () => void;
    onError: (msg: string) => void;
}) {
    const [capturing, setCapturing] = useState(false);
    const captured = latitude !== "" && longitude !== "";

    async function capture() {
        if (!navigator.geolocation) {
            onError("이 브라우저는 위치 권한을 지원하지 않습니다.");
            return;
        }
        setCapturing(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                onSet(String(pos.coords.latitude), String(pos.coords.longitude));
                setCapturing(false);
            },
            (err) => {
                onError(`위치 캡처 실패: ${err.message}`);
                setCapturing(false);
            },
            { enableHighAccuracy: true, timeout: 8_000 },
        );
    }

    return (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            {captured ? (
                <>
                    <Chip
                        color="success"
                        label={`📍 ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`}
                    />
                    <Button size="small" onClick={onClear}>지우기</Button>
                    <Button size="small" onClick={capture} disabled={capturing}>
                        {capturing ? "캡처 중…" : "다시 캡처"}
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={capture}
                        disabled={capturing}
                        startIcon={capturing ? <CircularProgress size={14} /> : null}
                    >
                        {capturing ? "캡처 중…" : "📍 현재 위치를 좌표로 사용"}
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                        화장실 앞이면 한 번 누르세요. 비워두면 서버가 주소로 자동 보정합니다.
                    </Typography>
                </>
            )}
        </Stack>
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
 * - **Update**: `original` 과 비교해 *변경된* 필드만 포함. 빈 값으로 바꾸면 `null` 명시.
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

    if (kind === ChangeRequestKind.Update && original) {
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

    // Update 는 변경 사항이 한 개도 없으면 (note 만 있어도) null — 의미 없는 요청 차단.
    const meaningful = Object.keys(out).filter((k) => k !== "note");
    if (meaningful.length === 0) return null;

    return out;
}


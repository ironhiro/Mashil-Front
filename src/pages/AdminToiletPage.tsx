import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router-dom";
import { deactivateOverride, fetchToiletAdmin, saveToiletOverrides } from "../adminApi";
import type { OverrideHistoryRow, ToiletAdminValues, ToiletAdminView } from "../adminApi";
import { AdminError, AdminPage, Loading, labelOf } from "../components/AdminParts";
import { ChangeRequestStatusTag } from "../components/ChangeRequestStatusTag";
import { formatDateTime } from "../i18n";
import type { ChangeRequestStatus } from "../lib/enums";

/** 편집 칸: payload 키, 오버라이드 필드 이름, 지금 값에서 읽는 속성 */
const TEXT_FIELDS = [
    { key: "name", field: "name", prop: "name" },
    { key: "roadAddress", field: "road_address", prop: "roadAddress" },
    { key: "lotAddress", field: "lot_address", prop: "lotAddress" },
    { key: "phone", field: "phone", prop: "phone" },
    { key: "openHours", field: "open_hours", prop: "openHours" },
    { key: "openHoursDetail", field: "open_hours_detail", prop: "openHoursDetail" },
] as const satisfies readonly { key: string; field: string; prop: keyof ToiletAdminValues }[];

type Draft = Record<(typeof TEXT_FIELDS)[number]["key"] | "latitude" | "longitude" | "status", string>;

function draftOf(v: ToiletAdminView): Draft {
    const c = v.current;
    const adminStatus = v.overrides.find((o) => o.isActive && o.source === "Admin" && o.fieldName === "status");
    return {
        name: c.name ?? "",
        roadAddress: c.roadAddress ?? "",
        lotAddress: c.lotAddress ?? "",
        phone: c.phone ?? "",
        openHours: c.openHours ?? "",
        openHoursDetail: c.openHoursDetail ?? "",
        latitude: c.latitude?.toString() ?? "",
        longitude: c.longitude?.toString() ?? "",
        status: adminStatus ? (JSON.parse(adminStatus.valueJson) as string) : "",
    };
}

function valueText(o: OverrideHistoryRow): string {
    try {
        const v = JSON.parse(o.valueJson) as unknown;
        if (v === null) return "";
        if (typeof v === "object" && v && "lat" in v && "lng" in v) return `${(v as { lat: number }).lat}, ${(v as { lng: number }).lng}`;
        return String(v);
    } catch {
        return o.valueJson;
    }
}

/**
 * 화장실 직접 수정 (ADM-04). 칸마다 지금 값과 원본 값, 관리자 값이 있으면 "원본으로".
 * 저장은 바뀐 칸만 보낸다. 아래는 덮어쓴 값의 이력(꺼진 것 포함)과 이 화장실에 온 제보.
 */
export function AdminToiletPage() {
    const { t } = useTranslation();
    const id = Number(useParams().id);
    const qc = useQueryClient();
    const query = useQuery({ queryKey: ["admin", "toilet", id], queryFn: () => fetchToiletAdmin(id), enabled: Number.isFinite(id) });
    const [draft, setDraft] = useState<Draft | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (query.data) setDraft(draftOf(query.data));
    }, [query.data]);

    const after = () => {
        void qc.invalidateQueries({ queryKey: ["admin", "toilet", id] });
        void qc.invalidateQueries({ queryKey: ["toilet", id] });
        void qc.invalidateQueries({ queryKey: ["toilets"] });
    };
    const save = useMutation({
        mutationFn: (body: Record<string, string | number | null>) => saveToiletOverrides(id, body),
        onSuccess: (r) => {
            const changed = [...r.appliedFields, ...r.clearedFields].map((f) => labelOf(t, "field", f));
            setNotice(changed.length ? t("adminConsole.saved", { fields: changed.join(", ") }) : t("adminConsole.nothingChanged"));
            after();
        },
    });
    const turnOff = useMutation({ mutationFn: (overrideId: number) => deactivateOverride(id, overrideId), onSuccess: after });

    const view = query.data;

    const submit = () => {
        if (!view || !draft) return;
        setFormError(null);
        const base = draftOf(view);
        const body: Record<string, string | number | null> = {};
        for (const f of TEXT_FIELDS) if (draft[f.key].trim() !== base[f.key].trim()) body[f.key] = draft[f.key].trim();
        if (draft.latitude !== base.latitude || draft.longitude !== base.longitude) {
            const lat = Number(draft.latitude);
            const lng = Number(draft.longitude);
            if (!draft.latitude || !draft.longitude || !(lat >= 33 && lat <= 39) || !(lng >= 124 && lng <= 132)) {
                setFormError(t("adminConsole.invalidLocation"));
                return;
            }
            body.latitude = lat;
            body.longitude = lng;
        }
        if (draft.status !== base.status) body.status = draft.status || null;
        if (Object.keys(body).length === 0) {
            setNotice(t("adminConsole.nothingChanged"));
            return;
        }
        save.mutate(body);
    };

    /** 원본으로: 그 필드의 관리자 오버라이드를 끈다 (다음 순위 값이나 원본으로 돌아감) */
    const adminOverrideId = (field: string) => view?.overrides.find((o) => o.isActive && o.source === "Admin" && o.fieldName === field)?.id;

    return (
        <AdminPage title={t("adminConsole.toiletTitle")} intro={t("adminConsole.toiletIntro")}>
            {query.isLoading && <Loading />}
            <AdminError error={query.error} fallback={t("adminConsole.loadFailed")} />
            {view && draft && (
                <>
                    <Box className="plate">
                        <Typography sx={{ fontWeight: 800, fontSize: "var(--text-xl)" }}>{view.current.name}</Typography>
                        <span className="board-meta" style={{ marginTop: 0 }}>
                            <span>{t("adminConsole.managementNo", { no: view.managementNo })}</span>
                            <span>{labelOf(t, "toiletStatus", view.status)}</span>
                            {view.openIssues > 0 && <span>{t("adminConsole.openIssues", { n: view.openIssues })}</span>}
                        </span>
                        <Button component={RouterLink} to={`/toilets/${view.id}`} variant="outlined" size="small" sx={{ alignSelf: "flex-start" }}>
                            {t("adminConsole.openDetail")}
                        </Button>
                    </Box>
                    {!view.source && <Alert severity="info">{t("adminConsole.noSource")}</Alert>}

                    <Stack spacing={1.5} component="form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                        {TEXT_FIELDS.map((f) => {
                            const src = view.source?.[f.prop];
                            return (
                                <Box key={f.key} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, alignItems: "start" }}>
                                    <TextField
                                        size="small"
                                        label={labelOf(t, "field", f.field)}
                                        value={draft[f.key]}
                                        multiline={f.key === "openHoursDetail"}
                                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                                        helperText={view.source ? (src ? t("adminConsole.sourceValue", { value: src }) : t("adminConsole.sourceEmpty")) : undefined}
                                    />
                                    {adminOverrideId(f.field) !== undefined && (
                                        <Button variant="text" size="small" disabled={turnOff.isPending} onClick={() => turnOff.mutate(adminOverrideId(f.field)!)}>
                                            {t("adminConsole.revert")}
                                        </Button>
                                    )}
                                </Box>
                            );
                        })}
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr)) auto", gap: 1, alignItems: "start" }}>
                            <TextField size="small" label={t("adminConsole.latitude")} inputMode="decimal" value={draft.latitude} onChange={(e) => setDraft({ ...draft, latitude: e.target.value })} />
                            <TextField size="small" label={t("adminConsole.longitude")} inputMode="decimal" value={draft.longitude} onChange={(e) => setDraft({ ...draft, longitude: e.target.value })} />
                            {adminOverrideId("location") !== undefined && (
                                <Button variant="text" size="small" disabled={turnOff.isPending} onClick={() => turnOff.mutate(adminOverrideId("location")!)}>
                                    {t("adminConsole.revert")}
                                </Button>
                            )}
                        </Box>
                        <TextField select size="small" label={labelOf(t, "field", "status")} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                            <MenuItem value="">{t("adminConsole.statusAuto")}</MenuItem>
                            <MenuItem value="Active">{labelOf(t, "toiletStatus", "Active")}</MenuItem>
                            <MenuItem value="Removed">{labelOf(t, "toiletStatus", "Removed")}</MenuItem>
                        </TextField>
                        {formError && <Alert severity="warning">{formError}</Alert>}
                        {notice && (
                            <Alert severity="success" onClose={() => setNotice(null)}>
                                {notice}
                            </Alert>
                        )}
                        <AdminError error={save.error ?? turnOff.error} fallback={t("adminConsole.actionFailed")} />
                        <Button type="submit" variant="contained" size="large" disabled={save.isPending}>
                            {save.isPending ? t("common.sending") : t("adminConsole.save")}
                        </Button>
                    </Stack>

                    <section className="board" aria-label={t("adminConsole.historyTitle")}>
                        <div className="activity-head">
                            <h2>{t("adminConsole.historyTitle")}</h2>
                            <span>{view.overrides.length}</span>
                        </div>
                        {view.overrides.length === 0 && <p className="board-empty">{t("adminConsole.historyEmpty")}</p>}
                        {view.overrides.map((o) => (
                            <div key={o.id} className="activity-row">
                                <span style={{ minWidth: 0 }}>
                                    <span className="board-name">
                                        {labelOf(t, "field", o.fieldName)}: {valueText(o)}
                                    </span>
                                    <span className="board-meta">
                                        <span>{labelOf(t, "source", o.source)}</span>
                                        {o.changeRequestId !== null && <span>{t("adminConsole.byChangeRequest", { id: o.changeRequestId })}</span>}
                                        {o.createdByName && <span>{o.createdByName}</span>}
                                        <span>{formatDateTime(o.createdAt)}</span>
                                        <span>{o.isActive ? t("adminConsole.active") : t("adminConsole.inactive")}</span>
                                    </span>
                                </span>
                                {o.isActive && (
                                    <Button size="small" variant="outlined" disabled={turnOff.isPending} onClick={() => turnOff.mutate(o.id)}>
                                        {t("adminConsole.deactivate")}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </section>

                    <section className="board" aria-label={t("adminConsole.requestsTitle")}>
                        <div className="activity-head">
                            <h2>{t("adminConsole.requestsTitle")}</h2>
                            <span>{view.changeRequests.length}</span>
                        </div>
                        {view.changeRequests.length === 0 && <p className="board-empty">{t("adminConsole.requestsEmpty")}</p>}
                        {view.changeRequests.map((c) => (
                            <div key={c.id} className="activity-row">
                                <span style={{ minWidth: 0 }}>
                                    <span className="board-name">
                                        #{c.id} {t(`report.kind.${c.kind === "Update" ? "Edit" : (c.kind as "Add" | "Edit" | "Delete")}.label`)}
                                    </span>
                                    <span className="board-meta">
                                        <span>{formatDateTime(c.createdAt)}</span>
                                    </span>
                                    {c.reviewNote && <span className="activity-note">{c.reviewNote}</span>}
                                </span>
                                <ChangeRequestStatusTag status={c.status as ChangeRequestStatus} label={t(`admin.status.${c.status as ChangeRequestStatus}`)} />
                            </div>
                        ))}
                    </section>
                </>
            )}
        </AdminPage>
    );
}

import { useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
    ISSUE_FIELDS,
    ISSUE_STATUSES,
    bulkSetIssues,
    createValueMapping,
    deleteValueMapping,
    fetchIssueCounts,
    fetchIssueGroups,
    fetchIssues,
    fetchNormalizationReport,
    fetchValueMappings,
} from "../adminApi";
import type { IssueGroup, IssueStatus, ScheduleDayValue, ScheduleEntryInput, ScheduleStatusValue, ValueMappingView } from "../adminApi";
import { AdminError, AdminPage, Loading, hhmm, labelOf } from "../components/AdminParts";
import { formatDateTime } from "../i18n";

const PAGE = 30;
const SCHEDULE_STATUSES: ScheduleStatusValue[] = ["Scheduled", "AlwaysOpen", "NotOpen", "Irregular", "FollowsFacility", "Unknown"];

/**
 * 정규화 이슈 큐 (ADM-03, DATA-12·13·16).
 * 위: 필드별 성공률 판. 가운데: 필드·유형·상태로 거른 "같은 원본 값" 묶음, 건수 많은 순. 묶음마다 해결·무시(또는 다시 열기),
 * 해당 화장실 목록, 개방시간이면 매핑 등록. 아래: 매핑 사전과 해제.
 */
export function AdminIssuesPage() {
    const { t } = useTranslation();
    const [field, setField] = useState<string>("opening_hours");
    const [type, setType] = useState<string>("");
    const [status, setStatus] = useState<IssueStatus>("Open");
    const [limit, setLimit] = useState(PAGE);
    const [notice, setNotice] = useState<string | null>(null);
    const qc = useQueryClient();

    const counts = useQuery({ queryKey: ["admin", "issue-counts"], queryFn: fetchIssueCounts });
    const report = useQuery({ queryKey: ["admin", "normalization-report"], queryFn: fetchNormalizationReport, staleTime: 60_000 });
    const groups = useQuery({
        queryKey: ["admin", "issue-groups", field, type, status, limit],
        queryFn: () => fetchIssueGroups({ field: field || undefined, type: type || undefined, status, limit }),
        placeholderData: (prev) => prev,
    });

    const types = useMemo(
        () => [...new Set((counts.data ?? []).filter((c) => !field || c.fieldName === field).map((c) => c.type))].sort(),
        [counts.data, field],
    );

    const refresh = () => {
        void qc.invalidateQueries({ queryKey: ["admin", "issue-groups"] });
        void qc.invalidateQueries({ queryKey: ["admin", "issue-counts"] });
        void qc.invalidateQueries({ queryKey: ["admin", "issues"] });
        void qc.invalidateQueries({ queryKey: ["admin", "value-mappings"] });
    };

    const bulk = useMutation({
        mutationFn: (args: { group: IssueGroup; to: IssueStatus }) =>
            bulkSetIssues({ status: args.to, fieldName: args.group.fieldName, type: args.group.type, rawValue: args.group.rawValue, fromStatus: status }),
        onSuccess: (r) => {
            setNotice(t("adminConsole.bulkDone", { n: r.count }));
            refresh();
        },
    });

    return (
        <AdminPage title={t("adminConsole.issuesTitle")} intro={t("adminConsole.issuesIntro")}>
            {report.data && (
                <section aria-label={t("adminConsole.reportTitle")}>
                    <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                        {t("adminConsole.reportTitle")}
                    </Typography>
                    <div className="cells" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))" }}>
                        {report.data.fields.map((f) => (
                            <div key={f.field}>
                                <div className="cell-day">{labelOf(t, "issueField", f.field)}</div>
                                <div className="cell-figure">{f.rate}%</div>
                                <div className="cell-hours">{t("adminConsole.reportRate", { ok: f.ok.toLocaleString(), total: f.total.toLocaleString() })}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                <TextField
                    select
                    size="small"
                    label={t("adminConsole.filterField")}
                    value={field}
                    onChange={(e) => {
                        setField(e.target.value);
                        setType("");
                        setLimit(PAGE);
                    }}
                >
                    <MenuItem value="">{t("adminConsole.all")}</MenuItem>
                    {ISSUE_FIELDS.map((f) => (
                        <MenuItem key={f} value={f}>
                            {labelOf(t, "issueField", f)}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    size="small"
                    label={t("adminConsole.filterType")}
                    value={type}
                    onChange={(e) => {
                        setType(e.target.value);
                        setLimit(PAGE);
                    }}
                >
                    <MenuItem value="">{t("adminConsole.all")}</MenuItem>
                    {types.map((ty) => (
                        <MenuItem key={ty} value={ty}>
                            {labelOf(t, "issueType", ty)}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>
            <ToggleButtonGroup
                exclusive
                fullWidth
                value={status}
                onChange={(_, v: IssueStatus | null) => {
                    if (!v) return;
                    setStatus(v);
                    setLimit(PAGE);
                }}
                aria-label={t("adminConsole.filterStatus")}
            >
                {ISSUE_STATUSES.map((s) => (
                    <ToggleButton key={s} value={s}>
                        {labelOf(t, "issueStatus", s)}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {notice && (
                <Alert severity="success" onClose={() => setNotice(null)}>
                    {notice}
                </Alert>
            )}
            <AdminError error={groups.error} fallback={t("adminConsole.loadFailed")} />
            <AdminError error={bulk.error} fallback={t("adminConsole.actionFailed")} />
            {groups.isLoading && <Loading />}

            {groups.data && (
                <section className="board" aria-label={t("adminConsole.issuesTitle")}>
                    <div className="activity-head">
                        <h2>{t("adminConsole.groupsTotal", { n: groups.data.total.toLocaleString() })}</h2>
                        <span>{labelOf(t, "issueStatus", status)}</span>
                    </div>
                    {groups.data.items.length === 0 && <p className="board-empty">{t("adminConsole.groupsEmpty")}</p>}
                    {groups.data.items.map((g) => (
                        <GroupRow
                            key={`${g.fieldName}|${g.type}|${g.rawValue}`}
                            group={g}
                            status={status}
                            busy={bulk.isPending}
                            onSet={(to) => bulk.mutate({ group: g, to })}
                            onMapped={(msg) => {
                                setNotice(msg);
                                refresh();
                            }}
                        />
                    ))}
                    {groups.data.items.length < groups.data.total && (
                        <button type="button" className="activity-more" onClick={() => setLimit((l) => l + PAGE)}>
                            {t("adminConsole.loadMore")}
                        </button>
                    )}
                </section>
            )}

            <MappingList
                onChanged={(msg) => {
                    setNotice(msg);
                    refresh();
                }}
            />
        </AdminPage>
    );
}

function GroupRow({
    group,
    status,
    busy,
    onSet,
    onMapped,
}: {
    group: IssueGroup;
    status: IssueStatus;
    busy: boolean;
    onSet: (to: IssueStatus) => void;
    onMapped: (message: string) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<"none" | "toilets" | "mapping">("none");
    const canMap = group.fieldName === "opening_hours" && status === "Open" && group.rawValue !== null;
    return (
        <div className="activity-row" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                    {group.rawValue ?? t("adminConsole.emptyRaw")}
                </div>
                <span className="board-meta">
                    <span>{t("adminConsole.groupCount", { n: group.count.toLocaleString() })}</span>
                    <span>{labelOf(t, "issueField", group.fieldName)}</span>
                    <span>{labelOf(t, "issueType", group.type)}</span>
                    {group.note && <span>{group.note}</span>}
                </span>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                    {status === "Open" ? (
                        <>
                            <Button size="small" variant="outlined" disabled={busy} onClick={() => onSet("Resolved")}>
                                {t("adminConsole.resolve")}
                            </Button>
                            <Button size="small" variant="outlined" disabled={busy} onClick={() => onSet("Ignored")}>
                                {t("adminConsole.ignore")}
                            </Button>
                        </>
                    ) : (
                        <Button size="small" variant="outlined" disabled={busy} onClick={() => onSet("Open")}>
                            {t("adminConsole.reopen")}
                        </Button>
                    )}
                    {canMap && (
                        <Button size="small" variant={open === "mapping" ? "contained" : "outlined"} onClick={() => setOpen(open === "mapping" ? "none" : "mapping")}>
                            {t("adminConsole.addMapping")}
                        </Button>
                    )}
                    <Button size="small" variant="text" onClick={() => setOpen(open === "toilets" ? "none" : "toilets")}>
                        {open === "toilets" ? t("adminConsole.hideToilets") : t("adminConsole.showToilets")}
                    </Button>
                </Box>
                {open === "toilets" && <GroupToilets group={group} status={status} />}
                {open === "mapping" && group.rawValue !== null && (
                    <MappingForm
                        rawKey={group.rawValue}
                        onCancel={() => setOpen("none")}
                        onDone={(msg) => {
                            setOpen("none");
                            onMapped(msg);
                        }}
                    />
                )}
            </div>
        </div>
    );
}

function GroupToilets({ group, status }: { group: IssueGroup; status: IssueStatus }) {
    const { t } = useTranslation();
    const [limit, setLimit] = useState(20);
    const q = useQuery({
        queryKey: ["admin", "issues", group.fieldName, group.type, group.rawValue, status, limit],
        queryFn: () => fetchIssues({ field: group.fieldName, type: group.type, rawValue: group.rawValue ?? undefined, status, limit }),
        placeholderData: (prev) => prev,
    });
    if (q.isLoading) return <Loading />;
    if (q.error) return <AdminError error={q.error} fallback={t("adminConsole.loadFailed")} />;
    return (
        <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 1, p: 0 }}>
            {q.data?.items.map((i) => (
                <li key={i.id}>
                    <RouterLink to={`/admin/toilets/${i.toiletId}`} className="activity-row" style={{ paddingInline: 0 }}>
                        <span style={{ minWidth: 0 }}>
                            <span className="board-name">{i.toiletName}</span>
                            <span className="board-meta">
                                <span>#{i.toiletId}</span>
                                <span>{formatDateTime(i.createdAt)}</span>
                            </span>
                        </span>
                    </RouterLink>
                </li>
            ))}
            {q.data && q.data.items.length < q.data.total && (
                <li>
                    <button type="button" className="activity-more" onClick={() => setLimit((l) => l + 20)}>
                        {t("adminConsole.loadMore")}
                    </button>
                </li>
            )}
        </Box>
    );
}

/** "09:00-18:00" / "휴무" / "" → 요일별 항목. 형식이 틀리면 null. */
function parseRange(text: string, closedWord: string, days: ScheduleDayValue[]): ScheduleEntryInput[] | null {
    const s = text.trim();
    if (!s) return [];
    if (s === closedWord || s.toLowerCase() === "closed" || s === "휴무") return days.map((day) => ({ day, open: null, close: null, closed: true }));
    const m = /^(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    const open = Number(m[1]) * 60 + Number(m[2]);
    const close = Number(m[3]) * 60 + Number(m[4]);
    if (open > 1440 || close > 1440 || Number(m[2]) > 59 || Number(m[4]) > 59) return null;
    return days.map((day) => ({ day, open, close, closed: false }));
}

const DAY_GROUPS: { key: "mappingWeekdays" | "mappingSat" | "mappingSun" | "mappingHoliday"; days: ScheduleDayValue[] }[] = [
    { key: "mappingWeekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    { key: "mappingSat", days: ["Sat"] },
    { key: "mappingSun", days: ["Sun"] },
    { key: "mappingHoliday", days: ["Holiday"] },
];

/** 개방시간 매핑 등록: 판정을 고르고, 시간대면 월~금·토·일·공휴일 칸에 시간을 적는다. */
function MappingForm({ rawKey, onCancel, onDone }: { rawKey: string; onCancel: () => void; onDone: (message: string) => void }) {
    const { t } = useTranslation();
    const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatusValue>("Scheduled");
    const [ranges, setRanges] = useState<string[]>(["", "", "", ""]);
    const [formError, setFormError] = useState<string | null>(null);
    const mut = useMutation({
        mutationFn: createValueMapping,
        onSuccess: (r) => onDone(t("adminConsole.mappingDone", { issues: r.issuesChanged, toilets: r.affectedToilets })),
    });

    const submit = () => {
        setFormError(null);
        let entries: ScheduleEntryInput[] = [];
        if (scheduleStatus === "Scheduled") {
            for (let i = 0; i < DAY_GROUPS.length; i++) {
                const parsed = parseRange(ranges[i], t("adminConsole.closedWord"), DAY_GROUPS[i].days);
                if (parsed === null) {
                    setFormError(t("adminConsole.mappingInvalid"));
                    return;
                }
                entries = entries.concat(parsed);
            }
            if (!entries.some((e) => !e.closed)) {
                setFormError(t("adminConsole.mappingNeedOne"));
                return;
            }
        }
        mut.mutate({ fieldName: "opening_hours", rawKey, hours: { status: scheduleStatus, entries } });
    };

    return (
        <Stack spacing={1.5} sx={{ mt: 1.5, p: 1.5 }} className="plate">
            <span className="unit">{t("adminConsole.mappingTitle")}</span>
            <TextField select size="small" label={t("adminConsole.mappingStatus")} value={scheduleStatus} onChange={(e) => setScheduleStatus(e.target.value as ScheduleStatusValue)}>
                {SCHEDULE_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                        {labelOf(t, "schedule", s)}
                    </MenuItem>
                ))}
            </TextField>
            {scheduleStatus === "Scheduled" && (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        {DAY_GROUPS.map((g, i) => (
                            <TextField
                                key={g.key}
                                size="small"
                                label={t(`adminConsole.${g.key}`)}
                                placeholder="09:00-18:00"
                                value={ranges[i]}
                                onChange={(e) => setRanges((r) => r.map((v, j) => (j === i ? e.target.value : v)))}
                            />
                        ))}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {t("adminConsole.mappingRangeHint")}
                    </Typography>
                </>
            )}
            {formError && <Alert severity="warning">{formError}</Alert>}
            <AdminError error={mut.error} fallback={t("adminConsole.actionFailed")} />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                <Button variant="contained" disabled={mut.isPending} onClick={submit}>
                    {mut.isPending ? t("common.sending") : t("adminConsole.mappingSave")}
                </Button>
                <Button variant="outlined" disabled={mut.isPending} onClick={onCancel}>
                    {t("adminConsole.cancel")}
                </Button>
            </Box>
        </Stack>
    );
}

/** 저장된 매핑 값(JSON) → 한 줄 요약 */
function mappingSummary(t: Parameters<typeof labelOf>[0], m: ValueMappingView): string {
    try {
        const v = JSON.parse(m.canonicalJson) as { Status: string; Entries?: { Day: string; Open: number | null; Close: number | null; Closed: boolean }[] };
        const head = labelOf(t, "schedule", v.Status);
        if (!v.Entries?.length) return head;
        const days = v.Entries.map((e) => `${e.Day} ${e.Closed ? t("adminConsole.closedWord") : `${hhmm(e.Open)}-${hhmm(e.Close)}`}`);
        return `${head}: ${days.join(", ")}`;
    } catch {
        return m.canonicalJson;
    }
}

function MappingList({ onChanged }: { onChanged: (message: string) => void }) {
    const { t } = useTranslation();
    const q = useQuery({ queryKey: ["admin", "value-mappings"], queryFn: fetchValueMappings });
    const del = useMutation({
        mutationFn: deleteValueMapping,
        onSuccess: (r) => onChanged(t("adminConsole.mappingRemoved", { toilets: r.affectedToilets })),
    });
    return (
        <section className="board" aria-label={t("adminConsole.mappingsTitle")}>
            <div className="activity-head">
                <h2>{t("adminConsole.mappingsTitle")}</h2>
                {q.data && <span>{q.data.length}</span>}
            </div>
            {q.isLoading && <p className="board-empty">{t("common.loading")}</p>}
            {q.data?.length === 0 && <p className="board-empty">{t("adminConsole.mappingsEmpty")}</p>}
            <AdminError error={q.error ?? del.error} fallback={t("adminConsole.loadFailed")} />
            {q.data?.map((m) => (
                <div key={m.id} className="activity-row">
                    <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 800, overflowWrap: "anywhere" }}>{m.rawKey}</span>
                        <span className="board-meta">
                            <span>{mappingSummary(t, m)}</span>
                            <span>{formatDateTime(m.createdAt)}</span>
                        </span>
                    </span>
                    <Button size="small" variant="outlined" disabled={del.isPending} onClick={() => del.mutate(m.id)}>
                        {t("adminConsole.mappingRemove")}
                    </Button>
                </div>
            ))}
        </section>
    );
}

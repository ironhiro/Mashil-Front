import { Fragment, useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    decideRemovals,
    fetchAdminJobs,
    fetchImportRunReport,
    fetchImportRuns,
    startFetchImport,
    startRenormalize,
    uploadImportFile,
} from "../adminApi";
import type { AdminJob, ImportRun } from "../adminApi";
import { AdminError, AdminPage, Loading, durationSeconds, labelOf } from "../components/AdminParts";
import { formatDateTime } from "../i18n";

const STATE_CLASS: Record<string, string> = {
    Succeeded: "state--live",
    Skipped: "state--unknown",
    Running: "state--closed",
    Queued: "state--closed",
    PendingApproval: "state--soon",
    Busy: "state--soon",
    Rejected: "state--soon",
    Failed: "state--soon",
    Abandoned: "state--unknown",
};

/**
 * 임포트와 재정규화 (ADM-05, DATA-15·19·23).
 * 위: 세 가지 실행(파일 업로드, 지금 내려받기, 재정규화). 가운데: 이 서버에서 시킨 작업 (돌고 있으면 3초마다 갱신).
 * 아래: 실행 기록. 삭제 승인 대기 실행은 승인·거부, 행마다 새 이슈 리포트.
 */
export function AdminImportsPage() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [notice, setNotice] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [force, setForce] = useState(false);
    const [skipValidation, setSkipValidation] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const jobs = useQuery({
        queryKey: ["admin", "jobs"],
        queryFn: fetchAdminJobs,
        refetchInterval: (q) => (q.state.data?.some((j) => j.state === "Queued" || j.state === "Running") ? 3_000 : false),
    });
    const active = jobs.data?.some((j) => j.state === "Queued" || j.state === "Running") ?? false;
    const runs = useQuery({ queryKey: ["admin", "import-runs", 30], queryFn: () => fetchImportRuns(30), refetchInterval: active ? 5_000 : false });

    const started = (job: AdminJob) => {
        setNotice(t("adminConsole.queued", { label: job.label }));
        void qc.invalidateQueries({ queryKey: ["admin", "jobs"] });
        void qc.invalidateQueries({ queryKey: ["admin", "import-runs"] });
    };
    const upload = useMutation({ mutationFn: () => uploadImportFile(file!, { force, skipValidation }), onSuccess: started });
    const fetchNow = useMutation({ mutationFn: () => startFetchImport({ force, skipValidation }), onSuccess: started });
    const renorm = useMutation({ mutationFn: (onlyOutdated: boolean) => startRenormalize(onlyOutdated), onSuccess: started });
    const decide = useMutation({
        mutationFn: (args: { runId: number; approve: boolean }) => decideRemovals(args.runId, args.approve),
        onSuccess: (r, args) => {
            setNotice(t(args.approve ? "adminConsole.removalsApproved" : "adminConsole.removalsRejected", { n: r.count }));
            void qc.invalidateQueries({ queryKey: ["admin", "import-runs"] });
        },
    });
    const starting = upload.isPending || fetchNow.isPending || renorm.isPending;

    return (
        <AdminPage title={t("adminConsole.importsTitle")} intro={t("adminConsole.importsIntro")}>
            {notice && (
                <Alert severity="success" onClose={() => setNotice(null)}>
                    {notice}
                </Alert>
            )}
            <AdminError error={upload.error ?? fetchNow.error ?? renorm.error ?? decide.error} fallback={t("adminConsole.actionFailed")} />

            <section className="board" aria-label={t("adminConsole.uploadTitle")}>
                <div className="activity-head">
                    <h2>{t("adminConsole.uploadTitle")}</h2>
                </div>
                <Stack spacing={1.5} sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t("adminConsole.uploadHint")}
                    </Typography>
                    <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Button variant="outlined" onClick={() => fileInput.current?.click()}>
                            {t("adminConsole.chooseFile")}
                        </Button>
                        <span className="board-meta" style={{ marginTop: 0, overflowWrap: "anywhere" }}>
                            {file ? `${file.name} (${file.size.toLocaleString()} bytes)` : t("adminConsole.noFile")}
                        </span>
                    </Box>
                    <FormControlLabel control={<Checkbox checked={force} onChange={(e) => setForce(e.target.checked)} />} label={t("adminConsole.force")} />
                    <FormControlLabel
                        control={<Checkbox checked={skipValidation} onChange={(e) => setSkipValidation(e.target.checked)} />}
                        label={t("adminConsole.skipValidation")}
                    />
                    <Button variant="contained" disabled={!file || starting} onClick={() => upload.mutate()}>
                        {upload.isPending ? t("common.sending") : t("adminConsole.upload")}
                    </Button>
                </Stack>
                <div className="activity-head">
                    <h2>{t("adminConsole.fetchTitle")}</h2>
                </div>
                <Stack spacing={1.5} sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t("adminConsole.fetchHint")}
                    </Typography>
                    <Button variant="outlined" disabled={starting} onClick={() => fetchNow.mutate()}>
                        {t("adminConsole.fetch")}
                    </Button>
                </Stack>
                <div className="activity-head">
                    <h2>{t("adminConsole.renormTitle")}</h2>
                </div>
                <Stack spacing={1.5} sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t("adminConsole.renormHint")}
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        <Button variant="outlined" disabled={starting} onClick={() => renorm.mutate(true)}>
                            {t("adminConsole.renormOutdated")}
                        </Button>
                        <Button variant="outlined" disabled={starting} onClick={() => renorm.mutate(false)}>
                            {t("adminConsole.renormAll")}
                        </Button>
                    </Box>
                </Stack>
            </section>

            {jobs.data && jobs.data.length > 0 && (
                <section className="board" aria-label={t("adminConsole.jobsTitle")}>
                    <div className="activity-head">
                        <h2>{t("adminConsole.jobsTitle")}</h2>
                    </div>
                    {jobs.data.map((j) => (
                        <div key={j.id} className="activity-row">
                            <span style={{ minWidth: 0 }}>
                                <span className="board-name" title={j.label}>{j.label}</span>
                                <span className="board-meta">
                                    <span>{formatDateTime(j.createdAt)}</span>
                                    {j.runId !== null && <span>{t("adminConsole.jobRun", { id: j.runId })}</span>}
                                    {j.message && <span>{j.message}</span>}
                                </span>
                            </span>
                            <span className={`board-state state ${STATE_CLASS[j.state] ?? "state--unknown"}`}>{labelOf(t, "jobState", j.state)}</span>
                        </div>
                    ))}
                </section>
            )}

            <section className="board" aria-label={t("adminConsole.runsTitle")}>
                <div className="activity-head">
                    <h2>{t("adminConsole.runsTitle")}</h2>
                </div>
                {runs.isLoading && <Box sx={{ p: 2 }}><Loading /></Box>}
                <AdminError error={runs.error} fallback={t("adminConsole.loadFailed")} />
                {runs.data?.length === 0 && <p className="board-empty">{t("adminConsole.runsEmpty")}</p>}
                {runs.data?.map((r) => (
                    <RunRow key={r.id} run={r} deciding={decide.isPending} onDecide={(approve) => decide.mutate({ runId: r.id, approve })} />
                ))}
            </section>
        </AdminPage>
    );
}

function RunRow({ run, deciding, onDecide }: { run: ImportRun; deciding: boolean; onDecide: (approve: boolean) => void }) {
    const { t } = useTranslation();
    const [showReport, setShowReport] = useState(false);
    const took = durationSeconds(run.startedAt, run.finishedAt);
    const facts: [string, string][] = [
        [t("adminConsole.colStarted"), formatDateTime(run.startedAt)],
        [t("adminConsole.colFile"), run.fileName ?? ""],
        [t("adminConsole.colRows"), run.totalRows.toLocaleString()],
        [t("adminConsole.colInserted"), run.insertedRows.toLocaleString()],
        [t("adminConsole.colUpdated"), run.updatedRows.toLocaleString()],
        [t("adminConsole.colUnchanged"), run.unchangedRows.toLocaleString()],
        [t("adminConsole.colSkipped"), run.skippedRows.toLocaleString()],
        [t("adminConsole.colMissing"), run.missingRows.toLocaleString()],
        [t("adminConsole.colRestored"), run.restoredRows.toLocaleString()],
        [t("adminConsole.colRemoved"), t("adminConsole.removedOf", { removed: run.removedRows.toLocaleString(), candidates: run.removalCandidates.toLocaleString() })],
        [t("adminConsole.colNewIssues"), run.newIssues.toLocaleString()],
    ];
    if (took !== null) facts.push([t("adminConsole.colDuration"), t("adminConsole.seconds", { n: took })]);
    if (run.message) facts.push([t("adminConsole.colMessage"), run.message]);

    return (
        <article style={{ borderBottom: "var(--rule-bar) solid var(--color-ink)" }}>
            <div className="activity-row" style={{ borderBottom: 0 }}>
                <span style={{ minWidth: 0 }}>
                    <span className="board-name">
                        #{run.id} {labelOf(t, "trigger", run.trigger)}
                    </span>
                </span>
                <span className={`board-state state ${STATE_CLASS[run.status] ?? "state--unknown"}`}>{labelOf(t, "runStatus", run.status)}</span>
            </div>
            <Box sx={{ px: 2, pb: 1.5 }}>
                <dl className="facts">
                    {facts.map(([k, v]) => (
                        <Fragment key={k}>
                            <dt>{k}</dt>
                            <dd style={{ overflowWrap: "anywhere" }}>{v}</dd>
                        </Fragment>
                    ))}
                </dl>
                {run.status === "PendingApproval" && (
                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                        <Alert severity="warning">{t("adminConsole.pendingHint")}</Alert>
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                            <Button variant="contained" disabled={deciding} onClick={() => onDecide(true)}>
                                {t("adminConsole.approveRemovals")}
                            </Button>
                            <Button variant="outlined" disabled={deciding} onClick={() => onDecide(false)}>
                                {t("adminConsole.rejectRemovals")}
                            </Button>
                        </Box>
                    </Stack>
                )}
                {run.newIssues > 0 && (
                    <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => setShowReport((v) => !v)}>
                        {showReport ? t("adminConsole.hideToilets") : t("adminConsole.showReport")}
                    </Button>
                )}
                {showReport && <RunReport runId={run.id} />}
            </Box>
        </article>
    );
}

function RunReport({ runId }: { runId: number }) {
    const { t } = useTranslation();
    const q = useQuery({ queryKey: ["admin", "import-run", runId], queryFn: () => fetchImportRunReport(runId) });
    if (q.isLoading) return <Loading />;
    if (q.error) return <AdminError error={q.error} fallback={t("adminConsole.loadFailed")} />;
    if (!q.data?.newIssuesByType.length) return <p className="board-meta">{t("adminConsole.noNewIssues")}</p>;
    return (
        <dl className="facts" style={{ marginTop: "var(--space-xs)" }}>
            {q.data.newIssuesByType.map((x) => (
                <Fragment key={`${x.fieldName}|${x.type}|${x.status}`}>
                    <dt>{labelOf(t, "issueField", x.fieldName)}</dt>
                    <dd>
                        {labelOf(t, "issueType", x.type)} {x.count.toLocaleString()} ({labelOf(t, "issueStatus", x.status)})
                    </dd>
                </Fragment>
            ))}
        </dl>
    );
}

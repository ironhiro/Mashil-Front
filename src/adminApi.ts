/**
 * 관리자 화면 전용 API (docs/API.md 의 Admin 절). 공통 api.ts 와 같은 규칙:
 * 토큰을 붙이고, 401 이면 한 번 갱신해서 다시 보내고, 실패하면 응답 본문을 Error 메시지로 던진다 (friendlyError 가 읽음).
 * 파일 업로드(multipart)도 보내야 해서 따로 둔다.
 */
import { readAuthToken, refreshAccessToken } from "./auth/AuthContext";
import type { ChangeRequestRow } from "./api";

async function adminFetch<T>(path: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
    const send = (token: string | null) => {
        const headers: Record<string, string> = {};
        if (init.json !== undefined) headers["Content-Type"] = "application/json";
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(path, {
            method: init.method ?? "GET",
            headers,
            body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
        });
    };
    const sent = readAuthToken();
    let res = await send(sent);
    if (res.status === 401 && sent && readAuthToken()) {
        const fresh = await refreshAccessToken(sent);
        if (fresh) res = await send(fresh);
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

/** 서버가 `{ error, message }` 로 준 설명 (관리자에게는 그대로 보여 줘도 된다). */
export function adminErrorMessage(err: unknown): string | null {
    try {
        const body = JSON.parse((err as Error)?.message ?? "") as { message?: string };
        return typeof body.message === "string" ? body.message : null;
    } catch {
        return null;
    }
}

export interface Paged<T> {
    total: number;
    items: T[];
}

// ── 변경 요청 반영 결과 (ADM-01) ─────────────────────────────────────────

export interface ChangeRequestOutcome {
    changeRequestId: number;
    toiletId: number | null;
    createdToilet: boolean;
    markedRemoved: boolean;
    fields: string[];
    activeFields: string[];
}

export interface AdminChangeRequestRow extends ChangeRequestRow {
    applied: ChangeRequestOutcome | null;
}

export function fetchAdminChangeRequests(status?: string): Promise<AdminChangeRequestRow[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return adminFetch(`/api/admin/change-requests${qs}`);
}

// ── 댓글 신고 큐 (ADM-02) ─────────────────────────────────────────────

export type ReportStatus = "Open" | "Actioned" | "Dismissed";
export type ReportReason = "Spam" | "Abuse" | "False" | "Other";

export interface ReportQueueItem {
    commentId: number;
    toiletId: number;
    authorId: string;
    text: string;
    hidden: boolean;
    openReports: number;
    totalReports: number;
    reasons: Partial<Record<ReportReason, number>>;
    lastReportedAt: string;
    toiletName: string | null;
    authorName: string | null;
    details: string[] | null;
}

export function fetchCommentReports(status: ReportStatus): Promise<ReportQueueItem[]> {
    return adminFetch(`/api/admin/comment-reports?status=${status}`);
}

export function setCommentHidden(commentId: number, hidden: boolean): Promise<void> {
    return adminFetch(`/api/admin/comments/${commentId}`, { method: "PATCH", json: { hidden } });
}

// ── 정규화 이슈·매핑 사전 (ADM-03) ──────────────────────────────────────

export type IssueStatus = "Open" | "Resolved" | "Ignored";
export const ISSUE_STATUSES: IssueStatus[] = ["Open", "Resolved", "Ignored"];
export const ISSUE_FIELDS = ["opening_hours", "phone", "kind", "facilities", "data_reference_date", "geocode"] as const;
export type IssueField = (typeof ISSUE_FIELDS)[number];

export interface IssueGroup {
    fieldName: string;
    type: string;
    rawValue: string | null;
    count: number;
    note: string | null;
    sampleToiletId: number;
    firstSeenAt: string;
}

export interface IssueRow {
    id: number;
    toiletId: number;
    toiletName: string;
    fieldName: string;
    type: string;
    severity: string;
    rawValue: string | null;
    note: string | null;
    status: IssueStatus;
    resolvedByMappingId: number | null;
    createdAt: string;
    resolvedAt: string | null;
}

export interface IssueTypeCount {
    fieldName: string;
    type: string;
    status: IssueStatus;
    count: number;
}

function qs(params: Record<string, string | number | null | undefined>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : "";
}

export function fetchIssueGroups(f: { field?: string; type?: string; status: IssueStatus; offset?: number; limit?: number }): Promise<Paged<IssueGroup>> {
    return adminFetch(`/api/admin/issues/groups${qs(f)}`);
}

export function fetchIssues(f: { field?: string; type?: string; status?: IssueStatus; rawValue?: string; toiletId?: number; offset?: number; limit?: number }): Promise<Paged<IssueRow>> {
    return adminFetch(`/api/admin/issues${qs(f)}`);
}

export function fetchIssueCounts(): Promise<IssueTypeCount[]> {
    return adminFetch("/api/admin/issues/counts");
}

export function bulkSetIssues(body: {
    status: IssueStatus;
    ids?: number[];
    fieldName?: string;
    type?: string;
    rawValue?: string | null;
    fromStatus?: IssueStatus;
}): Promise<{ count: number }> {
    return adminFetch("/api/admin/issues/bulk", { method: "POST", json: body });
}

export type ScheduleStatusValue = "AlwaysOpen" | "Scheduled" | "NotOpen" | "Irregular" | "FollowsFacility" | "Unknown";
export type ScheduleDayValue = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" | "Holiday";

export interface ScheduleEntryInput {
    day: ScheduleDayValue;
    open: number | null;
    close: number | null;
    closed: boolean;
}

export interface ValueMappingView {
    id: number;
    fieldName: string;
    rawKey: string;
    canonicalJson: string;
    isActive: boolean;
    createdById: string | null;
    createdAt: string;
}

export interface MappingResponse {
    mapping: ValueMappingView;
    issuesChanged: number;
    affectedToilets: number;
    job: AdminJob | null;
}

export function fetchValueMappings(): Promise<ValueMappingView[]> {
    return adminFetch("/api/admin/value-mappings");
}

export function createValueMapping(body: { fieldName: string; rawKey: string; hours: { status: ScheduleStatusValue; entries: ScheduleEntryInput[] } }): Promise<MappingResponse> {
    return adminFetch("/api/admin/value-mappings", { method: "POST", json: body });
}

export function deleteValueMapping(id: number): Promise<MappingResponse> {
    return adminFetch(`/api/admin/value-mappings/${id}`, { method: "DELETE" });
}

// ── 임포트·재정규화·작업 (ADM-05) ──────────────────────────────────────

export type ImportRunStatus = "Running" | "Succeeded" | "Skipped" | "Rejected" | "Failed" | "Abandoned" | "PendingApproval";

export interface ImportRun {
    id: number;
    trigger: "Manual" | "Scheduled" | "Upload" | "Renormalize";
    status: ImportRunStatus;
    fileName: string | null;
    fileSizeBytes: number;
    detectedEncoding: string | null;
    normalizerVersion: string;
    totalRows: number;
    insertedRows: number;
    updatedRows: number;
    unchangedRows: number;
    skippedRows: number;
    missingRows: number;
    restoredRows: number;
    removalCandidates: number;
    removedRows: number;
    newIssues: number;
    message: string | null;
    startedAt: string;
    finishedAt: string | null;
    heartbeatAt: string | null;
}

export interface ImportRunReport {
    run: ImportRun;
    newIssuesByType: IssueTypeCount[];
}

export type AdminJobState = "Queued" | "Running" | "Succeeded" | "Failed" | "Busy";

export interface AdminJob {
    id: string;
    kind: "Upload" | "Fetch" | "Renormalize" | "MappingRenormalize";
    state: AdminJobState;
    label: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    runId: number | null;
    runStatus: ImportRunStatus | null;
    message: string | null;
    attempts: number;
}

export interface FieldRate {
    field: string;
    total: number;
    ok: number;
    rate: number;
    breakdown: Record<string, number>;
}

export interface NormalizationReport {
    toilets: number;
    fields: FieldRate[];
    topUnresolved: IssueGroup[];
    generatedAt: string;
}

export function fetchImportRuns(limit = 30): Promise<ImportRun[]> {
    return adminFetch(`/api/admin/import-runs?limit=${limit}`);
}

export function fetchImportRunReport(id: number): Promise<ImportRunReport> {
    return adminFetch(`/api/admin/import-runs/${id}`);
}

export function fetchAdminJobs(): Promise<AdminJob[]> {
    return adminFetch("/api/admin/jobs");
}

export function fetchNormalizationReport(): Promise<NormalizationReport> {
    return adminFetch("/api/admin/normalization/report");
}

export function uploadImportFile(file: File, opts: { force: boolean; skipValidation: boolean }): Promise<AdminJob> {
    const form = new FormData();
    form.append("file", file);
    if (opts.force) form.append("force", "true");
    if (opts.skipValidation) form.append("skipValidation", "true");
    return adminFetch("/api/admin/import-runs/upload", { method: "POST", form });
}

export function startFetchImport(opts: { force: boolean; skipValidation: boolean }): Promise<AdminJob> {
    return adminFetch("/api/admin/import-runs/fetch", { method: "POST", json: opts });
}

export function startRenormalize(onlyOutdated: boolean): Promise<AdminJob> {
    return adminFetch("/api/admin/import-runs/renormalize", { method: "POST", json: { onlyOutdated } });
}

export function decideRemovals(runId: number, approve: boolean): Promise<{ count: number }> {
    return adminFetch(`/api/admin/import-runs/${runId}/${approve ? "approve" : "reject"}-removals`, { method: "POST" });
}

// ── 화장실 직접 수정 (ADM-04) ─────────────────────────────────────────

export interface ToiletAdminValues {
    name: string | null;
    roadAddress: string | null;
    lotAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    openHours: string | null;
    openHoursDetail: string | null;
    status: string | null;
}

export interface OverrideHistoryRow {
    id: number;
    fieldName: string;
    valueJson: string;
    source: "ImportedCoordinate" | "Geocode" | "ChangeRequest" | "Admin";
    priority: number;
    isActive: boolean;
    changeRequestId: number | null;
    createdById: string | null;
    createdByName: string | null;
    createdAt: string;
}

export interface ToiletAdminView {
    id: number;
    managementNo: string;
    origin: "PublicData" | "UserSubmitted";
    status: "Active" | "Missing" | "Removed";
    coordinateSource: string;
    scheduleStatus: string;
    updatedAt: string;
    current: ToiletAdminValues;
    source: ToiletAdminValues | null;
    overrides: OverrideHistoryRow[];
    changeRequests: { id: number; kind: string; status: string; payloadJson: string; createdAt: string; reviewedAt: string | null; reviewNote: string | null }[];
    openIssues: number;
}

export interface AdminEditResult {
    toiletId: number;
    appliedFields: string[];
    clearedFields: string[];
    ignoredKeys: string[];
}

export function fetchToiletAdmin(id: number): Promise<ToiletAdminView> {
    return adminFetch(`/api/admin/toilets/${id}`);
}

export function saveToiletOverrides(id: number, body: Record<string, string | number | null>): Promise<AdminEditResult> {
    return adminFetch(`/api/admin/toilets/${id}/overrides`, { method: "POST", json: body });
}

export function deactivateOverride(id: number, overrideId: number): Promise<void> {
    return adminFetch(`/api/admin/toilets/${id}/overrides/${overrideId}`, { method: "DELETE" });
}

// ── 점검 모드 (ADM-06) ────────────────────────────────────────────────

export interface AppStatusSnapshot {
    maintenance: boolean;
    readOnly: boolean;
    message: string | null;
    until: string | null;
}

export interface AppStatusAdminView {
    effective: AppStatusSnapshot;
    stored: (AppStatusSnapshot & { updatedAt: string; updatedById: string | null }) | null;
    config: AppStatusSnapshot;
}

export function fetchAdminAppStatus(): Promise<AppStatusAdminView> {
    return adminFetch("/api/admin/app-status");
}

export function saveAdminAppStatus(body: AppStatusSnapshot): Promise<AppStatusAdminView> {
    return adminFetch("/api/admin/app-status", { method: "PUT", json: body });
}

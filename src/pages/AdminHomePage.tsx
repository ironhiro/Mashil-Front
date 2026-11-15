import { Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { fetchAdminAppStatus, fetchAdminChangeRequests, fetchCommentReports, fetchImportRuns, fetchIssueCounts } from "../adminApi";
import type { AppStatusSnapshot } from "../adminApi";
import { labelOf } from "../components/AdminParts";
import { formatDateTime } from "../i18n";

export function appStatusLabelKey(s: AppStatusSnapshot | undefined) {
    if (s?.maintenance) return "adminConsole.statusNow.maintenance" as const;
    if (s?.readOnly) return "adminConsole.statusNow.readOnly" as const;
    return "adminConsole.statusNow.normal" as const;
}

/**
 * 관리 첫 화면 (/admin): 다섯 구역으로 가는 안내판. 행마다 지금 처리할 것이 몇 건인지 같이 보여 준다.
 */
export function AdminHomePage() {
    const { t } = useTranslation();
    const pending = useQuery({ queryKey: ["admin", "change-requests", "Pending"], queryFn: () => fetchAdminChangeRequests("Pending") });
    const reports = useQuery({ queryKey: ["admin", "comment-reports", "Open"], queryFn: () => fetchCommentReports("Open") });
    const counts = useQuery({ queryKey: ["admin", "issue-counts"], queryFn: fetchIssueCounts });
    const runs = useQuery({ queryKey: ["admin", "import-runs", 1], queryFn: () => fetchImportRuns(1) });
    const status = useQuery({ queryKey: ["admin", "app-status"], queryFn: fetchAdminAppStatus });

    const openIssues = counts.data?.filter((c) => c.status === "Open").reduce((sum, c) => sum + c.count, 0);
    const last = runs.data?.[0];

    const rows = [
        { to: "/admin/change-requests", title: t("adminConsole.sections.changeRequests"), hint: pending.data && t("adminConsole.sections.changeRequestsHint", { n: pending.data.length }) },
        { to: "/admin/comments", title: t("adminConsole.sections.comments"), hint: reports.data && t("adminConsole.sections.commentsHint", { n: reports.data.length }) },
        { to: "/admin/issues", title: t("adminConsole.sections.issues"), hint: openIssues !== undefined && t("adminConsole.sections.issuesHint", { n: openIssues.toLocaleString() }) },
        {
            to: "/admin/imports",
            title: t("adminConsole.sections.imports"),
            hint: runs.data && (last
                ? t("adminConsole.sections.importsHint", { id: last.id, status: labelOf(t, "runStatus", last.status), time: formatDateTime(last.startedAt) })
                : t("adminConsole.sections.importsNone")),
        },
        { to: "/admin/status", title: t("adminConsole.sections.status"), hint: status.data && t(appStatusLabelKey(status.data.effective)) },
    ];

    return (
        <Stack spacing={2}>
            <Typography variant="h4" component="h1">
                {t("adminConsole.hubTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {t("adminConsole.hubIntro")}
            </Typography>
            <nav className="board" aria-label={t("adminConsole.hubTitle")}>
                {rows.map((r) => (
                    <RouterLink key={r.to} to={r.to} className="activity-row">
                        <span style={{ minWidth: 0 }}>
                            <span className="board-name">{r.title}</span>
                            {r.hint && (
                                <span className="board-meta">
                                    <span>{r.hint}</span>
                                </span>
                            )}
                        </span>
                    </RouterLink>
                ))}
            </nav>
        </Stack>
    );
}

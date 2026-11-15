import { useEffect, useState } from "react";
import { Alert, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchAdminAppStatus, saveAdminAppStatus } from "../adminApi";
import { AdminError, AdminPage, Loading } from "../components/AdminParts";
import { DoorGlyph } from "../components/Maintenance";
import { formatDateTime } from "../i18n";
import { appStatusLabelKey } from "./AdminHomePage";

type Mode = "normal" | "readOnly" | "maintenance";

/** ISO → datetime-local 입력값 (브라우저 시간대) */
function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 점검 모드 (ADM-06, OPS-05). 지금 상태를 문 글리프와 판으로, 아래에서 정상 / 읽기 전용 / 전체 점검을 고르고 문구와 다시 여는 시각을 적는다.
 * 서버 설정으로 켜진 플래그는 여기서 끌 수 없어 따로 알려 준다.
 */
export function AdminStatusPage() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const query = useQuery({ queryKey: ["admin", "app-status"], queryFn: fetchAdminAppStatus });
    const [mode, setMode] = useState<Mode>("normal");
    const [message, setMessage] = useState("");
    const [until, setUntil] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const s = query.data?.stored;
        if (!query.data) return;
        setMode(s?.maintenance ? "maintenance" : s?.readOnly ? "readOnly" : "normal");
        setMessage(s?.message ?? "");
        setUntil(toLocalInput(s?.until ?? null));
    }, [query.data]);

    const save = useMutation({
        mutationFn: () =>
            saveAdminAppStatus({
                maintenance: mode === "maintenance",
                readOnly: mode === "readOnly",
                message: message.trim() || null,
                until: until ? new Date(until).toISOString() : null,
            }),
        onSuccess: (r) => {
            qc.setQueryData(["admin", "app-status"], r);
            void qc.invalidateQueries({ queryKey: ["app-status"] }); // 이 화면의 띠·점검 화면도 바로
            setSaved(true);
        },
    });

    const eff = query.data?.effective;
    const forced = [
        query.data?.config.maintenance && t("adminConsole.statusNow.maintenance"),
        query.data?.config.readOnly && t("adminConsole.statusNow.readOnly"),
    ].filter(Boolean);

    return (
        <AdminPage title={t("adminConsole.statusTitle")} intro={t("adminConsole.statusIntro")}>
            {query.isLoading && <Loading />}
            <AdminError error={query.error} fallback={t("adminConsole.loadFailed")} />
            {eff && (
                <div className="plate" style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: "var(--space-md)" }}>
                    <DoorGlyph open={eff.maintenance ? 0 : eff.readOnly ? 0.45 : 1} size={56} />
                    <span>
                        <span className="figure" style={{ display: "block", fontSize: "var(--text-xl)" }}>{t(appStatusLabelKey(eff))}</span>
                        {eff.until && <span className="unit">{formatDateTime(eff.until)}</span>}
                        {query.data?.stored && (
                            <span className="unit" style={{ display: "block" }}>
                                {t("adminConsole.lastUpdated", { time: formatDateTime(query.data.stored.updatedAt) })}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {forced.length > 0 && <Alert severity="warning">{t("adminConsole.configForced", { what: forced.join(", ") })}</Alert>}

            {query.data && (
                <Stack spacing={1.5}>
                    <Typography variant="h6" component="h2">
                        {t("adminConsole.mode")}
                    </Typography>
                    <ToggleButtonGroup exclusive fullWidth value={mode} onChange={(_, v: Mode | null) => v && setMode(v)} aria-label={t("adminConsole.mode")}>
                        <ToggleButton value="normal">{t("adminConsole.statusNow.normal")}</ToggleButton>
                        <ToggleButton value="readOnly">{t("adminConsole.statusNow.readOnly")}</ToggleButton>
                        <ToggleButton value="maintenance">{t("adminConsole.statusNow.maintenance")}</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField size="small" label={t("adminConsole.message")} value={message} onChange={(e) => setMessage(e.target.value)} inputProps={{ maxLength: 500 }} />
                    <TextField
                        size="small"
                        type="datetime-local"
                        label={t("adminConsole.until")}
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    {saved && (
                        <Alert severity="success" onClose={() => setSaved(false)}>
                            {t("adminConsole.statusSaved")}
                        </Alert>
                    )}
                    <AdminError error={save.error} fallback={t("adminConsole.actionFailed")} />
                    <Button variant="contained" size="large" disabled={save.isPending} onClick={() => save.mutate()}>
                        {save.isPending ? t("common.sending") : t("adminConsole.saveStatus")}
                    </Button>
                </Stack>
            )}
        </AdminPage>
    );
}

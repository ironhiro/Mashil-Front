import { useQuery } from "@tanstack/react-query";
import { fetchAppStatus } from "../api";

/** 점검 상태 (GET /api/app/status). 1분마다 다시 확인 — 점검이 끝나면 저절로 돌아온다. */
export function useAppStatus() {
    return useQuery({
        queryKey: ["app-status"],
        queryFn: fetchAppStatus,
        refetchInterval: 60_000,
        staleTime: 30_000,
    });
}

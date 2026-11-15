import { ChangeRequestStatus } from "../lib/enums";

/**
 * 제보 상태 표: 안내판 상태 칸과 같은 모양을 빌린다 (색에만 기대지 않게 글자도 함께).
 * 반영됨 = 파랑 채움, 검토 중 = 잉크 테두리, 반영 안 됨 = 회색 종이.
 */
const STATE_CLASS: Record<ChangeRequestStatus, string> = {
    [ChangeRequestStatus.Approved]: "state--live",
    [ChangeRequestStatus.Pending]: "state--closed",
    [ChangeRequestStatus.Rejected]: "state--unknown",
};

export function ChangeRequestStatusTag({ status, label }: { status: ChangeRequestStatus; label: string }) {
    return <span className={`board-state state ${STATE_CLASS[status] ?? "state--unknown"}`}>{label}</span>;
}

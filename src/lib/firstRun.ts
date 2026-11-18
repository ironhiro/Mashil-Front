/**
 * 첫 실행 안내. 앱을 처음 켜면 메인 대신 로그인 화면(로그인 없이 둘러보기 포함)을 보여 주고,
 * 로그인하거나 "로그인 없이 둘러보기"를 고르면 그다음부터는 바로 메인으로 간다 (2026-11-18 결정).
 * 기기 저장소(웹뷰 localStorage)에 한 번 본 것만 적는다. 저장소를 못 쓰면 막지 않고 메인으로 간다.
 */
const KEY = "mashil_onboarded";

export function isOnboarded(): boolean {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        return true;
    }
}

export function markOnboarded(): void {
    try {
        localStorage.setItem(KEY, "1");
    } catch {
        /* 저장소를 못 쓰면 다음에도 한 번 더 보일 뿐 */
    }
}

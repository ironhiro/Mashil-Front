/**
 * Android 뒤로 가기 (Material 3): 열린 시트·대화상자·메뉴가 있으면 페이지를 넘기기 전에 그것부터 닫는다.
 *
 * 앱은 뒤로 가기를 받으면 먼저 `window.__mashilBack()` 을 부르고, true 면 거기서 멈춘다 (false 면 웹 history 뒤로).
 * MUI 의 모든 모달(Drawer·Dialog·Menu·Popover)은 Esc 로 닫히므로, 맨 위 모달에 Esc 를 보내 각자의 onClose 를 그대로 쓴다.
 * 바쁜 대화상자처럼 Esc 를 막아 둔 창도 "처리함"으로 본다 (그 뒤 페이지가 넘어가 버리지 않게).
 */
function closeTopModal(): boolean {
    const modals = document.querySelectorAll<HTMLElement>(".MuiModal-root:not(.MuiModal-hidden)");
    const top = modals[modals.length - 1];
    if (!top) return false;
    top.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    return true;
}

declare global {
    interface Window {
        __mashilBack?: () => boolean;
    }
}

export function installBackHandler() {
    window.__mashilBack = closeTopModal;
}

/**
 * 글자를 클립보드에 넣는다. 앱 안에서는 글자 선택을 꺼 두었으므로(inAppChrome) 주소·전화 복사는 이 함수로 한다.
 * Clipboard API 는 https(보안 컨텍스트)에서만 되므로, 개발 서버(http://10.0.2.2) 같은 곳에서는 숨긴 textarea 로 복사한다.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (window.isSecureContext && navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* 권한 거부 등: 아래 방법으로 */
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }
    ta.remove();
    return ok;
}

/**
 * 앱(Flutter 웹뷰) 안에서만 웹 페이지 티가 나는 동작을 끈다. 앱은 UA 끝에 "MashilApp/<버전>" 을 붙인다
 * (Mashil-App app/lib/shell/web_shell_screen.dart). 브라우저로 볼 때는 아무것도 바꾸지 않는다 (확대·복사는 접근성).
 * - CSS(app.css `html.in-app`): 텍스트 선택, 길게 누르기 메뉴(callout), 이미지 끌기, 탭 하이라이트, 더블탭 확대, 당겨서 새로고침
 * - 여기: 길게 누르기/우클릭 메뉴(contextmenu)와 끌기(dragstart). 입력 칸은 그대로 둔다 (붙여넣기·커서 이동).
 * 페이지 확대·개발자 도구·링크 미리보기·스와이프 이동은 앱의 웹뷰 설정에서 끈다.
 */
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export const IN_APP = /\bMashilApp\//.test(navigator.userAgent);

function isEditable(t: EventTarget | null): boolean {
    return t instanceof Element && t.closest(EDITABLE) !== null;
}

if (IN_APP) {
    document.documentElement.classList.add("in-app");
    document.addEventListener("contextmenu", (e) => {
        if (!isEditable(e.target)) e.preventDefault();
    });
    document.addEventListener("dragstart", (e) => {
        if (!isEditable(e.target)) e.preventDefault();
    });
}

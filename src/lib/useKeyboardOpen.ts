import { useEffect, useState } from "react";

/** 화면이 이만큼 이상 줄면 소프트 키보드가 올라온 것으로 본다 (주소창 크기 변화 같은 작은 흔들림은 무시) */
const KEYBOARD_MIN_PX = 150;

function isTextEntry(el: Element | null): boolean {
    if (!el) return false;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
        const nonText = ["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"];
        return !nonText.includes(el.type) && !el.readOnly && !el.disabled;
    }
    return (el as HTMLElement).isContentEditable === true;
}

/**
 * 소프트 키보드가 올라와 있는가 (Material 3: 입력 중에는 하단 탭을 숨겨 입력 칸에 자리를 준다).
 * 웹에는 키보드 신호가 없으므로 "글자 칸에 포커스" + "화면 높이가 평소보다 줄었음" 을 함께 본다.
 * 평소 높이는 폭(=방향)마다 본 가장 큰 높이. 하드웨어 키보드처럼 화면이 줄지 않으면 false.
 */
export function useKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const fullHeight = new Map<number, number>();
        const height = () => window.visualViewport?.height ?? window.innerHeight;
        const check = () => {
            const w = window.innerWidth;
            const h = height();
            const full = Math.max(fullHeight.get(w) ?? 0, h);
            fullHeight.set(w, full);
            setOpen(isTextEntry(document.activeElement) && full - h > KEYBOARD_MIN_PX);
        };
        check();
        const vv = window.visualViewport;
        window.addEventListener("resize", check);
        vv?.addEventListener("resize", check);
        // 포커스가 옮겨 간 직후에는 아직 높이가 그대로일 수 있어서, 크기 변화(resize)가 다시 확인한다
        document.addEventListener("focusin", check);
        document.addEventListener("focusout", check);
        return () => {
            window.removeEventListener("resize", check);
            vv?.removeEventListener("resize", check);
            document.removeEventListener("focusin", check);
            document.removeEventListener("focusout", check);
        };
    }, []);
    return open;
}

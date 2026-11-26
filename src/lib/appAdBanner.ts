import { useEffect } from "react";
import { callNative, isApp } from "./nativeBridge";

/**
 * 앱 하단 배너 광고 (Mashil-app docs/01 MON-01). 배너는 앱이 웹뷰 아래에 그리고, 웹은 보일 화면만 정한다:
 * **목록 보기·검색 결과**와 **화장실 상세** (내용이 있을 때). 지도 홈, 방향 안내, 약관, 점검 등에는 켜지 않는다.
 *
 * `visible` 이 true 인 동안 켜 두고, false 가 되거나 화면을 떠나면 끈다. 브라우저에서는 아무것도 하지 않는다.
 * 앱은 문서를 새로 불러오면 스스로 끄고, 배너가 보이는 동안 `--app-safe-bottom` 을 0 으로 바꾼다 (tokens.css).
 * 이 메서드가 없는 옛 앱은 unknownMethod 로 답하므로 그냥 무시한다.
 */
export function useAppAdBanner(visible: boolean): void {
    useEffect(() => {
        if (!visible || !isApp()) return;
        const set = (on: boolean) => callNative("setAdBanner", { visible: on }, 10_000).catch(() => undefined);
        void set(true);
        return () => void set(false);
    }, [visible]);
}

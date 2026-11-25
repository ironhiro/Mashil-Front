import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ACCOUNTS } from "./features";

/** 회원 기능을 숨겼을 때 관리자가 로그인 화면으로 가는 길: 홈 제목을 이만큼 연달아 누른다 */
export const ADMIN_TAPS = 7;

/**
 * 홈 제목에 붙이는 클릭 처리. 회원 기능이 켜져 있거나 이미 로그인했으면 아무것도 하지 않는다.
 * 화면에 보이는 단서는 두지 않는다 (일반 이용자가 볼 화면이 아님).
 */
export function useAdminTaps(signedIn: boolean) {
    const navigate = useNavigate();
    const [taps, setTaps] = useState(0);
    return () => {
        if (ACCOUNTS || signedIn) return;
        if (taps + 1 >= ADMIN_TAPS) {
            setTaps(0);
            navigate("/login");
        } else setTaps(taps + 1);
    };
}

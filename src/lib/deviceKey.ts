/**
 * 로그인 없이 매기는 별점의 주인 표시. 처음 쓸 때 만든 무작위 UUID 를 기기 저장소(웹뷰 localStorage)에 두고
 * 별점 요청에 X-Mashil-Device 헤더로 보낸다. 서버는 해시만 저장한다 (백엔드 Auth/DeviceKey.cs).
 * 기기 고유 ID나 광고 ID가 아니다. 앱을 지우거나 저장소를 비우면 새 키가 된다 (전에 매긴 별점은 남지만 고칠 수 없다).
 */
const KEY = "mashil_device_key";
export const DEVICE_KEY_HEADER = "X-Mashil-Device";

let memo: string | null = null;

function newUuid(): string {
    // randomUUID 는 보안 출처(https)에서만 있다. 개발 서버(http://10.0.2.2)에서는 getRandomValues 로 만든다
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // 버전 4
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 변형
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function deviceKey(): string {
    if (memo) return memo;
    try {
        const saved = localStorage.getItem(KEY);
        if (saved) return (memo = saved);
        memo = newUuid();
        localStorage.setItem(KEY, memo);
    } catch {
        // 저장소를 못 쓰면 이 화면을 여는 동안만 같은 키
        memo ??= newUuid();
    }
    return memo;
}

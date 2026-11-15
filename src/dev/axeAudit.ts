/**
 * 개발 서버 전용 접근성 검사. 화면이 바뀌고 잠시 멈추면 axe-core 로 현재 문서를 검사해 콘솔에 위반을 적는다.
 * (@axe-core/react 는 React 18 이후를 지원하지 않아 axe-core 를 직접 쓴다.) 운영 빌드에는 들어가지 않는다 — main.tsx 가
 * import.meta.env.DEV 일 때만 불러온다.
 */
import axe from "axe-core";

let timer: number | undefined;
let running = false;
const seen = new Set<string>();

async function audit() {
    if (running) return;
    running = true;
    try {
        const { violations } = await axe.run(document, { resultTypes: ["violations"] });
        for (const v of violations) {
            const key = `${location.pathname}|${v.id}|${v.nodes.map((n) => n.target.join(" ")).join(",")}`;
            if (seen.has(key)) continue;
            seen.add(key);
            console.warn(`[axe] ${v.impact ?? ""} ${v.id}: ${v.help}\n${v.helpUrl}`, v.nodes.map((n) => n.target.join(" ")));
        }
    } finally {
        running = false;
    }
}

export function startAxeAudit() {
    const schedule = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void audit(), 1500);
    };
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true });
    schedule();
}

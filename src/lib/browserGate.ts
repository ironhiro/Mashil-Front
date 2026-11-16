import { IN_APP } from "./inAppChrome";

/**
 * 마실은 앱 전용이다 (USR-04 결정, 2026-11-17): 브라우저로 들어오면 어느 주소든 앱 설치 안내만 보여 준다.
 * 공유 링크(/toilets/{id})를 받은 사람도 마찬가지.
 *
 * 앱 판별: 앱 웹뷰는 UA 끝에 "MashilApp/<버전>" 을 붙이고 MashilBridge 채널을 넣는다 (둘 중 하나면 앱).
 * 이 판별은 화면을 고르는 것일 뿐 보안 경계가 아니다 — API 는 따로 인증·권한으로 지킨다.
 *
 * VITE_BROWSER_GATE: on / off. 기본은 운영 빌드에서 on, 개발 서버에서 off (로컬 개발·QA 는 브라우저로 한다).
 */
const setting = import.meta.env.VITE_BROWSER_GATE ?? (import.meta.env.PROD ? "on" : "off");
const hasBridge = typeof (window as { MashilBridge?: { postMessage?: unknown } }).MashilBridge?.postMessage === "function";

export const BROWSER_BLOCKED = setting === "on" && !IN_APP && !hasBridge;

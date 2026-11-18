import { IN_APP } from "./inAppChrome";

/**
 * 마실은 앱 전용이다 (USR-04 결정, 2026-11-17): 브라우저로 들어오면 어느 주소든 앱 설치 안내만 보여 준다.
 * 공유 링크(/toilets/{id})를 받은 사람도 마찬가지.
 *
 * 앱 판별: 앱 웹뷰는 UA 끝에 "MashilApp/<버전>" 을 붙이고 MashilBridge 채널을 넣는다 (둘 중 하나면 앱).
 * 이 판별은 화면을 고르는 것일 뿐 보안 경계가 아니다 — API 는 따로 인증·권한으로 지킨다.
 *
 * VITE_BROWSER_GATE: on / off. 기본은 운영 빌드에서 on, 개발 서버에서 off (로컬 개발·QA 는 브라우저로 한다).
 *
 * 개발 서버(toilets-dev)는 빌드가 on 이어도 브라우저로 연다 — 같은 빌드가 그대로 운영으로 승격되므로
 * (docs/RELEASE.md) 빌드 설정으로는 나눌 수 없고 접속한 호스트로 정한다.
 * 호스트 목록은 VITE_BROWSER_OPEN_HOSTS (쉼표 구분)로 바꿀 수 있다.
 */
const setting = import.meta.env.VITE_BROWSER_GATE ?? (import.meta.env.PROD ? "on" : "off");
const hasBridge = typeof (window as { MashilBridge?: { postMessage?: unknown } }).MashilBridge?.postMessage === "function";

const OPEN_HOSTS = (import.meta.env.VITE_BROWSER_OPEN_HOSTS ?? "toilets-dev.ironhiro.dev")
    .split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

/** 브라우저로도 여는 호스트인지 (개발 서버). */
export const OPEN_IN_BROWSER = OPEN_HOSTS.includes(window.location.hostname.toLowerCase());

/**
 * 약관·개인정보처리방침은 브라우저로도 연다. 스토어 심사와 이용자가 앱 없이도 읽을 수 있어야 한다
 * (Google Play: 개인정보처리방침은 누구나 볼 수 있는 웹 주소여야 함). main.tsx 가 이 주소에서는 약관 화면만 그린다.
 */
export const PUBLIC_TERMS_PATH = /^\/terms\/(Terms|Privacy|LocationTerms)\/?$/;

export const BROWSER_BLOCKED = setting === "on" && !IN_APP && !hasBridge && !OPEN_IN_BROWSER;

/** 브라우저로 약관 주소에 들어왔을 때: 앱 설치 안내 대신 약관만 보여 준다 */
export const BROWSER_TERMS = BROWSER_BLOCKED && PUBLIC_TERMS_PATH.test(window.location.pathname);

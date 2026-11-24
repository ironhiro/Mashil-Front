/**
 * 회원 기능 (로그인·가입, 댓글, 제보, 내 활동, 신고·차단). 출시 때는 숨기고 별점만 둔다 (2026-11-24 결정).
 * 별점은 이 값과 상관없이 누구나 매긴다 (로그인하지 않았으면 기기 키, lib/deviceKey.ts).
 * 숨겨도 /login 은 열려 있다: 관리자가 내 정보 제목을 일곱 번 눌러 들어간다 (MePage).
 * 다시 켜려면 VITE_ACCOUNTS=on. 화면만 숨기는 값이라 서버 쪽 회원 API 는 그대로다.
 */
export const ACCOUNTS = import.meta.env.VITE_ACCOUNTS === "on";

/**
 * 닉네임 구분 번호. 닉네임은 중복을 허용하고, 댓글 등에는 "이름#1234" 로 보인다 (2026-11-18 결정).
 * 번호는 회원 ID 에서 정해진다: 하이픈을 뺀 ID 앞 8자리(16진수)를 정수로 읽어 10000 으로 나눈 나머지, 네 자리.
 * 서버 `CommentAuthor.Tag` (Mashil.Api/Endpoints/ModerationEndpoints.cs) 와 같은 식이어야 한다.
 */
export function userTag(userId: string): string {
    const n = parseInt(userId.replace(/-/g, "").slice(0, 8), 16);
    return Number.isFinite(n) ? String(n % 10000).padStart(4, "0") : "0000";
}

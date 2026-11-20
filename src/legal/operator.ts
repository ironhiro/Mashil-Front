/**
 * 약관·방침에 들어가는 운영자 정보. 빌드할 때 환경 변수로 넣을 수 있고, 없으면 아래 기본값을 쓴다.
 * 운영자 이름과 시행일은 공개되는 고정 값이라 기본값으로 둔다 (2026-11-18 결정: 운영자 "마실", 시행일 2026-12-01).
 *
 *   VITE_OPERATOR_NAME        운영자(개인이면 이름, 사업자면 상호)
 *   VITE_PRIVACY_OFFICER      개인정보 보호책임자 이름
 *   VITE_CONTACT_EMAIL        문의·권리 행사 이메일
 *   VITE_LEGAL_EFFECTIVE_DATE 시행일 (문장에 그대로 들어간다: "…부터 시행합니다")
 *
 * 하나라도 비어 있으면 문서 위에 "초안" 안내가 뜬다. 출시 전에 채우고, 법률 검토를 받은 뒤 내보낸다.
 */
// 환경 변수는 이름을 바로 붙여 읽는다. 객체째나 env[key] 처럼 읽으면 빌드 때 있던 VITE_ 변수가 전부 번들에 들어간다 (tool/check-env.mjs)
function value(raw: string | undefined, placeholder: string, fallback?: string): { text: string; missing: boolean } {
    const v = raw?.trim() || fallback;
    return v ? { text: v, missing: false } : { text: placeholder, missing: true };
}

const name = value(import.meta.env.VITE_OPERATOR_NAME, "[운영자]", "마실");
const officer = value(import.meta.env.VITE_PRIVACY_OFFICER, "[보호책임자 이름]");
const email = value(import.meta.env.VITE_CONTACT_EMAIL, "[문의 이메일]");
const effective = value(import.meta.env.VITE_LEGAL_EFFECTIVE_DATE, "[시행일]", "2026년 12월 1일");

export const OPERATOR = {
    name: name.text,
    privacyOfficer: officer.text,
    contactEmail: email.text,
    effectiveDate: effective.text,
    /** 운영자 정보가 아직 다 채워지지 않음 → 초안으로 표시 */
    isDraft: name.missing || officer.missing || email.missing || effective.missing,
};

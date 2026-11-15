/**
 * 약관·방침에 들어가는 운영자 정보. 빌드할 때 환경 변수로 넣는다 (.env.production 등, 저장소에는 넣지 않아도 된다).
 *
 *   VITE_OPERATOR_NAME        운영자(개인이면 이름, 사업자면 상호)
 *   VITE_PRIVACY_OFFICER      개인정보 보호책임자 이름
 *   VITE_CONTACT_EMAIL        문의·권리 행사 이메일
 *   VITE_LEGAL_EFFECTIVE_DATE 시행일 (YYYY-MM-DD)
 *
 * 하나라도 비어 있으면 문서 위에 "초안" 안내가 뜬다. 출시 전에 채우고, 법률 검토를 받은 뒤 내보낸다.
 */
const env = import.meta.env as Record<string, string | undefined>;

function value(key: string, placeholder: string): { text: string; missing: boolean } {
    const v = env[key]?.trim();
    return v ? { text: v, missing: false } : { text: placeholder, missing: true };
}

const name = value("VITE_OPERATOR_NAME", "[운영자]");
const officer = value("VITE_PRIVACY_OFFICER", "[보호책임자 이름]");
const email = value("VITE_CONTACT_EMAIL", "[문의 이메일]");
const effective = value("VITE_LEGAL_EFFECTIVE_DATE", "[시행일]");

export const OPERATOR = {
    name: name.text,
    privacyOfficer: officer.text,
    contactEmail: email.text,
    effectiveDate: effective.text,
    /** 운영자 정보가 아직 다 채워지지 않음 → 초안으로 표시 */
    isDraft: name.missing || officer.missing || email.missing || effective.missing,
};

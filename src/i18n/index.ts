/**
 * i18n 설정 (i18next + react-i18next).
 *
 * 언어 결정 순서: 주소의 `?lang=en` → 사용자가 고른 언어(localStorage) → 브라우저·기기 언어 → 한국어.
 * 앱 웹뷰는 기기 언어를 navigator.language 로 넘겨주므로 따로 브리지가 필요 없다.
 *
 * 새 언어 추가: locales/<code>.ts 를 만들고 (타입 `Messages`), 아래 resources·SUPPORTED_LANGUAGES 에 넣는다.
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { ko } from "./locales/ko";

export const SUPPORTED_LANGUAGES = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "ko";
const STORAGE_KEY = "mashil_lang";

void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            ko: { translation: ko },
            en: { translation: en },
        },
        supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
        nonExplicitSupportedLngs: true, // en-US → en, ko-KR → ko
        load: "languageOnly",
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false }, // React 가 이스케이프
        detection: {
            order: ["querystring", "localStorage", "navigator"],
            lookupQuerystring: "lang",
            lookupLocalStorage: STORAGE_KEY,
            caches: ["localStorage"],
        },
    });

function applyDocumentLanguage(lng: string) {
    document.documentElement.lang = lng;
    document.title = i18n.t("app.title");
}
applyDocumentLanguage(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE);
i18n.on("languageChanged", (lng) => applyDocumentLanguage(i18n.resolvedLanguage ?? lng));

/** 지금 화면 언어 (지원 언어 중 하나). */
export function currentLanguage(): LanguageCode {
    const l = i18n.resolvedLanguage;
    return SUPPORTED_LANGUAGES.some((s) => s.code === l) ? (l as LanguageCode) : DEFAULT_LANGUAGE;
}

/** 거리 표시: 1 km 미만은 m, 이상은 km (소수 1자리). */
export function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** 24시간 이내·1주 이내는 "3분 전" 같은 상대 시간, 그보다 오래면 날짜·시각. */
export function formatRelativeOrDate(iso: string, now: number = Date.now()): string {
    const lng = currentLanguage();
    const dt = new Date(iso);
    const diffMin = Math.floor((now - dt.getTime()) / 60_000);
    const rtf = new Intl.RelativeTimeFormat(lng, { numeric: "auto" });
    if (diffMin < 1) return rtf.format(0, "second");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, "hour");
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return rtf.format(-diffDay, "day");
    return formatDateTime(iso);
}

/** 브라우저 시간대 기준 날짜·시각 (언어별 형식). */
export function formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default i18n;

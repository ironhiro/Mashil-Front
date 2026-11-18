/**
 * i18n 설정 (i18next + react-i18next).
 *
 * 언어 결정 순서: 주소의 `?lang=en` (개발·확인용) → 기기 언어 → 한국어. 앱 안에 언어 고르기는 두지 않는다 (2026-11-18):
 * 기기 언어를 따르고, 이 앱만 다른 언어로 쓰려면 기기의 앱별 언어 설정(Android 13+, iOS)을 쓴다.
 * 앱 웹뷰는 기기(또는 앱별) 언어를 navigator.language 로 넘겨주므로 따로 브리지가 필요 없다.
 * 저장하지 않는다: 기기 언어를 바꾸면 다음 실행부터 바로 따른다.
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
/** 예전에 앱 안에서 고른 언어를 저장하던 키. 이제 쓰지 않으므로 지운다 (남아 있으면 기기 언어를 가린다) */
const LEGACY_STORAGE_KEY = "mashil_lang";
try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch {
    // 저장소를 못 쓰는 환경: 지울 것도 없다
}

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
            order: ["querystring", "navigator"],
            lookupQuerystring: "lang",
            caches: [],
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

/**
 * 거리 표시: 1 km 미만은 m, 이상은 km (소수 1자리).
 * compact: 숫자와 단위를 붙임 ("120m") — DM Mono 처럼 공백이 넓은 고정폭 서체에 쓴다.
 */
export function formatDistance(meters: number, compact = false): string {
    const sep = compact ? "" : " ";
    if (meters < 1000) return `${Math.round(meters)}${sep}m`;
    const km = meters / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)}${sep}km`;
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

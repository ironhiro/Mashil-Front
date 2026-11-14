import "i18next";
import type { Messages } from "./locales/ko";

// t("...") 키를 타입 검사 — 없는 키를 쓰면 컴파일 오류.
declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translation";
        resources: { translation: Messages };
    }
}

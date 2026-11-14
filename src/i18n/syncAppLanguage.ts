/**
 * 웹 언어 → 앱 언어 동기화. 페이지를 열 때와 언어를 바꿀 때마다 앱(브리지 setLanguage)에 알린다.
 * i18n/index.ts 와 nativeBridge.ts 가 서로를 import 하지 않도록 따로 둔다 (main.tsx 에서 한 번 import).
 */
import i18n, { currentLanguage } from ".";
import { setAppLanguage } from "../lib/nativeBridge";

void setAppLanguage(currentLanguage());
i18n.on("languageChanged", () => void setAppLanguage(currentLanguage()));

/**
 * 화장실 공유: 카카오톡 (위치 카드), 다른 앱 (시스템 공유 창), 링크 복사.
 * 앱에서는 브리지(share)로 네이티브 SDK·공유 창을 쓰고, 브라우저에서는 Kakao JS SDK 와 Web Share API 를 쓴다.
 * 받는 사람은 웹 페이지(/toilets/:id)로 연다. 설치된 앱으로 바로 여는 딥 링크는 운영 도메인이 생긴 뒤에.
 */
import i18n from "../i18n";
import { UserFacingError } from "./friendlyError";
import { callNative, isApp } from "./nativeBridge";
import { loadKakaoSdk } from "./kakaoSdk";
import type { KakaoShareTemplate } from "./kakaoSdk";

export interface SharePayload {
    title: string;
    url: string;
    description?: string;
    /** 있으면 카카오톡 카드에 "위치 보기"(카카오맵) 버튼이 붙는다 */
    address?: string;
}

export type ShareTarget = "kakao" | "system";

/**
 * 공유 링크의 바탕 주소. 운영은 VITE_PUBLIC_WEB_URL (예: https://mashil.kr), 없으면 지금 페이지의 주소.
 * 카카오톡 카드의 링크가 열리려면 이 도메인이 카카오 콘솔의 웹 플랫폼 도메인에 등록돼 있어야 한다.
 */
export function publicUrl(path: string): string {
    const base = import.meta.env.VITE_PUBLIC_WEB_URL || window.location.origin;
    return new URL(path, base).toString();
}

export const toiletShareUrl = (toiletId: number) => publicUrl(`/toilets/${toiletId}`);

/** 시스템 공유 창을 띄울 수 있는지 (앱은 늘, 브라우저는 Web Share API 가 있을 때). */
export function canSystemShare(): boolean {
    return isApp() || typeof navigator.share === "function";
}

/**
 * 공유한다. "done" = 넘겼다, "dismissed" = 사용자가 공유 창을 닫았다,
 * "unsupported" = 공유를 모르는 예전 앱 (부르는 쪽이 링크 복사로 대신한다).
 */
export async function share(target: ShareTarget, p: SharePayload): Promise<"done" | "dismissed" | "unsupported"> {
    const buttonTitle = i18n.t("share.openInMashil");
    if (isApp()) {
        const r = await callNative("share", { target, buttonTitle, ...p }, 60_000);
        if (r.ok) return "done";
        if (r.reason === "dismissed") return "dismissed";
        if (r.reason === "unknownMethod") return "unsupported";
        console.warn("[mashil] share failed:", r.reason, r.detail);
        throw new UserFacingError(i18n.t("share.failed"));
    }

    if (target === "system") {
        if (typeof navigator.share !== "function") return "unsupported";
        try {
            await navigator.share({ title: p.title, text: p.description, url: p.url });
            return "done";
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return "dismissed";
            throw new UserFacingError(i18n.t("share.failed"));
        }
    }

    let kakao;
    try {
        kakao = await loadKakaoSdk();
    } catch (e) {
        console.warn("[mashil] Kakao SDK", e);
        throw new UserFacingError(i18n.t("share.failed"));
    }
    const link = { webUrl: p.url, mobileWebUrl: p.url };
    const content = { title: p.title, description: p.description, link };
    const template: KakaoShareTemplate = p.address
        ? { objectType: "location", address: p.address, addressTitle: p.title, content, buttonTitle }
        : { objectType: "feed", content, buttons: [{ title: buttonTitle, link }] };
    kakao.Share.sendDefault(template);
    return "done";
}

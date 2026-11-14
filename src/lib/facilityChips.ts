import type { TFunction } from "i18next";
import type { ToiletNear } from "../api";

/**
 * 화장실 시설 칩 라벨.
 * - detailed: 선택 카드용 (남자 칸·소변기 따로)
 * - compact: 목록용 (남자 합계)
 */
export function facilityChipLabels(t: TFunction, toilet: ToiletNear, mode: "detailed" | "compact"): string[] {
    const out: string[] = [];
    if (mode === "detailed") {
        if (toilet.maleStallCount > 0) out.push(t("facility.menStalls", { count: toilet.maleStallCount }));
        if (toilet.maleUrinalCount > 0) out.push(t("facility.menUrinals", { count: toilet.maleUrinalCount }));
        if (toilet.femaleStallCount > 0) out.push(t("facility.womenStalls", { count: toilet.femaleStallCount }));
    } else {
        const men = toilet.maleStallCount + toilet.maleUrinalCount;
        if (men > 0) out.push(t("facility.men", { count: men }));
        if (toilet.femaleStallCount > 0) out.push(t("facility.women", { count: toilet.femaleStallCount }));
    }
    const accessible =
        toilet.maleAccessibleStallCount + toilet.maleAccessibleUrinalCount + toilet.femaleAccessibleStallCount;
    if (accessible > 0) out.push(t("facility.accessible", { count: accessible }));
    const child = toilet.maleChildStallCount + toilet.maleChildUrinalCount + toilet.femaleChildStallCount;
    if (child > 0) out.push(t("facility.child", { count: child }));
    return out;
}

/** 서버 값(한국어)인 화장실 종류를 현재 언어로. 모르는 값은 원문. */
export function toiletKindLabel(t: TFunction, kind: string): string {
    return t(`toiletKind.${kind}` as "toiletKind.기타", { defaultValue: kind });
}

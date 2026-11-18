import { Box, ButtonBase, SwipeableDrawer } from "@mui/material";
import { useTranslation } from "react-i18next";

const IOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * 아래에서 올라오는 시트 (Material 3 bottom sheet, HIG sheet).
 * - 위쪽 손잡이: 끌어내리면 닫히고, 누르면 닫힌다 (손잡이 자체가 48px 터치 영역)
 * - 넓은 화면(태블릿·가로)에서는 640px 로 가운데에 둔다
 * - 화면보다 길면 안쪽이 스크롤된다. 아래 안전 여백(제스처 막대·홈 인디케이터)은 내용 쪽이 비운다: `sheetBottomPad`
 * - Android 뒤로 가기는 backHandler 가 맨 위 창부터 닫는다
 */
export function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <SwipeableDrawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            onOpen={() => {}}
            disableSwipeToOpen
            disableDiscovery={IOS}
            disableBackdropTransition={!IOS}
            slotProps={{
                paper: {
                    sx: { maxWidth: 640, mx: "auto", maxHeight: "calc(100% - 48px)", display: "flex", flexDirection: "column" },
                },
            }}
        >
            <ButtonBase
                onClick={onClose}
                aria-label={t("common.close")}
                sx={{
                    flexShrink: 0,
                    alignSelf: "center",
                    width: 64,
                    height: 40,
                    "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: -2 },
                }}
            >
                <Box aria-hidden sx={{ width: 32, height: 4, bgcolor: "var(--color-ink)", opacity: 0.6 }} />
            </ButtonBase>
            <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>{children}</Box>
        </SwipeableDrawer>
    );
}

/** 시트 내용의 아래 여백: 16px + 기기 안전 영역 */
export const sheetBottomPad = "calc(16px + env(safe-area-inset-bottom))";

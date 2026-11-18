import { Box, IconButton, Link, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { LEGAL_DOCS } from "../legal/documents";
import type { LegalDocType } from "../legal/documents";

// 본문이 있는 문서만 (만 14세 확인은 체크 항목이라 문서가 없다)
const DOCS: LegalDocType[] = ["Terms", "Privacy", "LocationTerms"];

/** 데이터 출처. 이름과 라이선스는 원문 그대로 둔다 (출처 표시가 이용 조건: ODbL, 공공누리 제1유형) */
type SourceKey = "toilets" | "osm" | "seoulWalk" | "kakao" | "vworld";
const SOURCES: { key: SourceKey; name: string; href: string; license?: { label: string; href: string } }[] = [
    { key: "toilets", name: "행정안전부 LOCALDATA 공중화장실 정보 (공공데이터포털)", href: "https://www.data.go.kr" },
    {
        key: "osm",
        name: "© OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright",
        license: { label: "ODbL 1.0", href: "https://opendatacommons.org/licenses/odbl/1-0/" },
    },
    {
        key: "seoulWalk",
        name: "서울특별시 도보 네트워크 공간정보 (서울 열린데이터광장)",
        href: "https://data.seoul.go.kr",
        license: { label: "공공누리 제1유형", href: "https://www.kogl.or.kr/info/licenseType1.do" },
    },
    { key: "kakao", name: "카카오맵 · 카카오 로컬 API", href: "https://map.kakao.com" },
    { key: "vworld", name: "브이월드 (국토교통부)", href: "https://www.vworld.kr" },
];

const FONTS: { name: string; license: string; href: string }[] = [
    { name: "서울남산체 (서울특별시)", license: "서울서체 이용 안내", href: "https://www.seoul.go.kr/seoul/font.do" },
    { name: "Overpass", license: "SIL Open Font License 1.1", href: "https://openfontlicense.org" },
];

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * 약관·출처 (내 정보 맨 아래에서). 약관 세 문서와, 지도·길 안내에 쓰는 데이터의 출처·라이선스.
 * OSM(ODbL)과 서울시 도보 네트워크(공공누리 제1유형)는 출처 표시가 이용 조건이라, 경로 화면 밖에서도 늘 볼 수 있게 둔다.
 * 바깥 링크는 앱 안에서는 외부 브라우저로 열린다 (앱 셸의 NavigationPolicy).
 */
export function AboutPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/me"));
    return (
        <Stack spacing={3} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
            <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton aria-label={t("detail.back")} onClick={goBack} sx={{ width: 44, height: 44, ml: -1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h4" component="h1">
                    {t("about.title")}
                </Typography>
            </Stack>

            <Box component="section">
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {t("about.legal")}
                </Typography>
                <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                    {DOCS.map((d) => (
                        <li key={d}>
                            <Link component={RouterLink} to={`/terms/${d}`} color="secondary" lang="ko" sx={{ display: "inline-block", py: 1.25, fontWeight: 600 }}>
                                {LEGAL_DOCS[d].title}
                            </Link>
                        </li>
                    ))}
                </Box>
            </Box>

            <Box component="section">
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {t("about.data")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {t("about.dataNote")}
                </Typography>
                <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: "none" }}>
                    {SOURCES.map((s) => (
                        <li key={s.key}>
                            <Typography variant="body2" color="text.secondary">
                                {t(`about.sources.${s.key}`)}
                            </Typography>
                            <Typography variant="body2" lang="ko" sx={{ fontWeight: 600 }}>
                                <Link href={s.href} {...external} color="inherit">
                                    {s.name}
                                </Link>
                                {s.license && (
                                    <>
                                        {" · "}
                                        <Link href={s.license.href} {...external} color="secondary">
                                            {s.license.label}
                                        </Link>
                                    </>
                                )}
                            </Typography>
                        </li>
                    ))}
                </Stack>
            </Box>

            <Box component="section">
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {t("about.fonts")}
                </Typography>
                <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: "none" }}>
                    {FONTS.map((f) => (
                        <Typography component="li" variant="body2" key={f.name}>
                            <span lang="ko">{f.name}</span>
                            {" · "}
                            <Link href={f.href} {...external} color="secondary">
                                {f.license}
                            </Link>
                        </Typography>
                    ))}
                </Stack>
            </Box>
        </Stack>
    );
}

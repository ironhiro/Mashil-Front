import { memo, useEffect, useState } from "react";
import { InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";

/** 검색어로 칠 최소 글자 수 */
const MIN_LENGTH = 2;

interface Props {
    /** 입력이 잠시 멈추거나 Enter 를 누르면 다듬은 검색어를 넘긴다. 짧거나 비면 "" */
    onSearch: (term: string) => void;
}

/**
 * 이름·주소 검색 칸 (MAP-06). 입력 중인 글자는 이 안에만 두어, 한 글자 칠 때마다 홈 화면 전체(지도·목록)가
 * 다시 그려지지 않게 한다. 홈은 검색어가 정해질 때만 바뀐다.
 */
export const SearchField = memo(function SearchField({ onSearch }: Props) {
    const { t } = useTranslation();
    const [searchText, setSearchText] = useState("");
    const termOf = (s: string) => (s.trim().length >= MIN_LENGTH ? s.trim() : "");

    useEffect(() => {
        const id = window.setTimeout(() => onSearch(termOf(searchText)), 300);
        return () => window.clearTimeout(id);
    }, [searchText, onSearch]);

    return (
        <TextField
            type="search"
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") onSearch(termOf(searchText));
                if (e.key === "Escape") setSearchText("");
            }}
            placeholder={t("search.placeholder")}
            inputProps={{ "aria-label": t("search.label") }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
    );
});

import { useTranslation } from "react-i18next";
import type { RecommendedToilet, ToiletNear } from "../api";
import { BoardRowContent } from "./BoardRow";
import { ACCOUNTS } from "../lib/features";

interface Props {
    items: RecommendedToilet[] | undefined;
    loading: boolean;
    failed: boolean;
    onSelect: (t: ToiletNear) => void;
    /** 추천이 비었을 때 가까운 순 목록으로 */
    onShowList: () => void;
}

/**
 * 추천 안내판: 근처 안내판과 같은 행 모양에, 왜 추천했는지 한 줄 (평점, 댓글이 받은 도움돼요).
 * 점수 식은 서버 ToiletRecommender (품질 50% · 믿음 30% · 가까움 20%, 닫힌 곳 제외).
 */
export function RecommendedList({ items, loading, failed, onSelect, onShowList }: Props) {
    const { t } = useTranslation();
    return (
        <section className="board" aria-labelledby="rec-title">
            <div className="activity-head">
                <h2 id="rec-title">{t("recommend.title")}</h2>
            </div>
            <p className="rec-intro">{t(ACCOUNTS ? "recommend.intro" : "recommend.introRatingsOnly")}</p>

            {loading && <p className="board-empty">{t("recommend.loading")}</p>}
            {failed && <p className="board-empty">{t("recommend.failed")}</p>}
            {items && items.length === 0 && (
                <div className="board-empty">
                    <p style={{ margin: 0 }}>{t(ACCOUNTS ? "recommend.empty" : "recommend.emptyRatingsOnly")}</p>
                    <button type="button" className="activity-more" style={{ paddingInline: 0 }} onClick={onShowList}>
                        {t("recommend.showList")}
                    </button>
                </div>
            )}
            {items && items.length > 0 && (
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {items.map((r, i) => (
                        <li key={r.toilet.id}>
                            <button type="button" className="board-row" onClick={() => onSelect(r.toilet)}>
                                <BoardRowContent toilet={r.toilet} />
                            </button>
                            <p className="rec-why">
                                <span className="rec-rank">{t("recommend.rank", { n: i + 1 })}</span>
                                {r.toilet.averageRating !== null && r.ratingCount > 0 && (
                                    <span>{t("recommend.rating", { avg: r.toilet.averageRating.toFixed(1), count: r.ratingCount })}</span>
                                )}
                                {r.helpfulUp > 0 && <span>{t("recommend.helpful", { count: r.helpfulUp })}</span>}
                            </p>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

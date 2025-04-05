import { useEffect, useState } from "react";
import type { Comment, CommentSourceType } from "../types/comment";
import type { Project } from "../types/project";

interface CommentListProps {
  comments: Comment[];
  project: Project;
}

export const CommentList = ({ comments, project }: CommentListProps) => {
  type FilterType = "all" | "withExtracted" | "withExtractedAndStance";

  const [filterType, setFilterType] = useState<FilterType>(() => {
    const saved = localStorage.getItem("commentFilterType");
    return (saved as FilterType) || "withExtractedAndStance";
  });

  const [showStances, setShowStances] = useState(() => {
    const saved = localStorage.getItem("showStances");
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem("commentFilterType", filterType);
    localStorage.setItem("showStances", JSON.stringify(showStances));
  }, [filterType, showStances]);

  const filteredComments = comments.filter((comment) => {
    switch (filterType) {
      case "all":
        return true;
      case "withExtracted":
        return !!comment.extractedContent;
      case "withExtractedAndStance":
        return (
          !!comment.extractedContent &&
          comment.stances?.some((stance) => {
            const question = project.questions.find(
              (q) => q.id === stance.questionId,
            );
            const stanceName = question?.stances.find(
              (s) => s.id === stance.stanceId,
            )?.name;
            return stanceName && stanceName !== "立場なし";
          })
        );
      default:
        return true;
    }
  });

  // 立場の名前を取得する関数
  const getStanceName = (
    questionId: string,
    stanceId: string,
  ): string | null => {
    const question = project.questions.find((q) => q.id === questionId);
    if (!question) return null;

    // 特殊な立場のIDを確認
    if (stanceId === "neutral") return null; // 「立場なし」は表示しない
    if (stanceId === "other") return "その他の立場";

    const stance = question.stances.find((s) => s.id === stanceId);
    if (!stance) return null;
    return stance.name;
  };

  // 信頼度を表示用に変換する関数
  // const formatConfidence = (confidence: number) => {
  //   return `${Math.round(confidence * 100)}%`;
  // };

  // データソースタイプに応じたスタイルを取得する関数
  const getSourceTypeStyle = (sourceType: CommentSourceType) => {
    switch (sourceType) {
      case "youtube":
        return "bg-red-100 text-red-800";
      case "x":
        return "bg-gray-900 text-white";
      case "form":
        return "bg-blue-100 text-blue-800";
      case "chat":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // データソースタイプの表示名を取得する関数
  const getSourceTypeName = (sourceType: CommentSourceType) => {
    switch (sourceType) {
      case "youtube":
        return "YouTube";
      case "x":
        return "X (Twitter)";
      case "form":
        return "フォーム";
      case "chat":
        return "チャット";
      default:
        return "その他";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end mb-4 space-x-4">
        <select
          className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
        >
          <option value="all">全てのコメントを表示</option>
          <option value="withExtracted">抽出意見があるコメントを表示</option>
          <option value="withExtractedAndStance">
            抽出意見と立場があるコメントを表示
          </option>
        </select>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={showStances}
            onChange={(e) => setShowStances(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          <span className="ms-3 text-sm font-medium text-gray-500">
            立場を表示
          </span>
        </label>
      </div>

      {filteredComments.map((comment) => (
        <div
          key={comment._id}
          className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">
                {(() => {
                  // 確実に日付オブジェクトに変換
                  const date = new Date(comment.createdAt);
                  // 日本時間で年月日を取得
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  // 日本時間で時刻を取得
                  const hours = String(date.getHours()).padStart(2, "0");
                  const minutes = String(date.getMinutes()).padStart(2, "0");

                  // 日本形式で返す: yyyy/mm/dd hh:mm
                  return `${year}/${month}/${day} ${hours}:${minutes}`;
                })()}
              </span>
              {comment.sourceType && (
                <div className="flex items-center gap-2">
                  <div className="group relative">
                    {comment.sourceUrl ? (
                      <a
                        href={comment.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium hover:opacity-80 ${getSourceTypeStyle(
                          comment.sourceType,
                        )}`}
                      >
                        {`元のコメントを表示：${getSourceTypeName(
                          comment.sourceType,
                        )}`}
                      </a>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSourceTypeStyle(
                          comment.sourceType,
                        )}`}
                      >
                        {`元のコメントを表示：${getSourceTypeName(
                          comment.sourceType,
                        )}`}
                      </span>
                    )}
                    <div className="invisible group-hover:visible absolute z-10 w-96 p-2 mt-2 text-sm bg-gray-900 text-white rounded shadow-lg right-full translate-x-24">
                      {comment.sourceType === "x"
                        ? "X(Twitter)の規約上、元のコンテンツを表示できません。クリックして元の投稿をご確認ください。"
                        : comment.content || "元のコンテンツがありません"}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* 抽出結果の表示 */}
            <div className="mt-2">
              <p className="text-gray-700">
                {comment.extractedContent || "抽出結果なし"}
              </p>
            </div>

            {/* 立場の表示 */}
            {showStances && comment.stances && comment.stances.length > 0 && (
              <div className="mt-4 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {comment.stances
                    .filter((stance) => {
                      const question = project.questions.find(
                        (q) => q.id === stance.questionId,
                      );
                      const stanceName = question?.stances.find(
                        (s) => s.id === stance.stanceId,
                      )?.name;
                      return stanceName !== "立場なし";
                    })
                    .map((stance) => {
                      const question = project.questions.find(
                        (q) => q.id === stance.questionId,
                      );
                      if (!question) return null;

                      const stanceName = getStanceName(
                        stance.questionId,
                        stance.stanceId,
                      );
                      if (!stanceName) return null;

                      return (
                        <div key={stance.questionId} className="group relative">
                          <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                            <span className="text-sm font-medium text-blue-800">
                              {stanceName}
                            </span>
                            {/* <span className="text-xs text-gray-500">
                              {formatConfidence(stance.confidence)}
                            </span> */}
                          </div>
                          <div className="invisible group-hover:visible absolute z-10 w-64 p-2 mt-2 text-sm bg-gray-900 text-white rounded shadow-lg">
                            {question.text}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      {filteredComments.length === 0 && (
        <p className="text-center text-gray-500">
          {comments.length === 0
            ? "コメントはまだありません"
            : filterType === "all"
              ? ""
              : filterType === "withExtracted"
                ? "抽出意見のあるコメントはまだありません"
                : "抽出意見と立場のあるコメントはまだありません"}
        </p>
      )}
    </div>
  );
};

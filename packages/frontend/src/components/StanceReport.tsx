import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { analyzeStances } from "../config/api";
import type { Comment, CommentSourceType } from "../types/comment";
import type { Project, Question, StanceAnalysisReport } from "../types/project";
import { convertBoldBrackets } from "../utils/markdownHelper";
import { StanceGraphComponent } from "./StanceGraphComponent";

interface StanceAnalyticsProps {
  comments: Comment[];
  project: Project;
  initialQuestionId?: string | null;
}

interface StanceStats {
  count: number;
  comments: Comment[];
}

export const StanceReport = ({
  comments,
  project,
  initialQuestionId,
}: StanceAnalyticsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin] = useState(() => !!localStorage.getItem("adminKey"));

  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    () => {
      if (initialQuestionId) {
        const question = project.questions.find(
          (q) => q.id === initialQuestionId,
        );
        if (question) return question;
      }
      return project.questions.length > 0 ? project.questions[0] : null;
    },
  );

  // Update URL when question changes
  const handleQuestionChange = (question: Question) => {
    setSelectedQuestion(question);
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("question", question.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const [analysisReport, setAnalysisReport] =
    useState<StanceAnalysisReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [expandedStances, setExpandedStances] = useState<
    Record<string, boolean>
  >({});

  const toggleStanceExpand = (stanceId: string) => {
    setExpandedStances((prev) => ({
      ...prev,
      [stanceId]: !prev[stanceId],
    }));
  };

  const fetchAnalysisReport = useCallback(
    async (forceRegenerate = false) => {
      if (!selectedQuestion) return;

      try {
        setIsLoadingReport(true);
        const report = await analyzeStances(
          project._id,
          selectedQuestion.id,
          forceRegenerate,
        );
        setAnalysisReport(report);
      } catch (error) {
        console.error("Error fetching analysis report:", error);
        // TODO: エラー処理を追加
      } finally {
        setIsLoadingReport(false);
      }
    },
    [project._id, selectedQuestion],
  );

  // 論点が変更されたら自動的に分析結果を取得
  useEffect(() => {
    if (selectedQuestion) {
      fetchAnalysisReport();
    }
  }, [selectedQuestion, fetchAnalysisReport]);

  // 論点と立場ごとのコメントを集計
  const calculateStanceStats = (
    question: Question,
  ): Record<string, StanceStats> => {
    const stats: Record<string, StanceStats> = {};

    // 統計オブジェクトを初期化
    for (const stance of question.stances) {
      stats[stance.id] = { count: 0, comments: [] };
    }
    // その他の立場用の初期化
    stats.other = { count: 0, comments: [] };

    for (const comment of comments) {
      const stance = comment.stances.find((s) => s.questionId === question.id);
      if (stance) {
        if (stats[stance.stanceId]) {
          stats[stance.stanceId].count += 1;
          stats[stance.stanceId].comments.push(comment);
        }
      }
    }

    return stats;
  };

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

  // 立場の名前を取得する関数
  const getStanceName = (stanceId: string): string => {
    if (stanceId === "other") return "その他の立場";
    if (!selectedQuestion) return "";

    const stance = selectedQuestion.stances.find((s) => s.id === stanceId);
    return stance ? stance.name : "";
  };

  if (!selectedQuestion) {
    return <div>論点が設定されていません</div>;
  }

  const stanceStats = calculateStanceStats(selectedQuestion);

  //コメント種類分布用計算
  // コメントの種類ごとの件数を集計
  const sourceTypeCounts: { [key: CommentSourceType]: number } = {};
  comments.forEach((comment) => {
    const sourceType = comment.sourceType || "other";
    sourceTypeCounts[sourceType] = (sourceTypeCounts[sourceType] || 0) + 1;
  });
  // 全体のコメント数
  const totalComments = comments.length;

  return (
    <div className="space-y-6">
      {/* 論点選択タブ */}
      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-4 overflow-x-auto flex-nowrap"
          aria-label="Tabs"
        >
          {project.questions.map((question, index) => (
            <button
              type="button"
              key={question.id}
              onClick={() => {
                handleQuestionChange(question);
                setAnalysisReport(null); // 論点が変更されたらレポートをリセット
              }}
              className={`
                whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm
                ${
                  selectedQuestion.id === question.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              論点 {index + 1}
            </button>
          ))}
        </nav>
      </div>

      {/* 選択された論点の内容 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {selectedQuestion.text}
        </h3>

        {/* StanceGraphComponent を使用して円グラフを表示 */}
        <StanceGraphComponent
          comments={comments}
          selectedQuestion={selectedQuestion}
          showTitle={false} // タイトルは上で表示しているので不要
        />

        {/*コメント種類分布*/}
        <div className="text-right mb-4">
          コメントの種類分布：
          {Object.entries(sourceTypeCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([sourceType, count], index) => {
              const percentage =
                totalComments > 0
                  ? ((count / totalComments) * 100).toFixed(1)
                  : "0.0";
              const sourceTypeName = getSourceTypeName(
                sourceType as CommentSourceType,
              );
              const style = getSourceTypeStyle(sourceType as CommentSourceType);
              return (
                <span
                  key={sourceType}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1 ${style}`}
                >
                  {sourceTypeName}:{count}件({percentage}%)
                </span>
              );
            })}
        </div>

        {/* コメントリスト */}
        <div className="space-y-3 my-4">
          {Object.entries(stanceStats).map(([stanceId, stats]) => {
            if (stats.count === 0) return null;

            return (
              <div key={stanceId} className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-base font-medium text-gray-900">
                    {getStanceName(stanceId)}
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {stats.count}件
                  </span>
                </div>

                <div className="relative">
                  <div className="grid grid-cols-1 gap-1">
                    {stats.comments
                      .slice(0, expandedStances[stanceId] ? undefined : 3)
                      .map(
                        (comment, index) =>
                          comment.extractedContent && (
                            <div
                              key={comment._id}
                              className={`
                              bg-white px-3 py-2 text-sm border-l-4 border-blue-400
                              ${
                                !expandedStances[stanceId] && index === 2
                                  ? "relative"
                                  : ""
                              }
                            `}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  {
                                    comment.stances.find(
                                      (s) =>
                                        s.questionId === selectedQuestion.id,
                                    )?.extractedContent
                                  }
                                </div>
                                <div className="flex-1">
                                  {comment.extractedContent}
                                  {comment.content && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newState = { ...expandedStances };
                                        newState[`comment_${comment._id}`] =
                                          !newState[`comment_${comment._id}`];
                                        setExpandedStances(newState);
                                      }}
                                      className="ml-1 text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      {expandedStances[`comment_${comment._id}`]
                                        ? "原文を非表示"
                                        : "原文を表示"}
                                    </button>
                                  )}
                                  {comment.content &&
                                    expandedStances[
                                      `comment_${comment._id}`
                                    ] && (
                                      <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 relative">
                                        {comment.sourceType === "x"
                                          ? "X(Twitter)の規約上、元のコンテンツを表示できません。リンクから元の投稿をご確認ください。"
                                          : comment.content}
                                      </div>
                                    )}
                                </div>
                                {comment.sourceType && (
                                  <div className="ml-2 flex-shrink-0">
                                    <div className="group relative">
                                      {comment.sourceUrl ? (
                                        <a
                                          href={comment.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium hover:opacity-80 ${getSourceTypeStyle(
                                            comment.sourceType,
                                          )}`}
                                        >
                                          {getSourceTypeName(
                                            comment.sourceType,
                                          )}
                                        </a>
                                      ) : (
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSourceTypeStyle(
                                            comment.sourceType,
                                          )}`}
                                        >
                                          {getSourceTypeName(
                                            comment.sourceType,
                                          )}
                                        </span>
                                      )}
                                      <div className="invisible group-hover:visible absolute z-10 w-64 p-2 mt-2 text-sm bg-gray-900 text-white rounded shadow-lg right-0">
                                        {comment.sourceType === "x"
                                          ? "X(Twitter)の規約上、元のコンテンツを表示できません。リンクから元の投稿をご確認ください。"
                                          : comment.content ||
                                            "元のコンテンツがありません"}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {!expandedStances[stanceId] &&
                                index === 2 &&
                                stats.comments.length > 3 && (
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
                                )}
                            </div>
                          ),
                      )}
                  </div>
                  {stats.comments.length > 3 && (
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleStanceExpand(stanceId)}
                        className="inline-flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium w-full"
                      >
                        {!expandedStances[stanceId] ? (
                          <>
                            残り{stats.comments.length - 3}件のコメントを表示
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              role="img"
                              aria-label="コメントを折りたたむ"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </>
                        ) : (
                          <>
                            コメントを折りたたむ
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              role="img"
                              aria-label="コメントを折りたたむ"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 分析レポート */}
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium text-gray-900">
            立場の分析レポート
          </h4>
          {isAdmin && (
            <button
              type="button"
              onClick={() => fetchAnalysisReport(true)}
              disabled={isLoadingReport}
              className={`
                inline-flex items-center px-2 py-1 text-sm font-medium rounded
                border border-gray-300 bg-white hover:bg-gray-50
                text-blue-600 hover:text-blue-700
                ${isLoadingReport ? "cursor-not-allowed opacity-50" : ""}
              `}
            >
              <svg
                className={`mr-1 h-4 w-4 ${
                  isLoadingReport ? "animate-spin" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="再生成"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isLoadingReport ? "再生成中" : "再生成"}
            </button>
          )}
        </div>
        {isLoadingReport ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex items-center space-x-2">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                role="img"
                aria-label="分析レポートを読み込み中"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-gray-600">
                分析レポートを読み込み中...
              </span>
            </div>
          </div>
        ) : analysisReport ? (
          <div className="mb-8 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                {convertBoldBrackets(analysisReport.analysis)}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

import { useCallback, useEffect, useState } from "react";
import { generateProjectVisualReport } from "../config/api";
import type { Project } from "../types/project";

interface ProjectVisualReportProps {
  project: Project;
}

interface ProjectVisualAnalysisResult {
  projectName: string;
  overallAnalysis: string; // This contains HTML+CSS content
}

export const ProjectVisualReport = ({ project }: ProjectVisualReportProps) => {
  const [analysisResult, setAnalysisResult] =
    useState<ProjectVisualAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin] = useState(() => !!localStorage.getItem("adminKey"));

  // question://リンクを実際のURLに変換する関数
  const convertQuestionLinks = (html: string) => {
    const baseUrl = `${window.location.protocol}//${window.location.host}/projects/${project._id}/analytics`;

    // 変換前の内容をログ
    console.log("=== Converting Links ===");
    console.log("Original HTML:", html);

    // <a href="question://id">text</a> 形式のリンクを検索して変換
    const converted = html.replace(
      /<a\s+href="question:\/\/([^"]+)"([^>]*)>([^<]+)<\/a>/g,
      (match, questionId, attrs, text) => {
        const newUrl = `${baseUrl}?question=${questionId}`;
        console.log("Converting link:", {
          from: match,
          to: `<a href="${newUrl}"${attrs}>${text}</a>`,
        });
        return `<a href="${newUrl}"${attrs}>${text}</a>`;
      },
    );

    // 変換結果をログ
    console.log("Converted HTML:", converted);
    console.log("===================");

    return converted;
  };

  const fetchAnalysis = useCallback(
    async (forceRegenerate = false) => {
      try {
        console.log("Fetching visual report for project:", project._id);
        setIsLoading(true);
        setError(null);
        const data = await generateProjectVisualReport(
          project._id,
          forceRegenerate,
        );
        console.log("Visual report data received:", data);
        setAnalysisResult(data);
      } catch (err) {
        console.error("Error fetching visual report:", err);
        setError(
          err instanceof Error ? err.message : "予期せぬエラーが発生しました",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [project._id],
  );

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <svg
          className="animate-spin h-5 w-5 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          role="img"
          aria-label="読み込み中"
        >
          <title>読み込み中</title>
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
          ビジュアルレポートを読み込み中...
        </span>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-700 p-4 rounded-md">{error}</div>;
  }

  if (!analysisResult) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* 全体分析 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex p-6 justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            プロジェクト全体のビジュアル分析
          </h3>
          {isAdmin && (
            <button
              type="button"
              onClick={() => fetchAnalysis(true)}
              disabled={isLoading}
              className={`
                inline-flex items-center px-2 py-1 text-sm font-medium rounded
                border border-gray-300 bg-white hover:bg-gray-50
                text-blue-600 hover:text-blue-700
                ${isLoading ? "cursor-not-allowed opacity-50" : ""}
              `}
            >
              <svg
                className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                role="img"
                aria-label="再生成"
              >
                <title>再生成</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isLoading ? "再生成中" : "再生成"}
            </button>
          )}
        </div>
        <div
          className="visual-report-container"
          // biome-ignore lint: This component needs to render HTML content from the API
          dangerouslySetInnerHTML={{
            __html: convertQuestionLinks(analysisResult.overallAnalysis),
          }}
        />
      </div>
    </div>
  );
};

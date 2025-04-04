import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { ProjectQuestionsAndStances } from "../components/ProjectQuestionsAndStances";
import { ProjectReport } from "../components/ProjectReport";
import { ProjectVisualReport } from "../components/ProjectVisualReport";
import { StanceGraphComponent } from "../components/StanceGraphComponent";
import { getComments, getProject } from "../config/api";
import type { Comment } from "../types/comment";
import type { Project } from "../types/project";

export const EmbeddedInsightPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  const view = searchParams.get("view") || "stance";
  const questionId = searchParams.get("question");
  const isOverallRoute = location.pathname.endsWith("/overall");
  const isVisualRoute = location.pathname.endsWith("/visual");
  const isAnalyticsRoute = location.pathname.endsWith("/analytics");
  const isCommentsRoute = location.pathname.endsWith("/comments");

  // ビジュアル分析タブで埋め込みコンテンツの余白を詰めたいので
  useEffect(() => {
    document.body.classList.add("embedded-visual-analysis");
    return () => {
      document.body.classList.remove("embedded-visual-analysis");
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        setError("プロジェクトIDが指定されていません");
        setIsLoading(false);
        return;
      }

      try {
        const [projectData, commentsData] = await Promise.all([
          getProject(projectId),
          getComments(projectId),
        ]);
        setProject(projectData);
        setComments(commentsData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "予期せぬエラーが発生しました",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  // プロジェクトが読み込まれたら選択された論点を更新
  useEffect(() => {
    if (project) {
      if (questionId) {
        const question = project.questions.find((q) => q.id === questionId);
        if (question) {
          setSelectedQuestion(question);
          return;
        }
      }

      // /overall ルートの場合またはquestionIdが指定されていない場合は、selectedQuestionをnullに設定
      if (isOverallRoute || (!questionId && !isAnalyticsRoute)) {
        setSelectedQuestion(null);
        return;
      }

      // /analytics ルートでquestionIdが指定されていない場合は、最初の論点を選択
      if (isAnalyticsRoute && !questionId && project.questions.length > 0) {
        setSelectedQuestion(project.questions[0]);
        return;
      }

      if (project.questions.length > 0) {
        setSelectedQuestion(project.questions[0]);
      } else {
        setSelectedQuestion(null);
      }
    }
  }, [
    project,
    questionId,
    isOverallRoute,
    isAnalyticsRoute,
    project?.questions,
  ]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"
          aria-label="論点生成中"
        />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-4">
        <div className="text-red-500 text-sm">
          {error || "プロジェクトが見つかりませんでした"}
        </div>
      </div>
    );
  }

  // /overall ルートの場合は、プロジェクト全体のレポートを表示
  if (isOverallRoute && project) {
    return (
      <div className="bg-white">
        <ProjectReport project={project} />
      </div>
    );
  }

  // /visual ルートの場合は、プロジェクト全体のビジュアルレポートを表示
  if (isVisualRoute && project) {
    return (
      <div className="bg-white">
        <ProjectVisualReport project={project} />
      </div>
    );
  }

  // /comments ルートの場合は、プロジェクトの論点と立場を表示
  if (isCommentsRoute && project) {
    return (
      <div className="bg-white">
        <ProjectQuestionsAndStances project={project} />
      </div>
    );
  }

  // /analytics ルート以外で、questionIdが指定されていない場合は、プロジェクト全体のレポートを表示
  if (!isAnalyticsRoute && !questionId && !isCommentsRoute && project) {
    return (
      <div className="bg-white">
        <ProjectReport project={project} />
      </div>
    );
  }

  if (!selectedQuestion) {
    return <div className="p-4">論点が設定されていません</div>;
  }

  return (
    <div className="bg-white">
      {view === "stance" ? (
        <div>
          <StanceGraphComponent
            comments={comments}
            selectedQuestion={selectedQuestion}
            showTitle={true} // 埋め込みビューではタイトルを表示する
          />
          {/* 埋め込みモードでは詳細ボタンを表示 */}
          <div className="flex justify-center mt-4 mb-6">
            <a
              href={`/projects/${projectId}/analytics?question=${selectedQuestion.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <span>詳しく知る</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-label="詳しく知る"
                role="img"
              >
                <title id="detailTitle">詳しく知る</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <ProjectReport project={project} />
      )}
    </div>
  );
};

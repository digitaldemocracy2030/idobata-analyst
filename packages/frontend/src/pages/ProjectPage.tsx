import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatComponent } from "../components/ChatComponent";
import { CommentForm } from "../components/CommentForm";
import { CommentList } from "../components/CommentList";
import { ProjectQuestionsAndStances } from "../components/ProjectQuestionsAndStances";
import { ProjectReport } from "../components/ProjectReport";
// import { ProjectVisualReport } from '../components/ProjectVisualReport';
import { QuestionGenerationButton } from "../components/QuestionGenerationButton";
import { StanceReport } from "../components/StanceReport";
import {
  addComment,
  generateQuestions,
  getComments,
  getProject,
} from "../config/api";
import type { Comment, CommentInput, CommentOptions } from "../types/comment";
import type { Project } from "../types/project";

export const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(
    () => !!localStorage.getItem("adminKey"),
  );
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const questionId = searchParams.get("question");

  const activeTab = useMemo(() => {
    const path = location.pathname.split("/").pop();
    if (
      path === "comments" ||
      path === "analytics" ||
      path === "overall" ||
      path === "chat" ||
      path === "visual"
    ) {
      return path;
    }
    return "overall";
  }, [location.pathname]) as
    | "comments"
    | "analytics"
    | "overall"
    | "chat"
    | "visual";

  // 初期リダイレクト
  useEffect(() => {
    if (location.pathname === `/projects/${projectId}`) {
      if (questionId) {
        navigate(`/projects/${projectId}/analytics?question=${questionId}`);
      } else if (location.search.includes("chat")) {
        navigate(`/projects/${projectId}/chat`);
      } else {
        navigate(`/projects/${projectId}/overall`);
      }
    }
  }, [projectId, location.pathname, location.search, navigate, questionId]);

  const fetchProject = useCallback(async () => {
    try {
      if (!projectId) throw new Error("プロジェクトIDが指定されていません");
      const data = await getProject(projectId);
      setProject(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchComments = useCallback(async () => {
    try {
      if (!projectId) throw new Error("プロジェクトIDが指定されていません");
      const data = await getComments(projectId);
      setComments(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました",
      );
    }
  }, [projectId]);

  const handleSubmitComment = async (
    data: CommentInput,
    options: CommentOptions,
  ) => {
    try {
      if (!projectId) throw new Error("プロジェクトIDが指定されていません");
      await addComment(projectId, data, options);
      await fetchComments();
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました",
      );
      throw err;
    }
  };

  // AdminKeyの変更を監視
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAdmin(!!localStorage.getItem("adminKey"));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (projectId) {
      setIsLoading(true);
      fetchProject();
      fetchComments();
    }
  }, [projectId, fetchProject, fetchComments]);

  if (isLoading) {
    return (
      <div className="max-w-[90%] w-full mx-auto py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!projectId || !project) {
    return (
      <div className="max-w-[90%] w-full mx-auto py-8 px-4">
        <div className="text-center">
          <p className="text-red-500">プロジェクトが見つかりませんでした</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[90%] w-full mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
      {project.description && (
        <p className="text-gray-700 mb-8">{project.description}</p>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-8">
        <nav
          className="-mb-px flex space-x-8  overflow-x-auto flex-nowrap"
          aria-label="Tabs"
        >
          <Link
            to={`/projects/${projectId}/overall`}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "overall"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            全体の分析
          </Link>
          <Link
            to={`/projects/${projectId}/visual`}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "visual"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            ビジュアル分析
          </Link>
          <Link
            to={`/projects/${projectId}/analytics`}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "analytics"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            論点ごとの分析
          </Link>
          <Link
            to={`/projects/${projectId}/comments`}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "comments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            コメント一覧
          </Link>
          <Link
            to={`/projects/${projectId}/chat`}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === "chat"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            チャット
          </Link>
        </nav>
      </div>

      <div className="mt-8">
        {activeTab === "comments" && (
          <>
            {isAdmin && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  新規コメント
                </h2>
                <CommentForm
                  onSubmit={handleSubmitComment}
                  project={project}
                  isAdmin={isAdmin}
                />
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <ProjectQuestionsAndStances project={project} />
            </div>
            <CommentList comments={comments} project={project} />
          </>
        )}

        {activeTab === "analytics" && (
          <>
            {isAdmin && (
              <div className="mb-6">
                <QuestionGenerationButton
                  isGenerating={isLoading}
                  onGenerate={async () => {
                    setIsLoading(true);
                    try {
                      const updatedProject = await generateQuestions(projectId);
                      setProject(updatedProject);
                      await fetchComments();
                      setError("");
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "論点の生成に失敗しました",
                      );
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                />
              </div>
            )}
            <StanceReport
              comments={comments}
              project={project}
              initialQuestionId={questionId}
            />
          </>
        )}

        {activeTab === "overall" && <ProjectReport project={project} />}

        {activeTab === "visual" && (
          <div className="bg-white rounded-lg shadow-sm">
            <iframe
              src={`/embed/projects/${projectId}/visual`}
              className="w-full border-0"
              style={{ height: "1200px" }}
              title="プロジェクトビジュアル分析"
            />
          </div>
        )}

        {activeTab === "chat" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              プロジェクトチャット
            </h2>
            <ChatComponent projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
};

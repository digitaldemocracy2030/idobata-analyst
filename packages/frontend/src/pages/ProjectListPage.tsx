import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProjectForm } from "../components/ProjectForm";
import { ProjectList } from "../components/ProjectList";
import { API_URL } from "../config/api";
import type { Project } from "../types/project";

export const ProjectListPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(
    () => !!localStorage.getItem("adminKey"),
  );

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  // AdminKeyの変更を監視
  useEffect(() => {
    const handleStorageChange = () => {
      const hasAdminKey = !!localStorage.getItem("adminKey");
      setIsAdmin(hasAdminKey);
      if (!hasAdminKey) {
        navigate("/");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  const fetchProjects = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const adminKey = localStorage.getItem("adminKey");
      if (adminKey) {
        headers["x-api-key"] = adminKey;
      }

      const response = await fetch(`${API_URL}/projects`, {
        headers,
      });
      if (!response.ok) throw new Error("プロジェクトの取得に失敗しました");
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました",
      );
    }
  }, []);

  const handleSubmitProject = async (
    name: string,
    description: string,
    extractionTopic: string,
    context: string,
    questions: any[],
  ) => {
    try {
      const method = editingProject ? "PUT" : "POST";
      const url = editingProject
        ? `${API_URL}/projects/${editingProject._id}`
        : `${API_URL}/projects`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const adminKey = localStorage.getItem("adminKey");
      if (adminKey) {
        headers["x-api-key"] = adminKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name,
          description,
          extractionTopic,
          context,
          questions,
        }),
      });

      if (!response.ok)
        throw new Error(
          editingProject
            ? "プロジェクトの更新に失敗しました"
            : "プロジェクトの作成に失敗しました",
        );
      await fetchProjects();
      setShowForm(false);
      setEditingProject(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました",
      );
      throw err;
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProjects();
    }
  }, [isAdmin, fetchProjects]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-[90%] w-full mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">プロジェクト一覧</h1>
        <button
          type="button"
          onClick={() => (showForm ? handleCloseForm() : setShowForm(true))}
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {showForm ? "フォームを閉じる" : "新規プロジェクト"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingProject ? "プロジェクト設定の編集" : "新規プロジェクト"}
          </h2>
          <ProjectForm
            onSubmit={handleSubmitProject}
            initialData={editingProject || undefined}
            mode={editingProject ? "edit" : "create"}
          />
        </div>
      )}

      <ProjectList
        projects={projects}
        onEdit={handleEditProject}
        showEditButton={true}
      />
    </div>
  );
};

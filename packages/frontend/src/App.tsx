import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AdminAuthPage } from "./pages/AdminAuthPage";
import CsvUploadPage from "./pages/CsvUploadPage";
import { EmbeddedInsightPage } from "./pages/EmbeddedInsightPage";
import { HomePage } from "./pages/HomePage";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProjectPage } from "./pages/ProjectPage";
import { PromptSettingsPage } from "./pages/PromptSettingsPage";

function App() {
  const isAdmin = !!localStorage.getItem("adminKey");
  const location = window.location.pathname;
  const isEmbedded = location.startsWith("/embed/");

  return (
    <Router>
      <div className={`min-h-screen ${!isEmbedded ? "bg-gray-50" : ""}`}>
        {isAdmin && !isEmbedded && (
          <nav className="bg-white shadow-sm">
            <div className="mx-auto px-4 py-3 flex gap-4 max-w-[90%] w-full">
              <Link to="/" className="text-blue-500 hover:text-blue-600">
                ホーム
              </Link>
              <Link
                to="/projects"
                className="text-blue-500 hover:text-blue-600"
              >
                プロジェクト一覧
              </Link>
              <Link
                to="/csv-upload"
                className="text-blue-500 hover:text-blue-600"
              >
                CSVアップロード
              </Link>
              <Link
                to="/prompt-settings"
                className="text-blue-500 hover:text-blue-600"
              >
                プロンプト設定
              </Link>
            </div>
          </nav>
        )}

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />}>
            <Route path="comments" element={<ProjectPage />} />
            <Route path="analytics" element={<ProjectPage />} />
            <Route path="overall" element={<ProjectPage />} />
            <Route path="visual" element={<ProjectPage />} />
            <Route path="chat" element={<ProjectPage />} />
          </Route>
          <Route path="/csv-upload" element={<CsvUploadPage />} />
          <Route path="/adminauth" element={<AdminAuthPage />} />
          <Route path="/prompt-settings" element={<PromptSettingsPage />} />
          <Route
            path="/embed/projects/:projectId/overall"
            element={<EmbeddedInsightPage />}
          />
          <Route
            path="/embed/projects/:projectId/visual"
            element={<EmbeddedInsightPage />}
          />
          <Route
            path="/embed/projects/:projectId/analytics"
            element={<EmbeddedInsightPage />}
          />
          <Route
            path="/embed/projects/:projectId/comments"
            element={<EmbeddedInsightPage />}
          />
          <Route
            path="/embed/insights/:projectId"
            element={<EmbeddedInsightPage />}
          />
          <Route path="/embed/:projectId" element={<EmbeddedInsightPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

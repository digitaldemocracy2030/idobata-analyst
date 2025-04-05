import { Link } from "react-router-dom";

export const HomePage = () => {
  const isAdmin = !!localStorage.getItem("adminKey");

  return (
    <div className="max-w-[90%] w-full mx-auto py-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          コメント分析システム
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          コメントを収集・分析し、議論の論点を整理するシステムです。
        </p>

        {isAdmin && (
          <div className="space-y-4">
            <Link
              to="/projects"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              プロジェクト一覧
            </Link>
            <div className="mt-4">
              <Link
                to="/csv-upload"
                className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                CSVアップロード
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

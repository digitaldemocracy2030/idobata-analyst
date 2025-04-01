import { useState } from "react";
import { downloadLlmsTxt, generateLlmsTxt } from "../config/api";

interface LlmsTxtDownloaderProps {
  projectId: string;
}

export const LlmsTxtDownloader: React.FC<LlmsTxtDownloaderProps> = ({
  projectId,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAndDownload = async (type: "basic" | "full") => {
    setIsGenerating(true);
    setError(null);
    try {
      // まずLLMs.txtを生成
      await generateLlmsTxt(projectId);
      // 生成したLLMs.txtをダウンロード
      downloadLlmsTxt(projectId, type);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "LLMs.txtの生成に失敗しました"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        AI連携用LLMs.txtダウンロード
      </h2>
      <p className="text-gray-600 mb-4">
        このプロジェクトの分析結果をAIが理解しやすいLLMs.txt形式でダウンロードできます。
        LLMs.txtは、AIシステムがウェブサイトのコンテンツを理解しやすくするための標準ファイル形式です。
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => handleGenerateAndDownload("basic")}
          disabled={isGenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {isGenerating ? "生成中..." : "LLMs.txtをダウンロード"}
        </button>
        <button
          onClick={() => handleGenerateAndDownload("full")}
          disabled={isGenerating}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          {isGenerating ? "生成中..." : "LLMs-full.txtをダウンロード"}
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>※ LLMs.txt: 基本的な情報を含む簡潔なバージョン</p>
        <p>※ LLMs-full.txt: より詳細な情報を含む拡張バージョン</p>
      </div>
    </div>
  );
};
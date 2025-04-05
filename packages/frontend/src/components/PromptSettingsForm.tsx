import type React from "react";
import { useEffect, useState } from "react";
import { getDefaultPrompts } from "../config/api";
import {
  type CustomPrompts,
  type PromptType,
  STORAGE_KEY,
  validatePrompt,
} from "../types/prompt";

interface PromptSettingsFormProps {
  onSave?: (prompts: CustomPrompts) => void;
}

const promptTypeLabels: Record<PromptType, string> = {
  stanceAnalysis: "立場分析",
  contentExtraction: "コンテンツ抽出",
  questionGeneration: "質問生成",
  relevanceCheck: "関連性チェック",
  stanceReport: "立場レポート",
  projectReport: "プロジェクトレポート",
};

export const PromptSettingsForm: React.FC<PromptSettingsFormProps> = ({
  onSave,
}) => {
  const [prompts, setPrompts] = useState<CustomPrompts>({});
  const [defaultPrompts, setDefaultPrompts] = useState<CustomPrompts>({});
  const [activeType, setActiveType] = useState<PromptType>("stanceAnalysis");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // LocalStorageからプロンプト設定を読み込み、デフォルトプロンプトを取得
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        // LocalStorageからカスタムプロンプトを読み込む
        const savedPrompts = localStorage.getItem(STORAGE_KEY);
        if (savedPrompts) {
          setPrompts(JSON.parse(savedPrompts));
        }

        // デフォルトプロンプトを取得
        const defaults = await getDefaultPrompts();
        setDefaultPrompts(defaults);
      } catch (e) {
        console.error("Failed to load prompts:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadPrompts();
  }, []);

  // プロンプト設定を保存
  const savePrompts = (newPrompts: CustomPrompts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrompts));
    setPrompts(newPrompts);
    onSave?.(newPrompts);
  };

  // プロンプトの更新
  const handlePromptChange = (type: PromptType, content: string) => {
    const validation = validatePrompt(content);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    setError(undefined);

    const newPrompts = {
      ...prompts,
      [type]: content.trim() || undefined,
    };
    savePrompts(newPrompts);
  };

  // プロンプトのリセット
  const handleReset = (type: PromptType) => {
    const newPrompts = { ...prompts };
    delete newPrompts[type];
    savePrompts(newPrompts);
  };

  // 全プロンプトのリセット
  const handleResetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPrompts({});
    onSave?.({});
  };

  return (
    <div className="max-w-[90%] w-full mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">プロンプト設定</h2>

      {/* プロンプトタイプ選択 */}
      <div className="mb-4">
        <label htmlFor="promptType" className="block text-sm font-medium mb-2">
          プロンプトタイプ
        </label>
        <select
          id="promptType"
          className="w-full p-2 border rounded"
          value={activeType}
          onChange={(e) => setActiveType(e.target.value as PromptType)}
        >
          {Object.entries(promptTypeLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* プロンプト編集エリア */}
      <div className="mb-4">
        <label
          htmlFor="customPrompt"
          className="block text-sm font-medium mb-2"
        >
          カスタムプロンプト
        </label>
        {isLoading ? (
          <div className="w-full p-2 border rounded min-h-[200px] bg-gray-50 flex items-center justify-center">
            <span>読み込み中...</span>
          </div>
        ) : (
          <textarea
            id="customPrompt"
            className="w-full p-2 border rounded min-h-[200px]"
            value={prompts[activeType] || defaultPrompts[activeType] || ""}
            onChange={(e) => handlePromptChange(activeType, e.target.value)}
            placeholder="カスタムプロンプトを入力してください"
          />
        )}
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      {/* アクションボタン */}
      <div className="flex gap-4">
        <button
          type="button"
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => handleReset(activeType)}
        >
          このプロンプトをリセット
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
          onClick={handleResetAll}
        >
          全てリセット
        </button>
      </div>

      {/* 現在の設定状態 */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">現在の設定状態</h3>
        <div className="bg-gray-50 p-4 rounded">
          {Object.entries(promptTypeLabels).map(([type, label]) => (
            <div key={type} className="mb-2">
              <span className="font-medium">{label}:</span>{" "}
              {prompts[type as PromptType] ? (
                <span className="text-blue-600">カスタム設定</span>
              ) : defaultPrompts[type as PromptType] ? (
                <span className="text-gray-600">デフォルト使用</span>
              ) : (
                <span className="text-red-600">未設定</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

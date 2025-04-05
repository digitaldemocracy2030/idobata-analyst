import type React from "react";
import { PromptSettingsForm } from "../components/PromptSettingsForm";
import type { CustomPrompts } from "../types/prompt";

export const PromptSettingsPage: React.FC = () => {
  const handleSave = (prompts: CustomPrompts) => {
    // 保存完了時の処理（必要に応じて通知など）
    console.log("Prompts saved:", prompts);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-[90%] w-full mx-auto">
        <h1 className="text-3xl font-bold mb-8">プロンプト設定</h1>
        <div className="bg-white shadow-md rounded-lg p-6">
          <p className="text-gray-600 mb-6">
            各分析タイプのカスタムプロンプトを設定できます。
            設定したプロンプトは自動的に保存され、分析実行時に使用されます。
            設定を削除すると、デフォルトのプロンプトが使用されます。
          </p>
          <PromptSettingsForm onSave={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default PromptSettingsPage;

import mongoose from "mongoose";
import type { IComment } from "../models/comment";
import type { IProject } from "../models/project";
import { openRouterService } from "./openRouterService";
import { ProjectReportGenerator } from "./projectReportGenerator";

export interface LlmsTxtResult {
  projectName: string;
  llmsTxt: string;
  llmsFullTxt: string;
}

export class LlmsTxtGenerator {
  private projectReportGenerator: ProjectReportGenerator;

  constructor() {
    this.projectReportGenerator = new ProjectReportGenerator();
  }

  async generateLlmsTxt(
    project: IProject & { _id: mongoose.Types.ObjectId },
    comments: IComment[],
    forceRegenerate = false,
  ): Promise<LlmsTxtResult> {
    try {
      // プロジェクトレポートジェネレーターからマークダウンレポートを取得
      console.log("Getting markdown report from project report generator...");
      const markdownReport = await this.projectReportGenerator.generateProjectReport(
        project,
        comments,
        forceRegenerate,
      );

      // LLMs.txt形式のプロンプトを作成
      const llmsTxtPrompt = `
# LLMs.txt生成プロンプト

## 目的
以下のプロジェクト情報と分析レポートを元に、LLMs.txt形式のファイルを生成してください。
LLMs.txtは、AIシステムがウェブサイトのコンテンツを理解しやすくするための標準ファイル形式です。

## LLMs.txt形式の仕様
1. H1見出しでプロジェクト名を記載
2. ブロッククォート(>)でプロジェクトの簡潔な説明
3. 主要なセクションをH2見出しで区切る
4. 各セクション内にはマークダウンリストで関連情報を記載

## プロジェクト情報
- プロジェクト名: ${project.name}
- プロジェクト説明: ${project.description || ""}
- 抽出トピック: ${project.extractionTopic || ""}
- コンテキスト: ${project.context || ""}

## 分析レポート
${markdownReport.overallAnalysis}

## 出力形式
LLMs.txt形式のマークダウンファイルを生成してください。以下のセクションを含めてください：
1. プロジェクト概要
2. 主要な論点
3. 立場の分布
4. 分析結果

出力は完全なマークダウンテキストのみを返してください。`;

      // LLMs-full.txt形式のプロンプトを作成
      const llmsFullTxtPrompt = `
# LLMs-full.txt生成プロンプト

## 目的
以下のプロジェクト情報と分析レポートを元に、より詳細なLLMs-full.txt形式のファイルを生成してください。
LLMs-full.txtは、AIシステムがウェブサイトのコンテンツを詳細に理解するための拡張ファイル形式です。

## LLMs-full.txt形式の仕様
1. H1見出しでプロジェクト名を記載し、「詳細版」と明記
2. ブロッククォート(>)でプロジェクトの簡潔な説明
3. 主要なセクションをH2見出しで区切る
4. 各セクション内には詳細な説明と、必要に応じてH3見出しでサブセクションを設ける
5. 情報は階層的に整理し、詳細なコンテキストを提供

## プロジェクト情報
- プロジェクト名: ${project.name}
- プロジェクト説明: ${project.description || ""}
- 抽出トピック: ${project.extractionTopic || ""}
- コンテキスト: ${project.context || ""}
- 質問数: ${project.questions.length}
- コメント数: ${comments.length}
- 情報源の種類: ${Array.from(new Set(comments.map(c => c.sourceType))).filter(Boolean).join(', ')}

## 分析レポート
${markdownReport.overallAnalysis}

## 出力形式
LLMs-full.txt形式の詳細なマークダウンファイルを生成してください。以下のセクションを含め、各セクションには詳細な説明を加えてください：
1. プロジェクト概要（背景、目的、意義を含む）
2. 分析方法（データ収集方法、分析手法の説明）
3. 主要な論点（各論点の詳細な説明）
4. 立場の分布（各立場の詳細な説明と分布）
5. 詳細な分析結果（論点間の関連性、重要な洞察）
6. 結論と示唆（分析から得られる示唆、今後の展望）

出力は完全なマークダウンテキストのみを返してください。`;

      // LLMs.txtを生成
      console.log("Generating LLMs.txt...");
      const llmsTxtCompletion = await openRouterService.chat({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: llmsTxtPrompt }],
      });

      if (!llmsTxtCompletion) {
        throw new Error("Failed to generate LLMs.txt");
      }

      // LLMs-full.txtを生成
      console.log("Generating LLMs-full.txt...");
      const llmsFullTxtCompletion = await openRouterService.chat({
        model: "anthropic/claude-3.7-sonnet",
        messages: [{ role: "user", content: llmsFullTxtPrompt }],
      });

      if (!llmsFullTxtCompletion) {
        throw new Error("Failed to generate LLMs-full.txt");
      }

      // マークダウンコードブロックを削除
      const llmsTxt = llmsTxtCompletion.replace(/^```markdown|```$/g, "").trim();
      const llmsFullTxt = llmsFullTxtCompletion.replace(/^```markdown|```$/g, "").trim();

      return {
        projectName: project.name,
        llmsTxt,
        llmsFullTxt,
      };
    } catch (error) {
      console.error("LLMs.txt generation failed:", error);
      throw error;
    }
  }
}
import mongoose from "mongoose";
import type { IComment } from "../models/comment";
import type { IProject } from "../models/project";
import {
  type IProjectVisualAnalysis,
  ProjectVisualAnalysis,
} from "../models/projectVisualAnalysis";
import { openRouterService } from "./openRouterService";
import { ProjectReportGenerator } from "./projectReportGenerator";

export interface ProjectVisualAnalysisResult {
  projectName: string;
  overallAnalysis: string; // This will contain HTML+CSS content
}

export class ProjectVisualReportGenerator {
  private projectReportGenerator: ProjectReportGenerator;

  constructor() {
    this.projectReportGenerator = new ProjectReportGenerator();
  }

  async getAnalysis(projectId: string): Promise<IProjectVisualAnalysis | null> {
    return ProjectVisualAnalysis.findOne({
      projectId: new mongoose.Types.ObjectId(projectId),
    });
  }

  async generateProjectVisualReport(
    project: IProject & { _id: mongoose.Types.ObjectId },
    comments: IComment[],
    forceRegenerate = false,
    customPrompt?: string,
  ): Promise<ProjectVisualAnalysisResult> {
    try {
      // 強制再生成でない場合のみ既存の分析結果を確認
      console.log("Checking for existing visual analysis...");
      const existingAnalysis = await this.getAnalysis(project._id.toString());
      console.log("Existing visual analysis:", existingAnalysis);
      if (!forceRegenerate && existingAnalysis) {
        console.log("Using existing visual analysis");
        return {
          projectName: existingAnalysis.projectName,
          overallAnalysis: existingAnalysis.overallAnalysis,
        };
      }
      console.log(
        "No existing visual analysis found or force regenerate is true",
      );

      // プロジェクトレポートジェネレーターからマークダウンレポートを取得
      console.log("Getting markdown report from project report generator...");
      const markdownReport =
        await this.projectReportGenerator.generateProjectReport(
          project,
          comments,
          forceRegenerate,
          customPrompt,
        );

      console.log("Markdown report generated successfully");

      // マークダウンレポートをHTML+CSSに変換するための指示
      const visualPrompt = `
# グラフィックレコーディング風インフォグラフィック変換プロンプト

## 目的
  以下の内容を、超一流デザイナーが作成したような、日本語で完璧なグラフィックレコーディング風のHTMLインフォグラフィックに変換してください。情報設計とビジュアルデザインの両面で最高水準を目指します
  手書き風の図形やアイコンを活用して内容を視覚的に表現します。
## デザイン仕様
### 1. カラースキーム

  <palette>
  <color name='青-1' rgb='0A2463' r='10' g='36' b='99' />
  <color name='青-2' rgb='1E5EF3' r='30' g='94' b='243' />
  <color name='青-3' rgb='00A8E8' r='0' g='168' b='232' />
  <color name='青-4' rgb='38B6FF' r='56' g='182' b='255' />
  <color name='青-5' rgb='8CDBFF' r='140' g='219' b='255' />
  </palette>

### 2. グラフィックレコーディング要素
- 左上から右へ、上から下へと情報を順次配置
- 日本語の手書き風フォントの使用（Zen Maru Gothic）
- 手描き風の囲み線、矢印、バナー、吹き出し
- テキストと視覚要素（アイコン、シンプルな図形）の組み合わせ
- キーワードの強調（色付き下線、マーカー効果）
- 関連する概念を線や矢印で接続
- 絵文字やアイコンを効果的に配置（✏️📌📝🔍📊など）
### 3. タイポグラフィ
  - タイトル：48px、グラデーション効果、太字
  - サブタイトル：28px、#475569
  - セクション見出し：32px、#1e40af、アイコン付き
  - 本文：24px、#334155、行間1.6
  - フォント指定：
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap');
    </style>

### 4. レイアウト
  - ヘッダー：右上に小さく日付/出典。その下に、左揃えタイトル。
  - 1カラム構成：幅100%の単一カラム
  - カード型コンポーネント：白背景、角丸16px、微細シャドウ
  - セクション間の余白を広めに取り、階層構造を明確に
  - 適切にグラスモーフィズムを活用
  - コンテンツの最大幅は600pxで中央揃え
  - 余白を十分に取り、読みやすさを重視

## グラフィックレコーディング表現技法
- テキストと視覚要素のバランスを重視
- キーワードを囲み線や色で強調
- 簡易的なアイコンや図形で概念を視覚化
- 数値データは簡潔なグラフや図表で表現
- 接続線や矢印で情報間の関係性を明示
- 余白を効果的に活用して視認性を確保
## 全体的な指針
- 読み手が自然に視線を移動できる配置
- 情報の階層と関連性を視覚的に明確化
- 視覚的な記憶に残るデザイン
- 遠くからでも見やすいデザイン
- フッターに出典情報を明記
- 複雑すぎる構造はCSSが壊れる可能性があるため避ける
- 単に原文のキーワードだけ書いても意味が分からないため、誰にでも伝わるような分かりやすい表現に書き換えて説明する

## 変換する文章/記事
${markdownReport.overallAnalysis}
---
レスポンスは完全なHTML+CSSコードのみを返してください。`;

      const completion = await openRouterService.chat({
        model: "anthropic/claude-3.7-sonnet",
        messages: [{ role: "user", content: visualPrompt }],
      });

      if (!completion) {
        throw new Error("Failed to generate OpenRouter completion");
      }

      // Remove HTML tags wrapper if they exist
      const overallAnalysis = completion.replace(/^```html|```$/g, "").trim();

      // 分析結果をデータベースに保存 (既存のドキュメントがあれば更新、なければ新規作成)
      await ProjectVisualAnalysis.findOneAndUpdate(
        { projectId: project._id },
        {
          projectId: project._id,
          projectName: project.name,
          overallAnalysis,
          updatedAt: new Date(),
        },
        { upsert: true, new: true },
      );

      return {
        projectName: project.name,
        overallAnalysis,
      };
    } catch (error) {
      console.error("Project visual analysis generation failed:", error);
      throw error;
    }
  }
}

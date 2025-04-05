import { stancePrompts } from "../config/prompts";
import { openRouterService } from "./openRouterService";

export interface StanceAnalysisResult {
  questionId: string;
  stanceId: string | null;
  confidence: number | null;
  extractedContent: string | null;
}

export class StanceAnalyzer {
  private async parseResponse(response: string): Promise<{
    stance: string | null;
    confidence: number | null;
    extractedContent: string | null;
  }> {
    try {
      const cleaned = response.replace(/```json|```/g, "").trim();
      const result = JSON.parse(cleaned);
      return {
        stance: result.stance,
        confidence: result.confidence,
        extractedContent: result.extractedContent,
      };
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return {
        stance: null,
        confidence: null,
        extractedContent: null,
      };
    }
  }

  private ensureSpecialStances(
    stances: { id: string; name: string }[],
  ): { id: string; name: string }[] {
    const specialStances = [
      { id: "neutral", name: "立場なし" },
      { id: "other", name: "その他の立場" },
    ];

    const result = [...stances];

    for (const special of specialStances) {
      if (!stances.some((s) => s.name === special.name)) {
        result.push(special);
      }
    }

    return result;
  }

  async analyzeStance(
    comment: string,
    questionId: string,
    questionText: string,
    stances: { id: string; name: string }[],
    context?: string,
    customPrompt?: string,
  ): Promise<StanceAnalysisResult> {
    // 特殊な立場を確実に含める
    const stancesWithSpecial = this.ensureSpecialStances(stances);
    const stanceOptions = stancesWithSpecial.map((s) => s.name).join('", "');

    const prompt = stancePrompts
      .stanceAnalysis(questionText, stanceOptions, context, customPrompt)
      .replace("{content}", comment);
    console.log("Generated Prompt:", prompt);

    const response = await openRouterService.chat({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
    });

    if (!response) {
      console.error("Analysis generation failed");

      return {
        questionId,
        stanceId: null,
        confidence: null,
        extractedContent: null,
      };
    }

    const { stance, confidence, extractedContent } =
      await this.parseResponse(response);

    // confidenceが0.8未満、またはnullの場合は結果を棄却
    if (!confidence || confidence < 0.8) {
      return {
        questionId,
        stanceId: null,
        confidence: null,
        extractedContent: null,
      };
    }

    // 立場名からIDを取得
    const matchedStance = stancesWithSpecial.find((s) => s.name === stance);

    if (!matchedStance) {
      // マッチする立場が見つからない場合はnullを返す
      return {
        questionId,
        stanceId: null,
        confidence: null,
        extractedContent: null,
      };
    }

    return {
      questionId,
      stanceId: matchedStance.id,
      confidence,
      extractedContent: extractedContent,
    };
  }

  async analyzeAllStances(
    comment: string,
    questions: Array<{
      id: string;
      text: string;
      stances: Array<{ id: string; name: string }>;
    }>,
    existingStances: StanceAnalysisResult[] = [],
    context?: string,
    customPrompt?: string,
  ): Promise<StanceAnalysisResult[]> {
    // 新しい論点と既存の分析結果をマッピング
    const existingStanceMap = new Map(
      existingStances.map((stance) => [stance.questionId, stance]),
    );

    // 論点.allを維持）
    const results = await Promise.all(
      questions.map(async (question) => {
        // 既存の分析結果があれば再利用
        const existingStance = existingStanceMap.get(question.id);
        if (existingStance) {
          return existingStance;
        }

        // 新しい論点に対してのみ分析を実行
        return this.analyzeStance(
          comment,
          question.id,
          question.text,
          question.stances,
          context,
          customPrompt,
        );
      }),
    );

    return results;
  }
}

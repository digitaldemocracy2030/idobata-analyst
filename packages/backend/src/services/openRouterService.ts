import OpenAI from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { postToSlack } from "./slackService";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required in environment variables");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class OpenRouterService {
  private client: OpenAI;
  private token: string;
  private baseURL: string;
  private lastAlertTimestamp: number | undefined = undefined;

  constructor(options: { apiKey: string }) {
    this.token = options.apiKey;
    this.baseURL = "https://openrouter.ai/api/v1";
    this.client = new OpenAI({
      apiKey: this.token,
      baseURL: this.baseURL,
    });
  }

  async getRemainingCredits(): Promise<number | null> {
    const response = await fetch(`${this.baseURL}/credits`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch credits: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const json = await response.json();

    return Number(json.data.total_credits) - Number(json.data.total_usage);
  }

  async checkRemainingCredits(): Promise<void> {
    const remainingCredits = await this.getRemainingCredits();

    // credits が取得できなくても chat は止めたくない
    if (remainingCredits === null) {
      return;
    }

    const remainingCreditsAlertThreshold = 100;
    const minAlertInterval = 1000 * 60 * 60; // 1時間

    if (
      !this.lastAlertTimestamp ||
      (this.lastAlertTimestamp + minAlertInterval < Date.now() &&
        remainingCredits < remainingCreditsAlertThreshold)
    ) {
      postToSlack(
        `OpenRouterService: 残りクレジットが少なくなっています（remainingCredits: ${remainingCredits.toFixed(1)}）。OpenRouter API は残クレジットが少ないとリクエストが確率的に失敗するようになるので、早めにクレジットを追加してください`,
      );
      this.lastAlertTimestamp = Date.now();
    }
  }

  async chat(options: ChatCompletionCreateParams): Promise<string | null> {
    const max_retries = 3;

    for (let num_trials = 1; num_trials <= max_retries; num_trials++) {
      try {
        return await this.chat_internal(options);
      } catch (error: any) {
        console.log(`Error in trial ${num_trials}/${max_retries}:`, error);

        if (error?.status !== 503) {
          console.log(
            "Giving up: encountered error:",
            error?.status || "unknown error",
          );
          return null;
        }

        console.log("Received 503 error, retrying...");
        const initial_retry_delay_in_ms = 1000;
        await sleep(initial_retry_delay_in_ms * 2 ** (num_trials - 1));
      }
    }
    console.log("Giving up after retry: 503 error persists");
    return null;
  }

  private async chat_internal(
    options: ChatCompletionCreateParams,
  ): Promise<string> {
    try {
      await this.checkRemainingCredits();
      const response = await this.client.chat.completions.create(options);
      return (response as any).choices[0].message.content || "";
    } catch (error) {
      console.error("LLM API エラー:", error);
      throw error;
    }
  }
}

export const openRouterService = new OpenRouterService({
  apiKey: OPENROUTER_API_KEY,
});

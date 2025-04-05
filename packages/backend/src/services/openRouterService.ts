import crypto from "crypto";
import OpenAI from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import cacheService from "./cacheService";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY is required in environment variables");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class OpenRouterService {
  private client: OpenAI;

  constructor(options: { apiKey: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
  }

  async chat(options: ChatCompletionCreateParams): Promise<string | null> {
    const max_retries = 3;

    for (let num_trials = 1; num_trials <= max_retries; num_trials++) {
      try {
        const canonicalOptionJSON = JSON.stringify(
          options,
          (key, value) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              return Object.keys(value)
                .sort()
                .reduce<Record<string, any>>((sorted, key) => {
                  sorted[key] = value[key];
                  return sorted;
                }, {});
            }
            return value;
          },
          2,
        );
        const cacheKey = crypto
          .createHash("sha1")
          .update(canonicalOptionJSON)
          .digest("hex");

        return await cacheService.fetch(
          cacheKey,
          () => this.chat_internal(options),
          process.env.NODE_ENV === "development"
            ? 60 * 60 * 24 * 180 // 開発環境では節約のためにレスポンスを180日間キャッシュ
            : 60 * 60 * 24 * 1, // 本番環境では保守的に1日程度キャッシュ
        );
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
  baseURL: "https://openrouter.ai/api/v1",
});

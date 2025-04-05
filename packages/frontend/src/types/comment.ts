export type CommentSourceType = "youtube" | "x" | "form" | "chat" | "other";

export interface CommentStance {
  questionId: string;
  stanceId: string;
  confidence: number; // Gemini APIの判定信頼度
  extractedContent: string;
}

export interface CommentInput {
  content: string;
  sourceType?: CommentSourceType;
  sourceUrl?: string;
}

export interface CommentOptions {
  skipDuplicates?: boolean; // Whether to skip duplicate comments, defaults to true
}

export interface Comment {
  _id: string;
  content: string;
  projectId: string;
  extractedContent?: string;
  stances: CommentStance[]; // 論点
  createdAt: string;
  sourceType?: CommentSourceType;
  sourceUrl?: string;
}

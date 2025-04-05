import mongoose from "mongoose";

export type CommentSourceType = "youtube" | "x" | "form" | "other";

export interface ICommentStance {
  questionId: string;
  stanceId: string;
  confidence: number;
  extractedContent: string;
}

export interface IComment {
  content: string;
  projectId: mongoose.Types.ObjectId;
  extractedContent?: string;
  stances: ICommentStance[];
  createdAt: Date;
  sourceType?: CommentSourceType;
  sourceUrl?: string;
}

const commentStanceSchema = new mongoose.Schema<ICommentStance>({
  questionId: {
    type: String,
    required: true,
  },
  stanceId: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  extractedContent: {
    type: String,
    required: false, // XXX: 旧データとの互換性のため
  },
});

const commentSchema = new mongoose.Schema<IComment>({
  content: {
    type: String,
    required: true,
    trim: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  extractedContent: {
    type: String,
    trim: true,
  },
  stances: {
    type: [commentStanceSchema],
    required: true,
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sourceType: {
    type: String,
    enum: ["youtube", "x", "form", "chat", "other"],
    required: false,
  },
  sourceUrl: {
    type: String,
    required: false,
    trim: true,
  },
});

export const Comment = mongoose.model<IComment>("Comment", commentSchema);

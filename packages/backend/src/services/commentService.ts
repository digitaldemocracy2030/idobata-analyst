import type mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler";
import {
  Comment,
  type CommentSourceType,
  type IComment,
  type ICommentStance,
} from "../models/comment";
import { Project } from "../models/project";
import { processInBatches } from "../utils/batchProcessor";
import { extractContent } from "./extractionService";
import type { StanceAnalysisResult, StanceAnalyzer } from "./stanceAnalyzer";

export interface CommentInput {
  content: string;
  sourceType?: CommentSourceType;
  sourceUrl?: string;
}

export interface CommentOptions {
  skipDuplicates?: boolean; // Whether to skip duplicate comments, defaults to true
}

export interface CommentCreateResponse {
  comments: (mongoose.Document<unknown, object, IComment> &
    IComment & { _id: mongoose.Types.ObjectId })[];
}

export class CommentService {
  constructor(private stanceAnalyzer: StanceAnalyzer) {}

  async getProjectComments(projectId: string) {
    return await Comment.find({ projectId }).sort({ createdAt: -1 });
  }

  private filterValidStances(
    stances: StanceAnalysisResult[],
  ): ICommentStance[] {
    return stances.filter(
      (stance): stance is ICommentStance =>
        stance.stanceId !== null && stance.confidence !== null,
    );
  }

  /**
   * Check if a comment with the same content already exists in the project
   * @param projectId The project ID
   * @param content The original content to check for duplicates
   * @returns true if a duplicate exists, false otherwise
   */
  private async isDuplicateComment(
    projectId: string,
    content: string,
  ): Promise<boolean> {
    const existingComment = await Comment.findOne({
      projectId,
      content,
    });

    return !!existingComment;
  }

  async createComment(
    projectId: string,
    commentData: CommentInput,
    options?: CommentOptions,
  ): Promise<CommentCreateResponse> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "Project not found");
    }

    // Check if a comment with the same content already exists
    const isDuplicate = await this.isDuplicateComment(
      projectId,
      commentData.content,
    );
    // Skip duplicates by default unless skipDuplicates is explicitly set to false
    const shouldSkipDuplicates = options?.skipDuplicates !== false;

    if (isDuplicate && shouldSkipDuplicates) {
      // Return empty array if duplicate and we should skip duplicates
      return {
        comments: [],
      };
    }

    const extractedContents = await extractContent(
      commentData.content,
      project.extractionTopic,
      project.context,
    );

    if (!extractedContents || extractedContents.length === 0) {
      // No relevant content found, create a comment without extracted content
      const comment = new Comment({
        content: commentData.content,
        projectId,
        sourceType: commentData.sourceType || "other",
        sourceUrl: commentData.sourceUrl || "",
        stances: [],
      });

      const savedComment = await comment.save();

      return {
        comments: [savedComment],
      };
    }

    // Create comments for each extracted content
    const comments = [];

    for (const extractedContent of extractedContents) {
      const analysisResults = await this.stanceAnalyzer.analyzeAllStances(
        commentData.content,
        project.questions.map((q) => ({
          id: q.id,
          text: q.text,
          stances: q.stances,
        })),
        [], // 新規コメントなので空の配列を渡す
        project.context, // プロジェクトのcontextを渡す
      );

      const stances = this.filterValidStances(analysisResults);

      const comment = new Comment({
        content: commentData.content,
        projectId,
        extractedContent,
        stances,
        sourceType: commentData.sourceType || "other",
        sourceUrl: commentData.sourceUrl || "",
      });

      const savedComment = await comment.save();
      comments.push(savedComment);
    }

    return {
      comments, // Return all comments
    };
  }

  async bulkImportComments(
    projectId: string,
    comments: (string | CommentInput)[],
    options?: CommentOptions,
  ) {
    if (!Array.isArray(comments)) {
      throw new AppError(400, "Comments must be an array");
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "Project not found");
    }

    console.log(
      `Starting bulk import of ${comments.length} comments for project ${projectId}`,
    );
    const validComments = comments.filter((c: any) => c !== "" && !!c?.content);

    const allProcessedComments: mongoose.Document[] = [];

    await processInBatches(
      validComments,
      50,
      async (comment) => {
        const content = typeof comment === "string" ? comment : comment.content;
        const sourceType =
          typeof comment === "string" ? "other" : comment.sourceType || "other";
        const sourceUrl =
          typeof comment === "string" ? "" : comment.sourceUrl || "";

        // Skip duplicates by default unless skipDuplicates is explicitly set to false
        const shouldSkipDuplicates = options?.skipDuplicates !== false;

        // Check if a comment with the same content already exists
        const isDuplicate = await this.isDuplicateComment(projectId, content);
        if (isDuplicate && shouldSkipDuplicates) {
          // Skip this comment if it's a duplicate and we should skip duplicates
          return null;
        }

        const extractedContents = await extractContent(
          content,
          project.extractionTopic,
          project.context,
        );

        if (!extractedContents || extractedContents.length === 0) {
          // No relevant content found, create a comment without extracted content
          const newComment = new Comment({
            content,
            projectId,
            stances: [],
            sourceType,
            sourceUrl,
          });
          allProcessedComments.push(newComment);
          return null;
        }

        // Create a comment for each extracted content
        for (const extractedContent of extractedContents) {
          const analysisResults = await this.stanceAnalyzer.analyzeAllStances(
            content,
            project.questions.map((q) => ({
              id: q.id,
              text: q.text,
              stances: q.stances,
            })),
            [], // 新規コメントなので空の配列を渡す
            project.context, // プロジェクトのcontextを渡す
          );

          const stances = this.filterValidStances(analysisResults);

          const newComment = new Comment({
            content,
            projectId,
            extractedContent,
            stances,
            sourceType,
            sourceUrl,
          });

          allProcessedComments.push(newComment);
        }

        return null; // We're handling the comments manually, so return null
      },
      0,
    );

    if (allProcessedComments.length === 0) {
      return [];
    }

    return await Comment.insertMany(allProcessedComments);
  }
}

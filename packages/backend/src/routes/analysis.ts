import express from "express";
import { AppError } from "../middleware/errorHandler";
import { validateObjectId } from "../middleware/validateObjectId";
import { Comment } from "../models/comment";
import { Project } from "../models/project";
import { AnalysisService } from "../services/analysisService";
import { LlmsTxtGenerator } from "../services/llmsTxtGenerator";
import { ProjectReportGenerator } from "../services/projectReportGenerator";
import { ProjectVisualReportGenerator } from "../services/projectVisualReportGenerator";
import { StanceReportGenerator } from "../services/stanceReportGenerator";

const router = express.Router();

// サービスのインスタンスを作成
const stanceReportGenerator = new StanceReportGenerator();
const projectReportGenerator = new ProjectReportGenerator();
const projectVisualReportGenerator = new ProjectVisualReportGenerator();
const llmsTxtGenerator = new LlmsTxtGenerator();
const analysisService = new AnalysisService(
  stanceReportGenerator,
  projectReportGenerator,
  projectVisualReportGenerator,
);

// 質問ごとの立場の分析を取得
router.get(
  "/projects/:projectId/questions/:questionId/stance-analysis",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const { projectId, questionId } = req.params;
      const forceRegenerate = req.query.forceRegenerate === "true";
      const customPrompt = req.query.customPrompt as string | undefined;

      const analysis = await analysisService.analyzeStances(
        projectId,
        questionId,
        forceRegenerate,
        customPrompt,
      );

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  },
);

// プロジェクト全体の分析レポートを生成 (Markdown)
router.get(
  "/projects/:projectId/analysis",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const forceRegenerate = req.query.forceRegenerate === "true";
      const customPrompt = req.query.customPrompt as string | undefined;

      const analysis = await analysisService.generateProjectReport(
        projectId,
        forceRegenerate,
        customPrompt,
      );

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  },
);

// プロジェクト全体のビジュアル分析レポートを生成 (HTML+CSS)
router.get(
  "/projects/:projectId/visual-analysis",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const forceRegenerate = req.query.forceRegenerate === "true";
      const customPrompt = req.query.customPrompt as string | undefined;

      const analysis = await analysisService.generateProjectVisualReport(
        projectId,
        forceRegenerate,
        customPrompt,
      );

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  },
);

// プロジェクトデータをCSVとしてエクスポート
router.get(
  "/projects/:projectId/export-csv",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const csvData = await analysisService.exportProjectDataToCsv(projectId);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=project-${projectId}-export.csv`,
      );
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  },
);

// プロジェクトのLLMs.txtを生成
router.get(
  "/projects/:projectId/llms-txt",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const forceRegenerate = req.query.forceRegenerate === "true";
      
      // プロジェクトとコメントを取得
      const project = await Project.findById(projectId);
      if (!project) {
        throw new AppError(404, "Project not found");
      }
      
      const comments = await Comment.find({ projectId });
      
      // LLMs.txtを生成
      const llmsTxtResult = await llmsTxtGenerator.generateLlmsTxt(
        project,
        comments,
        forceRegenerate,
      );
      
      res.json(llmsTxtResult);
    } catch (error) {
      next(error);
    }
  },
);

// プロジェクトのLLMs.txtをテキストとして取得
router.get(
  "/projects/:projectId/llms-txt/download",
  validateObjectId("projectId"),
  async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      const type = req.query.type === "full" ? "full" : "basic";
      const forceRegenerate = req.query.forceRegenerate === "true";
      
      // プロジェクトとコメントを取得
      const project = await Project.findById(projectId);
      if (!project) {
        throw new AppError(404, "Project not found");
      }
      
      const comments = await Comment.find({ projectId });
      
      // LLMs.txtを生成
      const llmsTxtResult = await llmsTxtGenerator.generateLlmsTxt(
        project,
        comments,
        forceRegenerate,
      );
      
      const content = type === "full" ? llmsTxtResult.llmsFullTxt : llmsTxtResult.llmsTxt;
      const filename = type === "full" ? "llms-full.txt" : "llms.txt";
      
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}`,
      );
      res.send(content);
    } catch (error) {
      next(error);
    }
  },
);

export default router;

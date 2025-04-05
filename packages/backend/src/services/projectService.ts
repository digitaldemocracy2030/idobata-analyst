import { v4 as uuidv4 } from "uuid";
import { AppError } from "../middleware/errorHandler";
import { Comment } from "../models/comment";
import { type IQuestion, Project } from "../models/project";
import { processInBatches } from "../utils/batchProcessor";
import type { QuestionGenerator } from "./questionGenerator";
import type { StanceAnalyzer } from "./stanceAnalyzer";

export class ProjectService {
  constructor(
    private stanceAnalyzer: StanceAnalyzer,
    private questionGenerator: QuestionGenerator,
  ) {}

  async getAllProjects() {
    const projects = await Project.find().sort({ createdAt: -1 });
    const projectsWithCommentCount = await Promise.all(
      projects.map(async (project) => {
        const commentCount = await Comment.countDocuments({
          projectId: project._id,
        });
        return {
          ...project.toObject(),
          commentCount,
        };
      }),
    );
    return projectsWithCommentCount;
  }

  async getProjectById(projectId: string) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError(404, "Project not found");
    }
    return project;
  }

  async createProject(data: {
    name: string;
    description: string;
    extractionTopic: string;
  }) {
    const project = new Project({
      ...data,
      questions: [],
    });
    return await project.save();
  }

  async updateProject(
    projectId: string,
    data: {
      name: string;
      description: string;
      extractionTopic: string;
      questions: IQuestion[];
    },
  ) {
    const currentProject = await this.getProjectById(projectId);
    const hasQuestionsChanged =
      JSON.stringify(currentProject.questions) !==
      JSON.stringify(data.questions);

    const updatedProject = await Project.findByIdAndUpdate(projectId, data, {
      new: true,
    });

    if (hasQuestionsChanged && data.questions) {
      console.log(
        `Questions changed for project ${projectId}. Starting comment reanalysis...`,
      );
      await this.reanalyzeComments(projectId, data.questions);
    }

    return updatedProject;
  }

  async generateQuestions(projectId: string) {
    const project = await this.getProjectById(projectId);
    const comments = await Comment.find({ projectId });

    const extractedContents = comments
      .map((comment) => comment.extractedContent)
      .filter((content): content is string => content !== null);

    if (extractedContents.length === 0) {
      throw new AppError(400, "No extracted contents found in this project");
    }

    const generatedQuestions =
      await this.questionGenerator.generateQuestions(extractedContents);
    if (generatedQuestions.length === 0) {
      throw new AppError(500, "Failed to generate questions");
    }

    const formattedQuestions = generatedQuestions.map((q) => ({
      id: uuidv4(),
      text: q.text,
      stances: q.stances.map((s) => ({
        id: uuidv4(),
        name: s.name,
      })),
    }));

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { questions: formattedQuestions },
      { new: true },
    );

    await this.reanalyzeComments(projectId, formattedQuestions);
    return updatedProject;
  }

  private async reanalyzeComments(projectId: string, questions: IQuestion[]) {
    const comments = await Comment.find({ projectId });
    const commentsToAnalyze = comments.filter(
      (comment) => comment.extractedContent,
    );

    const mappedQuestions = questions.map((q) => ({
      id: q.id,
      text: q.text,
      stances: q.stances,
    }));

    await processInBatches(
      commentsToAnalyze,
      25,
      async (comment) => {
        if (!comment.extractedContent) {
          throw new AppError(400, "No extracted content found in this comment");
        }
        // 既存の立場情報を引き継ぐように修正
        const newStances = await this.stanceAnalyzer.analyzeAllStances(
          comment.content,
          mappedQuestions,
          comment.stances || [], // 既存の立場情報を渡す
        );

        await Comment.findByIdAndUpdate(comment._id, { stances: newStances });
      },
      0,
    );
  }
}

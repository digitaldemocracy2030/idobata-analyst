import axios from "axios";
import express from "express";
import { createServer } from "node:http";
import OpenAI from "openai";
import { type WebSocket, WebSocketServer } from "ws";
import { SessionManager } from "./services/SessionManager";
import type { ChatMessage, Project, WebSocketMessage } from "./types";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const sessionManager = new SessionManager();

// JSON パーサーミドルウェアを追加
app.use(express.json());

// OpenRouter APIの初期化
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error(
    "Error: OPENROUTER_API_KEY is not set in environment variables",
  );
  process.exit(1);
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
});

// バックエンドAPIの設定
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_API_KEY) {
  console.error("Error: ADMIN_API_KEY is not set in environment variables");
  process.exit(1);
}

const backendApi = axios.create({
  baseURL: process.env.BACKEND_API_URL || "http://localhost:3001/api",
  headers: {
    "x-api-key": ADMIN_API_KEY,
  },
});

// WebSocketアップグレードの処理
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url;

  // プロジェクトIDの抽出 (/project/:projectId/chat の形式)
  const match = pathname?.match(/^\/project\/([^\/]+)\/chat$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const projectId = match[1];

  wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    const session = sessionManager.createSession(projectId);
    handleConnection(ws, session.id, projectId);
  });
});

async function getProjectQuestions(
  projectId: string,
): Promise<Project["questions"]> {
  try {
    const response = await backendApi.get<Project>(`/projects/${projectId}`);
    return response.data.questions || [];
  } catch (error) {
    console.error("Error fetching project questions:", error);
    return [];
  }
}

function formatQuestionsList(questions: Project["questions"]): string {
  if (questions.length === 0) {
    return "論点はまだ設定されていません。";
  }
  return `論点一覧:\n${questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}`;
}

function formatChatHistory(history: ChatMessage[]): string {
  return history
    .map(
      (msg) =>
        `${msg.sender === "user" ? "ユーザー" : "アシスタント"}: ${msg.content}`,
    )
    .join("\n");
}

interface CommentResponse {
  comment: {
    _id: string;
    content: string;
    projectId: string;
    extractedContent: string;
    stances: Array<{
      questionId: string;
      stanceId: string;
      confidence: number;
      extractedContent: string;
    }>;
  };
  analyzedQuestions: Array<{
    id: string;
    text: string;
    stances: Array<{
      questionId: string;
      stanceId: string;
      confidence: number;
      extractedContent: string;
    }>;
  }>;
}

async function analyzeUserMessage(
  userMessage: string,
  projectId: string,
  history: ChatMessage[],
): Promise<{
  commentId?: string;
  relatedQuestions?: Array<{
    id: string;
    text: string;
    stance: {
      stanceId: string;
      confidence: number;
      extractedContent: string;
    };
  }>;
}> {
  try {
    // 会話履歴を含めてユーザーの発言を分析
    const messages = [
      {
        role: "user",
        parts: [
          {
            text: `
以下の会話履歴とユーザーの最新の発言を分析し、厳密なJSON形式で返答してください。余分な説明は不要です。

会話履歴：
${formatChatHistory(history.slice(-5))}

最新の発言：
${userMessage}

必要な分析：
最新の発言の主張を、会話の文脈を踏まえて整理し、以下のJSON形式で返してください。
主張が明確な場合：{"hasContent":true,"content":"文脈を考慮して整理された内容"}
主張が不明確/存在しない場合(例:挨拶,あいずち等)：{"hasContent":false}

注意：
- 返答は必ず上記のJSON形式のみとし、説明文や改行を含めないでください
- JSON内の文字列は必ずダブルクォートで囲んでください
- 最新の発言のみを分析対象とし、会話履歴は文脈理解のために使用してください
- できる限り具体的に細部まで主張の内容を記述してください。
`,
          },
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: messages[0].parts[0].text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    // レスポンステキストをクリーンアップしてJSONとしてパース
    let responseText = completion.choices[0].message.content?.trim() || "";

    // マークダウンのコードブロック構文を削除 (```json や ``` で囲まれている場合)
    responseText = responseText
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");

    let analysisResult: any;
    try {
      analysisResult = JSON.parse(responseText);
      if (typeof analysisResult.hasContent !== "boolean") {
        throw new Error(
          "Invalid response format: hasContent must be a boolean",
        );
      }
      if (
        analysisResult.hasContent &&
        typeof analysisResult.content !== "string"
      ) {
        throw new Error(
          "Invalid response format: content must be a string when hasContent is true",
        );
      }
    } catch (error) {
      console.error("Error parsing LLM response:", error);
      console.error("Raw response:", responseText);
      return {};
    }

    if (!analysisResult.hasContent) {
      return {};
    }

    // 整理された内容をバックエンドに送信
    const commentResponse = await backendApi.post<CommentResponse>(
      `/projects/${projectId}/comments`,
      {
        content: analysisResult.content,
        sourceType: "chat",
        sourceUrl: null,
      },
    );

    // 分析された論点と立場の情報を整形
    const relatedQuestions = commentResponse.data.analyzedQuestions
      .map(
        (q: {
          id: string;
          text: string;
          stances: Array<{
            questionId: string;
            stanceId: string;
            confidence: number;
            extractedContent: string;
          }>;
        }) => {
          const stance = q.stances[0]; // 最も確信度の高い立場を使用
          if (!stance) return null;
          return {
            id: q.id,
            text: q.text,
            stance: {
              stanceId: stance.stanceId,
              confidence: stance.confidence,
              extractedContent: stance.extractedContent,
            },
          };
        },
      )
      .filter((q: any): q is NonNullable<typeof q> => q !== null); // 立場が特定された論点のみを返す

    return {
      commentId: commentResponse.data.comment._id,
      relatedQuestions:
        relatedQuestions.length > 0 ? relatedQuestions : undefined,
    };
  } catch (error) {
    console.error("Error analyzing user message:", error);
    return {};
  }
}

async function generateResponse(
  userMessage: string,
  projectId: string,
  questions: Project["questions"],
  history: ChatMessage[],
): Promise<string> {
  try {
    // ユーザーメッセージを分析
    const analysis = await analyzeUserMessage(userMessage, projectId, history);
    let contextualInfo = "";

    if (analysis.relatedQuestions && analysis.relatedQuestions.length > 0) {
      // 最も確信度の高い論点を選択
      const primaryQuestion = analysis.relatedQuestions.reduce(
        (prev, current) =>
          current.stance.confidence > prev.stance.confidence ? current : prev,
      );

      // 関連する論点の分析レポートを取得
      try {
        const reportResponse = await backendApi.get(
          `/projects/${projectId}/questions/${primaryQuestion.id}/stance-analysis`,
        );
        contextualInfo = `
選択された論点「${primaryQuestion.text}」に関する分析レポート：
${JSON.stringify(reportResponse.data, null, 2)}

あなたの立場: ${primaryQuestion.stance.stanceId}
確信度: ${(primaryQuestion.stance.confidence * 100).toFixed(1)}%
`;
      } catch (error) {
        console.error("Error fetching stance analysis:", error);
      }
    }

    const messages = [];

    // システムプロンプトを追加
    messages.push({
      role: "user",
      parts: [
        {
          text: `
あなたは議論を深めるための議論相手です。以下の論点に基づいて、ユーザーの発言を分析し、
適切な論点に誘導しながら建設的な議論を展開してください。

【論点一覧】
${questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}

${contextualInfo ? contextualInfo : ""}

以下の点を意識して返答を生成してください：
1. ユーザーの発言が論点のいずれかに関連している場合：
   - 分析レポートを参考に、ユーザーと異なる立場からの意見を提示
   - ユーザーと異なる立場の根拠や具体例を示しながら、建設的な議論を展開
2. ユーザーの発言が論点から外れている場合：
   - 最も関連性の高い論点に誘導
   - その論点が重要である理由や、議論する価値を説明
3. 常に建設的で具体的な議論となるよう導く

回答の長さや温度感は、相手に完全に合わせて回答を生成してください。長さは最大でも2~3文.

重要指示：初対面の人との自然な会話のように、温かくて親しみやすい口調で返答してください。感情を込めた表現は歓迎しますが、絵文字の使用は避けてください。
`,
        },
      ],
    });

    // チャット履歴を追加
    for (const msg of history.slice(-5)) {
      // 直近5件のみ使用
      messages.push({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // 最新のユーザーメッセージを追加
    messages.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // OpenAI形式のメッセージに変換
    const openaiMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];

    // システムプロンプトを追加
    openaiMessages.push({
      role: "system",
      content: messages[0].parts[0].text,
    });

    // チャット履歴を追加
    for (let i = 1; i < messages.length; i++) {
      openaiMessages.push({
        role: messages[i].role === "user" ? "user" : "assistant",
        content: messages[i].parts[0].text,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: openaiMessages,
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 1024,
    });

    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating response:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      if ("status" in error) {
        console.error("Status:", (error as any).status);
      }
    }
    return "すみません、応答の生成中にエラーが発生しました。APIキーの設定や権限を確認してください。";
  }
}

async function handleConnection(
  ws: WebSocket,
  sessionId: string,
  projectId: string,
) {
  console.log(
    `New connection established for project: ${projectId}, session: ${sessionId}`,
  );

  ws.on("message", async (data: string) => {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Handle ping messages to keep connection alive
      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (message.type === "message") {
        if (!message.content) {
          ws.send(JSON.stringify({ error: "Message content is required" }));
          return;
        }

        // ユーザーメッセージを保存
        const userMessage = sessionManager.addMessage(
          sessionId,
          message.content,
          "user",
        );
        if (!userMessage) {
          ws.send(JSON.stringify({ error: "Session not found" }));
          return;
        }

        const session = sessionManager.getSession(sessionId);
        if (!session) {
          ws.send(JSON.stringify({ error: "Session not found" }));
          return;
        }

        let response: string;

        // "questions"コマンドの処理
        if (message.content.toLowerCase() === "questions") {
          const questions = await getProjectQuestions(projectId);
          response = formatQuestionsList(questions);
        } else {
          // Gemini APIを使用して応答を生成
          const questions = await getProjectQuestions(projectId);
          response = await generateResponse(
            message.content,
            projectId,
            questions,
            session.history,
          );
        }

        // ボットの応答を保存して送信
        const botMessage = sessionManager.addMessage(
          sessionId,
          response,
          "bot",
        );
        ws.send(
          JSON.stringify({
            type: "message",
            message: botMessage,
          }),
        );
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log(`Connection closed for session: ${sessionId}`);
  });

  ws.on("error", (error: Error) => {
    console.error(`WebSocket error in session ${sessionId}:`, error);
  });
}

// REST API エンドポイント: 過去ログと新規コメントを受け取って回答を返す
interface ChatRequest {
  projectId: string;
  newComment: string;
  pastLogs: ChatMessage[];
}

app.post("/api/chat", async (req, res) => {
  try {
    const { projectId, newComment, pastLogs } = req.body as ChatRequest;

    if (!projectId || !newComment) {
      return res
        .status(400)
        .json({ error: "projectId and newComment are required" });
    }

    // プロジェクトの論点を取得
    const questions = await getProjectQuestions(projectId);

    // 応答を生成
    const response = await generateResponse(
      newComment,
      projectId,
      questions,
      pastLogs || [],
    );

    return res.json({
      response,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`Chat bot server is running on port ${PORT}`);
});

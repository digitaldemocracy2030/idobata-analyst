import https from "node:https";

const webhookUrl = process.env.SLACK_WEBHOOK_URL_LOGGING;
const isDevelopment = process.env.NODE_ENV === "development";

export const postToSlack = async (message: string): Promise<void> => {
  if (isDevelopment) {
    // development 環境ではログを出力するだけ
    console.log(`slackService: ${message}`);
    return;
  }

  if (!webhookUrl) {
    throw new Error(
      "SLACK_WEBHOOK_URL_LOGGING is not defined in environment variables.",
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const url = new URL(webhookUrl);
      const data = JSON.stringify({ text: message });

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Request failed with status code ${res.statusCode}: ${responseData}`,
              ),
            );
          }
        });
      });

      req.on("error", (error) => {
        console.error("Failed to post to Slack:", error);
        reject(error);
      });

      req.write(data);
      req.end();
    } catch (error) {
      console.error("Failed to post to Slack:", error);
      reject(error);
    }
  });
};

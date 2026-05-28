import "../utils/env.js";
import OpenAI from "openai";
import { makeHttpError } from "../utils/http.js";

const DEFAULT_MODEL =
  process.env.OPENAI_MODEL || "llama-3.3-70b-versatile";

const DEFAULT_JUDGE_MODEL =
  process.env.OPENAI_JUDGE_MODEL || "llama3-8b-8192";

let openaiClient;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw makeHttpError(500, "OPENAI_API_KEY is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL
    });
  }

  return openaiClient;
}

export async function generateTextWithOpenAI({
  promptText,
  model = DEFAULT_MODEL
}) {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: promptText
        }
      ],
      temperature: 0.7
    });

    const outputText =
      response.choices?.[0]?.message?.content?.trim() || "";

    if (!outputText) {
      throw makeHttpError(502, "Model returned an empty response");
    }

    return {
      outputText,
      model: response.model || model,
      responseId: response.id
    };
  } catch (error) {
    console.error(error);

    if (error.status) {
      throw makeHttpError(
        502,
        `AI request failed: ${error.message}`
      );
    }

    throw makeHttpError(502, "AI request failed", {
      cause: error.message
    });
  }
}

export async function judgeWithOpenAI({
  judgePrompt,
  model = DEFAULT_JUDGE_MODEL
}) {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an AI judge. Return a JSON object with score and reasoning."
        },
        {
          role: "user",
          content: judgePrompt
        }
      ],
      temperature: 0
    });

    const outputText =
      response.choices?.[0]?.message?.content?.trim() || "";

    if (!outputText) {
      throw makeHttpError(
        502,
        "Judge model returned an empty response"
      );
    }

    return {
      outputText,
      model: response.model || model,
      responseId: response.id
    };
  } catch (error) {
    console.error(error);

    if (error.status) {
      throw makeHttpError(
        502,
        `Judge request failed: ${error.message}`
      );
    }

    throw makeHttpError(502, "Judge request failed", {
      cause: error.message
    });
  }
}

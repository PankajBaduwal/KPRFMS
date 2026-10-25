import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

/**
 * Minimal Google Gemini client (REST generateContent). Every AI feature goes through here, so
 * the key, model fallback, timeouts and error messages live in one place.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 45_000;

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/** JSON schema in the subset Gemini accepts (OpenAPI 3 style). */
export interface GeminiSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
  nullable?: boolean;
}

interface GenerateOptions {
  system: string;
  parts: GeminiPart[];
  /** When set, the reply is forced to JSON matching this schema */
  schema?: GeminiSchema;
  temperature?: number;
  maxOutputTokens?: number;
}

export function isAiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

function assertEnabled() {
  if (!isAiEnabled()) {
    throw new AppError('AI features are not set up. Add GEMINI_API_KEY to server/.env.', 503, 'AI_DISABLED');
  }
}

/** Errors worth retrying on the fallback model: overload, rate limit, server error, timeout. */
class RetryableError extends Error {}

async function callModel(model: string, options: GenerateOptions): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: options.system }] },
    contents: [{ role: 'user', parts: options.parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      // Newer models spend part of this budget on internal reasoning, so keep it generous
      maxOutputTokens: options.maxOutputTokens ?? 16384,
      ...(options.schema ? { responseMimeType: 'application/json', responseSchema: options.schema } : {}),
    },
  };

  let res: globalThis.Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new RetryableError(`Gemini (${model}) did not respond: ${(error as Error).message}`);
  }

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message = data?.error?.message || `HTTP ${res.status}`;
    if ([429, 500, 502, 503, 504].includes(res.status)) throw new RetryableError(`Gemini (${model}): ${message}`);
    if (res.status === 400 && /api key/i.test(message)) {
      throw new AppError('The AI key is invalid. Check GEMINI_API_KEY in server/.env.', 503, 'AI_KEY_INVALID');
    }
    if (res.status === 403) throw new AppError('The AI key is not allowed to use this model.', 503, 'AI_FORBIDDEN');
    throw new AppError(`The AI service rejected the request: ${message}`, 502, 'AI_ERROR');
  }

  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS' && options.schema) {
    throw new AppError('The AI answer was too long and got cut off. Try a smaller selection.', 502, 'AI_TOO_LONG');
  }
  const text = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (!text) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'empty reply';
    throw new AppError(`The AI could not produce an answer (${reason}). Try again or rephrase.`, 502, 'AI_EMPTY');
  }
  return text;
}

async function generate(options: GenerateOptions): Promise<string> {
  assertEnabled();
  const models = [...new Set([env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter(Boolean))];
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      return await callModel(model, options);
    } catch (error) {
      if (!(error instanceof RetryableError)) throw error;
      lastError = error;
      logger.warn(error.message);
    }
  }
  throw new AppError(
    'The AI service is busy right now. Please try again in a minute.',
    503,
    'AI_BUSY',
    lastError ? [{ message: lastError.message }] : undefined
  );
}

export const gemini = {
  async text(options: Omit<GenerateOptions, 'schema'>): Promise<string> {
    return generate(options);
  },

  async json<T>(options: GenerateOptions & { schema: GeminiSchema }): Promise<T> {
    const raw = await generate(options);
    try {
      return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
    } catch {
      throw new AppError('The AI returned an unreadable answer. Please try again.', 502, 'AI_BAD_JSON');
    }
  },
};

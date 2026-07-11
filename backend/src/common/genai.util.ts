import { ConfigService } from '@nestjs/config';

/**
 * Resolves how to reach Gemini: Vertex AI (gcloud ADC — no API key) or the
 * Gemini Developer API (API key). Vertex takes precedence when enabled so the
 * app can run purely on Google Cloud credentials.
 *
 * Vertex:  GEMINI_USE_VERTEX=true + GOOGLE_CLOUD_PROJECT (+ GOOGLE_CLOUD_LOCATION),
 *          auth via ADC (gcloud auth application-default login, or a service
 *          account in GOOGLE_APPLICATION_CREDENTIALS on the server).
 * API key: GEMINI_API_KEY / GOOGLE_API_KEY.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export interface ResolvedGenAI {
  configured: boolean;
  mode: 'vertex' | 'apikey' | 'none';
  model: string;
  /** Lazily build a GoogleGenAI client for the resolved mode. */
  create: () => Promise<any>;
}

export function resolveGenAI(config: ConfigService): ResolvedGenAI {
  const model = config.get<string>('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
  const useVertex =
    (config.get<string>('GEMINI_USE_VERTEX') ??
      config.get<string>('GOOGLE_GENAI_USE_VERTEXAI') ??
      'false') === 'true';
  const project = config.get<string>('GOOGLE_CLOUD_PROJECT');
  const location = config.get<string>('GOOGLE_CLOUD_LOCATION') ?? 'us-central1';
  const apiKey =
    config.get<string>('GEMINI_API_KEY') ?? config.get<string>('GOOGLE_API_KEY');

  if (useVertex && project) {
    return {
      configured: true,
      mode: 'vertex',
      model,
      create: async () => {
        const { GoogleGenAI } = await import('@google/genai');
        return new GoogleGenAI({ vertexai: true, project, location });
      },
    };
  }
  if (apiKey) {
    return {
      configured: true,
      mode: 'apikey',
      model,
      create: async () => {
        const { GoogleGenAI } = await import('@google/genai');
        return new GoogleGenAI({ apiKey });
      },
    };
  }
  return {
    configured: false,
    mode: 'none',
    model,
    create: async () => {
      throw new Error(
        'Gemini not configured: set GEMINI_USE_VERTEX=true + GOOGLE_CLOUD_PROJECT (ADC) or GEMINI_API_KEY.',
      );
    },
  };
}

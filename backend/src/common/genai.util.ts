import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Resolves how to reach Gemini and exposes a single `generate()` that returns
 * text. Two modes:
 *
 * - **vertex** (default on Google Cloud): calls the Vertex AI REST API with a
 *   bearer access token — no API key. Token source: `GOOGLE_ACCESS_TOKEN`
 *   (injected by the deploy script) or, as a fallback, `gcloud auth
 *   print-access-token` (cached). Needs `GOOGLE_CLOUD_PROJECT` and
 *   `GOOGLE_CLOUD_LOCATION` (use `global` for gemini-2.5 models).
 * - **apikey**: the `@google/genai` SDK with `GEMINI_API_KEY`.
 *
 * Everything degrades gracefully — callers catch a throw and fall back.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_LOCATION = 'global';

export interface GenerateRequest {
  systemInstruction?: string;
  contents: unknown[];
  tools?: unknown[];
}

export interface ResolvedGenAI {
  configured: boolean;
  mode: 'vertex' | 'apikey' | 'none';
  model: string;
  generate(req: GenerateRequest): Promise<string>;
}

// Access-token cache (Vertex). gcloud tokens last ~1h; refresh at ~50m.
let tokenCache: { value: string; expiresAt: number } | null = null;

async function getVertexAccessToken(config: ConfigService): Promise<string> {
  const envToken =
    config.get<string>('GOOGLE_ACCESS_TOKEN') || process.env.GOOGLE_ACCESS_TOKEN;
  if (envToken) return envToken.trim();

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.value;

  // Fallback: mint one from the local gcloud (dev host / any host with gcloud).
  const { stdout } = await execFileAsync('gcloud', ['auth', 'print-access-token'], {
    timeout: 15000,
  });
  const token = stdout.trim();
  tokenCache = { value: token, expiresAt: now + 50 * 60 * 1000 };
  return token;
}

function vertexHost(location: string): string {
  return location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;
}

async function vertexGenerate(
  config: ConfigService,
  project: string,
  location: string,
  model: string,
  req: GenerateRequest,
): Promise<string> {
  const token = await getVertexAccessToken(config);
  const url = `https://${vertexHost(location)}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const body: Record<string, unknown> = { contents: req.contents };
  if (req.systemInstruction) {
    body.systemInstruction = { parts: [{ text: req.systemInstruction }] };
  }
  if (req.tools) body.tools = req.tools;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex ${res.status}: ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p: any) => p?.text ?? '')
    .join('')
    .trim();
}

export function resolveGenAI(config: ConfigService): ResolvedGenAI {
  const model = config.get<string>('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
  const useVertex =
    (config.get<string>('GEMINI_USE_VERTEX') ??
      config.get<string>('GOOGLE_GENAI_USE_VERTEXAI') ??
      'false') === 'true';
  const project = config.get<string>('GOOGLE_CLOUD_PROJECT');
  const location =
    config.get<string>('GOOGLE_CLOUD_LOCATION') ?? DEFAULT_GEMINI_LOCATION;
  const apiKey =
    config.get<string>('GEMINI_API_KEY') ?? config.get<string>('GOOGLE_API_KEY');

  if (useVertex && project) {
    return {
      configured: true,
      mode: 'vertex',
      model,
      generate: (req) => vertexGenerate(config, project, location, model, req),
    };
  }
  if (apiKey) {
    return {
      configured: true,
      mode: 'apikey',
      model,
      generate: async (req) => {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const cfg: Record<string, unknown> = {};
        if (req.systemInstruction) cfg.systemInstruction = req.systemInstruction;
        if (req.tools) cfg.tools = req.tools;
        const r = await ai.models.generateContent({
          model,
          contents: req.contents as never,
          config: cfg,
        });
        return (r.text ?? '').trim();
      },
    };
  }
  return {
    configured: false,
    mode: 'none',
    model,
    generate: async () => {
      throw new Error(
        'Gemini not configured: set GEMINI_USE_VERTEX=true + GOOGLE_CLOUD_PROJECT (Vertex) or GEMINI_API_KEY.',
      );
    },
  };
}

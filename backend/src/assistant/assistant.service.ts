import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveGenAI } from '../common/genai.util';
import {
  MetadataSnapshotService,
  Snapshot,
} from './metadata-snapshot.service';

/** One turn of the conversation as sent by the client. */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatResult {
  reply: string;
  grounded: boolean;
  snapshotAt: string;
  configured: boolean;
}

const NOT_CONFIGURED_PREFIX =
  'Asisten belum dikonfigurasi (aktifkan Vertex/gcloud atau set GEMINI_API_KEY). Berikut ringkasan data terkini.';

/**
 * Pengurus-facing cooperative chatbot. Grounds Google Gemini on the maintained
 * metadata snapshot and, crucially for a live demo, always degrades gracefully:
 * a missing API key or any Gemini error yields a deterministic snapshot summary
 * instead of throwing to the caller.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly snapshots: MetadataSnapshotService,
    private readonly config: ConfigService,
  ) {}

  /** Passthrough for the read-only panel showing the current grounding data. */
  getSnapshot(): Promise<Snapshot> {
    return this.snapshots.getSnapshot();
  }

  async chat(history: ChatTurn[]): Promise<ChatResult> {
    const snapshot = await this.snapshots.getSnapshot();
    const snapshotAt = snapshot.generatedAt;

    const genai = resolveGenAI(this.config);

    if (!genai.configured) {
      return {
        reply: `${NOT_CONFIGURED_PREFIX}\n\n${this.summarize(snapshot)}`,
        grounded: false,
        snapshotAt,
        configured: false,
      };
    }

    const grounded =
      this.config.get<string>('ASSISTANT_WEB_GROUNDING') === 'true';

    try {
      const ai = await genai.create();
      const model = genai.model;

      const config: Record<string, unknown> = {
        systemInstruction: this.systemInstruction(snapshot),
      };
      if (grounded) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model,
        contents: this.mapHistory(history),
        config,
      });

      const reply = this.extractText(response).trim();
      if (!reply) {
        this.logger.warn('assistant_fallback: Gemini returned empty text');
        return this.degrade(snapshot, snapshotAt);
      }

      return { reply, grounded, snapshotAt, configured: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`assistant_fallback: Gemini call failed: ${message}`);
      return this.degrade(snapshot, snapshotAt);
    }
  }

  /** Configured but the live call failed → still answer from the snapshot. */
  private degrade(snapshot: Snapshot, snapshotAt: string): ChatResult {
    return {
      reply: this.summarize(snapshot),
      grounded: false,
      snapshotAt,
      configured: true,
    };
  }

  /** System prompt: the full snapshot as JSON plus strict grounding guardrails. */
  private systemInstruction(snapshot: Snapshot): string {
    return [
      'You are the RantaiRenteng cooperative assistant.',
      'Answer ONLY from this data; if unknown, say so.',
      `Data as of ${snapshot.generatedAt}.`,
      'Never invent numbers.',
      '',
      'DATA SNAPSHOT (JSON):',
      JSON.stringify(snapshot),
    ].join('\n');
  }

  /** Map client turns into @google/genai `contents`. */
  private mapHistory(history: ChatTurn[]): Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }> {
    return (history ?? []).map((turn) => ({
      role: turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(turn.text ?? '') }],
    }));
  }

  /** Pull text out of a @google/genai response defensively. */
  private extractText(r: any): string {
    if (!r) return '';
    if (typeof r.text === 'string') return r.text;
    if (typeof r.text === 'function') {
      try {
        return String(r.text());
      } catch {
        /* fall through */
      }
    }
    const parts = r?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map((p: any) => p?.text ?? '').join('');
    }
    return '';
  }

  /** Deterministic human summary of the key aggregates (grounding fallback). */
  private summarize(snapshot: Snapshot): string {
    const a = snapshot.aggregates;
    const kyc = a.members.byStatusKyc;
    return [
      `Ringkasan data koperasi (per ${snapshot.generatedAt}):`,
      `- Anggota: ${a.members.total} total (KYC Approved: ${
        kyc.Approved ?? 0
      }, Requested: ${kyc.Requested ?? 0}, Rejected: ${kyc.Rejected ?? 0}).`,
      `- Pinjaman: ${a.loans.total} total.`,
      `- Simpanan: total ${a.savings.total} (pokok ${a.savings.totalPokok}, wajib ${a.savings.totalWajib}, sukarela ${a.savings.totalSukarela}).`,
      `- Kas sosial kelompok: ${a.groups.totalKasSosial}.`,
      `- Kejadian tanggung-renteng: ${a.rentengEvents.total}.`,
      `- Catatan audit: ${a.audit.total}.`,
    ].join('\n');
  }
}

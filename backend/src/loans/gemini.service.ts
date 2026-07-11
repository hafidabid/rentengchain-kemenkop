import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveGenAI } from '../common/genai.util';

export type RiskFlag = 'HIJAU' | 'KUNING' | 'MERAH';

/** Member/group profile the EWS scores. */
export interface ScreenInput {
  skorKeanggotaan: number;
  isDorman: boolean;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  kehadiranRate: number;
  tujuan: string;
  nominal?: number;
}

export interface ScreenResult {
  skorAi: number;
  flagAi: RiskFlag;
  flagAlasan: string[];
}

/**
 * Live AI Early-Warning System. Calls Gemini via `@google/genai` to score a
 * loan applicant's risk, and — CRUCIALLY for a live demo — degrades to a
 * deterministic, profile-derived fallback on any error, missing key, or
 * unparseable output, so a flaky network can never break the flow. A dormant,
 * low-score profile (persona Ani) always yields MERAH in the fallback.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly config: ConfigService) {}

  async screen(input: ScreenInput): Promise<ScreenResult> {
    const genai = resolveGenAI(this.config);

    if (!genai.configured) {
      this.logger.warn('fallback_used: Gemini not configured (Vertex/ADC or API key)');
      return this.fallback(input);
    }

    try {
      const text = await genai.generate({
        contents: [
          { role: 'user', parts: [{ text: this.buildPrompt(input) }] },
        ],
      });
      const parsed = this.parseJson(text);
      if (!parsed) {
        this.logger.warn('fallback_used: Gemini returned unparseable output');
        return this.fallback(input);
      }
      const normalized = this.normalize(parsed);
      if (!normalized) {
        this.logger.warn('fallback_used: Gemini output failed validation');
        return this.fallback(input);
      }
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`fallback_used: Gemini call failed: ${message}`);
      return this.fallback(input);
    }
  }

  private buildPrompt(input: ScreenInput): string {
    const savings =
      input.simpananPokok + input.simpananWajib + input.simpananSukarela;
    return [
      'Anda adalah sistem penilai risiko (Early-Warning System) untuk koperasi simpan pinjam.',
      'Nilai risiko pengajuan pinjaman anggota berikut dan balas HANYA dengan JSON valid,',
      'tanpa penjelasan tambahan dan tanpa pembungkus markdown.',
      'Format JSON: {"skorAi": <angka 0-100>, "flagAi": "HIJAU|KUNING|MERAH", "flagAlasan": ["alasan singkat", ...]}',
      'skorAi tinggi = risiko rendah. HIJAU = aman, KUNING = perlu ditinjau, MERAH = risiko tinggi.',
      '',
      'Profil anggota:',
      `- Skor keanggotaan: ${input.skorKeanggotaan}`,
      `- Status dorman (tidak aktif): ${input.isDorman ? 'ya' : 'tidak'}`,
      `- Total simpanan: ${savings}`,
      `- Tingkat kehadiran kelompok: ${input.kehadiranRate}%`,
      `- Tujuan pinjaman: ${input.tujuan}`,
      input.nominal !== undefined ? `- Nominal pinjaman: ${input.nominal}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** Strip code fences and parse the first {...} block. Returns null on failure. */
  private parseJson(text: string): any | null {
    if (!text) return null;
    let s = text.trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  /** Validate + clamp a parsed model result. Returns null if unusable. */
  private normalize(parsed: any): ScreenResult | null {
    const flag = String(parsed?.flagAi ?? '').toUpperCase();
    if (flag !== 'HIJAU' && flag !== 'KUNING' && flag !== 'MERAH') return null;

    const raw = Number(parsed?.skorAi);
    if (!Number.isFinite(raw)) return null;
    const skorAi = Math.max(0, Math.min(100, Math.round(raw)));

    let alasan = parsed?.flagAlasan;
    if (!Array.isArray(alasan)) alasan = alasan ? [alasan] : [];
    alasan = alasan.map((a: unknown) => String(a)).filter((a: string) => a.length > 0);
    if (alasan.length === 0) alasan = ['Penilaian AI tanpa alasan spesifik'];

    return { skorAi, flagAi: flag as RiskFlag, flagAlasan: alasan };
  }

  /**
   * Deterministic, profile-derived result used whenever the live call cannot be
   * trusted. Dormant or low membership-score → MERAH (skor 38); mid → KUNING;
   * healthy → HIJAU.
   */
  private fallback(input: ScreenInput): ScreenResult {
    const reasons: string[] = [];
    const lowScore = input.skorKeanggotaan < 50;
    const totalSavings =
      input.simpananPokok + input.simpananWajib + input.simpananSukarela;

    if (input.isDorman) {
      reasons.push('Anggota berstatus dorman (tidak aktif menabung pada periode terakhir)');
    }
    if (lowScore) {
      reasons.push(`Skor keanggotaan rendah (${input.skorKeanggotaan})`);
    }
    if (input.kehadiranRate < 60) {
      reasons.push(`Tingkat kehadiran kelompok rendah (${input.kehadiranRate}%)`);
    }
    if (totalSavings < 100000) {
      reasons.push('Riwayat simpanan minim');
    }

    if (input.isDorman || lowScore) {
      if (reasons.length === 0) {
        reasons.push('Profil berisiko tinggi berdasarkan data keanggotaan');
      }
      return { skorAi: 38, flagAi: 'MERAH', flagAlasan: reasons };
    }

    if (input.skorKeanggotaan < 70 || input.kehadiranRate < 80) {
      return {
        skorAi: 62,
        flagAi: 'KUNING',
        flagAlasan:
          reasons.length > 0
            ? reasons
            : ['Sebagian indikator keanggotaan di bawah ideal; perlu ditinjau'],
      };
    }

    return {
      skorAi: 82,
      flagAi: 'HIJAU',
      flagAlasan: [
        'Anggota aktif dengan skor keanggotaan sehat',
        'Riwayat simpanan dan kehadiran kelompok baik',
      ],
    };
  }
}

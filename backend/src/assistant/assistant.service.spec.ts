import { ConfigService } from '@nestjs/config';
import { AssistantService } from './assistant.service';
import {
  MetadataSnapshotService,
  Snapshot,
} from './metadata-snapshot.service';

// Mock the @google/genai SDK. `mockGenerateContent` is prefixed `mock` so the
// jest.mock factory (hoisted above imports) may reference it.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const SNAPSHOT: Snapshot = {
  generatedAt: '2026-07-11T10:00:00.000Z',
  schema: 'members, loans, ...',
  aggregates: {
    members: {
      total: 42,
      byStatusKyc: { Approved: 30, Requested: 10, Rejected: 2 },
      byPeran: { penabung: 20, peminjam: 12, keduanya: 10 },
      byRole: { Anggota: 40, Pengurus: 2 },
    },
    loans: {
      total: 15,
      byFlagAi: { HIJAU: 10, KUNING: 3, MERAH: 2 },
      byStatus: { Cair: 8, Lunas: 7 },
      byStatusCicilan: { PAID: 12, UNPAID: 3 },
    },
    savings: {
      totalPokok: 1000000,
      totalWajib: 500000,
      totalSukarela: 250000,
      total: 1750000,
    },
    groups: { totalKasSosial: 300000 },
    rentengEvents: { total: 4 },
    audit: { total: 88 },
  },
};

describe('AssistantService', () => {
  let snapshots: { getSnapshot: jest.Mock };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    snapshots = { getSnapshot: jest.fn().mockResolvedValue(SNAPSHOT) };
  });

  const make = (get: jest.Mock) => {
    const config = { get } as unknown as ConfigService;
    return new AssistantService(
      snapshots as unknown as MetadataSnapshotService,
      config,
    );
  };

  it('no key → configured:false, summary reply with snapshot numbers, no network', async () => {
    const service = make(jest.fn().mockReturnValue(undefined));

    const result = await service.chat([{ role: 'user', text: 'berapa anggota?' }]);

    expect(result.configured).toBe(false);
    expect(result.grounded).toBe(false);
    expect(result.snapshotAt).toBe(SNAPSHOT.generatedAt);
    expect(result.reply).toContain('GEMINI_API_KEY');
    // Contains real snapshot numbers.
    expect(result.reply).toContain('42');
    expect(result.reply).toContain('1750000');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('with key → configured:true and returns the Gemini reply text', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Ada 42 anggota terdaftar.' });
    const service = make(
      jest.fn((key: string) =>
        key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
      ),
    );

    const result = await service.chat([{ role: 'user', text: 'hi' }]);

    expect(result.configured).toBe(true);
    expect(result.reply).toBe('Ada 42 anggota terdaftar.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('web grounding enabled → grounded:true and googleSearch tool passed', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'jawaban' });
    const service = make(
      jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-key';
        if (key === 'ASSISTANT_WEB_GROUNDING') return 'true';
        return undefined;
      }),
    );

    const result = await service.chat([{ role: 'user', text: 'hi' }]);

    expect(result.grounded).toBe(true);
    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.config.tools).toEqual([{ googleSearch: {} }]);
  });

  it('Gemini error → degrades to snapshot summary, still configured:true', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network down'));
    const service = make(
      jest.fn((key: string) =>
        key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
      ),
    );

    const result = await service.chat([{ role: 'user', text: 'hi' }]);

    expect(result.configured).toBe(true);
    expect(result.grounded).toBe(false);
    expect(result.reply).toContain('42');
  });

  it('getSnapshot() passes through to the snapshot service', async () => {
    const service = make(jest.fn().mockReturnValue(undefined));
    await expect(service.getSnapshot()).resolves.toBe(SNAPSHOT);
    expect(snapshots.getSnapshot).toHaveBeenCalled();
  });
});

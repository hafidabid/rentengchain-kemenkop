import { GeminiService, ScreenInput } from './gemini.service';

// Mock the @google/genai SDK. `mockGenerateContent` is prefixed `mock` so the
// jest.mock factory (hoisted above imports) may reference it.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('GeminiService', () => {
  let config: { get: jest.Mock };

  const healthy: ScreenInput = {
    skorKeanggotaan: 88,
    isDorman: false,
    simpananPokok: 500000,
    simpananWajib: 200000,
    simpananSukarela: 100000,
    kehadiranRate: 96,
    tujuan: 'modal usaha warung',
    nominal: 1000000,
  };

  // Persona Ani: dormant, low membership score.
  const ani: ScreenInput = {
    skorKeanggotaan: 45,
    isDorman: true,
    simpananPokok: 50000,
    simpananWajib: 0,
    simpananSukarela: 0,
    kehadiranRate: 55,
    tujuan: 'kebutuhan mendesak',
    nominal: 2000000,
  };

  const mid: ScreenInput = {
    skorKeanggotaan: 64,
    isDorman: false,
    simpananPokok: 150000,
    simpananWajib: 50000,
    simpananSukarela: 0,
    kehadiranRate: 72,
    tujuan: 'tambahan modal',
  };

  beforeEach(() => {
    mockGenerateContent.mockReset();
    config = { get: jest.fn().mockReturnValue(undefined) };
  });

  const make = () => new GeminiService(config as any);

  // --- Fallback (no key / network never touched) ---
  it('falls back to MERAH (skor 38) for a dormant low-score profile (Ani)', async () => {
    const result = await make().screen(ani);
    expect(result.flagAi).toBe('MERAH');
    expect(result.skorAi).toBe(38);
    expect(result.flagAlasan.length).toBeGreaterThan(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('falls back to HIJAU for a healthy profile', async () => {
    const result = await make().screen(healthy);
    expect(result.flagAi).toBe('HIJAU');
    expect(result.skorAi).toBeGreaterThanOrEqual(70);
    expect(result.flagAlasan.length).toBeGreaterThan(0);
  });

  it('falls back to KUNING for a mid profile', async () => {
    const result = await make().screen(mid);
    expect(result.flagAi).toBe('KUNING');
    expect(result.skorAi).toBeGreaterThan(38);
    expect(result.skorAi).toBeLessThan(82);
  });

  // --- Live path (key present, SDK mocked) ---
  it('parses a valid fenced JSON response from the model', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockResolvedValue({
      text: '```json\n{"skorAi": 91, "flagAi": "hijau", "flagAlasan": ["aktif menabung"]}\n```',
    });

    const result = await make().screen(healthy);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.flagAi).toBe('HIJAU');
    expect(result.skorAi).toBe(91);
    expect(result.flagAlasan).toEqual(['aktif menabung']);
  });

  it('clamps an out-of-range skorAi into 0-100', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockResolvedValue({
      text: '{"skorAi": 150, "flagAi": "MERAH", "flagAlasan": ["x"]}',
    });
    const result = await make().screen(ani);
    expect(result.skorAi).toBe(100);
    expect(result.flagAi).toBe('MERAH');
  });

  it('falls back to the seeded result when the model call throws', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockRejectedValue(new Error('network down'));
    const result = await make().screen(ani);
    expect(result.flagAi).toBe('MERAH');
    expect(result.skorAi).toBe(38);
  });

  it('falls back when the model returns unparseable output', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockResolvedValue({ text: 'not json at all' });
    const result = await make().screen(healthy);
    expect(result.flagAi).toBe('HIJAU');
  });

  it('falls back when the model returns an invalid flag', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockResolvedValue({
      text: '{"skorAi": 50, "flagAi": "PURPLE", "flagAlasan": ["x"]}',
    });
    const result = await make().screen(mid);
    expect(result.flagAi).toBe('KUNING');
  });
});

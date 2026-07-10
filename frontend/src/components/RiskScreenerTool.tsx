import { useState, useEffect } from 'react';
import { Shield, Sparkles, AlertTriangle, AlertCircle, Trash, RefreshCw } from 'lucide-react';

interface AdverseFlag {
  jenis: string;
  verified: boolean;
}

const ADVERSE_DEDUCTIONS: Record<string, number> = {
  "Tunggakan tersembunyi": 25,
  "Ketidaksesuaian data": 12,
  "Catatan hukum keuangan": 20,
  "Berita negatif keuangan": 10,
};


export default function RiskScreenerTool() {
  const [candidateName, setCandidateName] = useState('Pak X (Suhendar)');
  const [consent, setConsent] = useState(true);

  // Pilar 1: Rekam Internal
  const [simpananRate, setSimpananRate] = useState(90);
  const [cicilanRate, setCicilanRate] = useState(-1); // -1 means no history
  const [tenure, setTenure] = useState(6);
  const [hadirRate, setHadirRate] = useState(80);

  // Pilar 2: Kapasitas
  const [income, setIncome] = useState(4000000);
  const [debt, setDebt] = useState(1800000);
  const [stability, setStability] = useState<'tetap' | 'musiman' | 'tidak_tetap'>('musiman');
  const [isVerCapacity, setIsVerCapacity] = useState(false);

  // Pilar 3: Referensi Sosial
  const [vouch, setVouch] = useState<'ya' | 'ragu' | 'tidak'>('ya');
  const [reputation, setReputation] = useState<'baik' | 'cukup' | 'kurang'>('baik');
  const [knowCount, setKnowCount] = useState(6);
  const [groupSize, setGroupSize] = useState(8);

  // Pilar 4: Adverse Flags
  const [flags, setFlags] = useState<AdverseFlag[]>([
    { jenis: 'Tunggakan tersembunyi', verified: true },
  ]);

  // Calculations
  const [score, setScore] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [band, setBand] = useState('');
  const [color, setColor] = useState('');
  const [reco, setReco] = useState('');
  const [pilarScores, setPilarScores] = useState({ p1: 0, p2: 0, p3: 0, penalty: 0 });
  const [rincian, setRincian] = useState<Array<{ text: string; score: number; max: number }>>([]);

  const loadPreset = (preset: string) => {
    if (preset === 'sri') {
      setCandidateName('Bu Sri Rahayu');
      setConsent(true);
      setSimpananRate(98);
      setCicilanRate(97);
      setTenure(30);
      setHadirRate(95);
      setIncome(3500000);
      setDebt(700000);
      setStability('tetap');
      setIsVerCapacity(true);
      setVouch('ya');
      setReputation('baik');
      setKnowCount(7);
      setGroupSize(8);
      setFlags([]);
    } else if (preset === 'x') {
      setCandidateName('Pak X (Suhendar)');
      setConsent(true);
      setSimpananRate(90);
      setCicilanRate(-1);
      setTenure(6);
      setHadirRate(80);
      setIncome(4000000);
      setDebt(1800000);
      setStability('musiman');
      setIsVerCapacity(false);
      setVouch('ya');
      setReputation('baik');
      setKnowCount(6);
      setGroupSize(8);
      setFlags([{ jenis: 'Tunggakan tersembunyi', verified: true }]);
    } else if (preset === 'y') {
      setCandidateName('Bu Y (Siti Aminah)');
      setConsent(true);
      setSimpananRate(85);
      setCicilanRate(90);
      setTenure(18);
      setHadirRate(70);
      setIncome(3000000);
      setDebt(900000);
      setStability('tetap');
      setIsVerCapacity(true);
      setVouch('ragu');
      setReputation('cukup');
      setKnowCount(4);
      setGroupSize(8);
      setFlags([{ jenis: 'Berita negatif keuangan', verified: false }]);
    } else {
      setCandidateName('Calon Baru');
      setConsent(true);
      setSimpananRate(50);
      setCicilanRate(-1);
      setTenure(0);
      setHadirRate(50);
      setIncome(3000000);
      setDebt(900000);
      setStability('tidak_tetap');
      setIsVerCapacity(false);
      setVouch('ragu');
      setReputation('cukup');
      setKnowCount(0);
      setGroupSize(8);
      setFlags([]);
    }
  };

  const addFlag = () => {
    setFlags([...flags, { jenis: 'Berita negatif keuangan', verified: false }]);
  };

  const removeFlag = (idx: number) => {
    setFlags(flags.filter((_, i) => i !== idx));
  };

  const updateFlagType = (idx: number, value: string) => {
    setFlags(flags.map((f, i) => i === idx ? { ...f, jenis: value } : f));
  };

  const updateFlagVerified = (idx: number, checked: boolean) => {
    setFlags(flags.map((f, i) => i === idx ? { ...f, verified: checked } : f));
  };

  const clip = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

  useEffect(() => {
    if (!consent) {
      setScore(0);
      setConfidence(0);
      setBand('DITOLAK PROSES');
      setColor('#C0392B');
      setReco('Tidak ada persetujuan (consent). Wajib disetujui peminjam sesuai UU PDP No. 27/2022.');
      setPilarScores({ p1: 0, p2: 0, p3: 0, penalty: 0 });
      setRincian([]);
      return;
    }

    const comp: number[] = [];
    const rinc: Array<{ text: string; score: number; max: number }> = [];

    // Pilar 1: Rekam Internal (Max 45)
    let p1 = 0;
    const sRate = clip(simpananRate / 100);
    const sVal = sRate * 18;
    p1 += sVal;
    rinc.push({ text: 'Ketepatan simpanan wajib', score: sVal, max: 18 });
    comp.push(1);

    if (cicilanRate >= 0) {
      const cRate = clip(cicilanRate / 100);
      const cVal = cRate * 15;
      p1 += cVal;
      rinc.push({ text: 'Riwayat cicilan tepat waktu', score: cVal, max: 15 });
      comp.push(1);
    } else {
      rinc.push({ text: 'Riwayat cicilan (anggota baru)', score: 0, max: 15 });
      comp.push(0);
    }

    const tVal = clip(tenure / 24) * 6;
    p1 += tVal;
    rinc.push({ text: 'Lama keanggotaan (tenure)', score: tVal, max: 6 });
    comp.push(tenure > 0 ? 1 : 0);

    const hVal = clip(hadirRate / 100) * 6;
    p1 += hVal;
    rinc.push({ text: 'Kehadiran pertemuan bulanan', score: hVal, max: 6 });
    comp.push(1);

    // Pilar 2: Kapasitas (Max 30)
    let p2 = 0;
    if (income > 0) {
      const dsr = debt / income;
      // DSR <=0.30 -> max 18; >=0.70 -> 0
      const dVal = clip((0.70 - dsr) / (0.70 - 0.30)) * 18;
      p2 += dVal;
      rinc.push({ text: `Rasio cicilan/penghasilan (DSR ${Math.round(dsr * 100)}%)`, score: dVal, max: 18 });
      comp.push(1);
    } else {
      rinc.push({ text: 'Kapasitas bayar (data kosong)', score: 0, max: 18 });
      comp.push(0);
    }

    const stabVal = stability === 'tetap' ? 7 : stability === 'musiman' ? 4 : 2;
    p2 += stabVal;
    rinc.push({ text: `Stabilitas penghasilan (${stability})`, score: stabVal, max: 7 });

    if (isVerCapacity) {
      p2 += 5;
      rinc.push({ text: 'Kapasitas terverifikasi', score: 5, max: 5 });
      comp.push(1);
    } else {
      rinc.push({ text: 'Kapasitas BELUM diverifikasi', score: 0, max: 5 });
      comp.push(0);
    }

    // Pilar 3: Referensi Sosial (Max 25)
    let p3 = 0;
    const vouchVal = vouch === 'ya' ? 10 : vouch === 'ragu' ? 4 : 0;
    p3 += vouchVal;
    rinc.push({ text: `Jaminan ketua grup (${vouch})`, score: vouchVal, max: 10 });

    const gSize = Math.max(groupSize, 1);
    const kVal = clip(knowCount / gSize) * 8;
    p3 += kVal;
    rinc.push({ text: 'Anggota grup kenal > 1 tahun', score: kVal, max: 8 });
    comp.push(1);

    const repVal = reputation === 'baik' ? 7 : reputation === 'cukup' ? 4 : 1;
    p3 += repVal;
    rinc.push({ text: `Reputasi komunitas (${reputation})`, score: repVal, max: 7 });

    const base = p1 + p2 + p3;

    // Pilar 4: Adverse Deductions
    let penalty = 0;
    let hasOpenFlag = false;
    let hasSeriousVerified = false;

    flags.forEach((f) => {
      const ded = ADVERSE_DEDUCTIONS[f.jenis] || 8;
      hasOpenFlag = true;
      if (f.verified) {
        penalty += ded;
        if (ded >= 20) {
          hasSeriousVerified = true;
        }
      }
    });

    const finalScore = Math.round(clip((base - penalty) / 100) * 100);
    const finalConfidence = comp.length ? Math.round((comp.reduce((a, b) => a + b, 0) / comp.length) * 100) : 0;

    let bName = '';
    let bColor = '';
    let recommendation = '';

    if (hasSeriousVerified || finalScore < 50) {
      bName = 'MERAH — Risiko Tinggi';
      bColor = '#C0392B';
      recommendation = 'Tinjau manual mendalam. Jangan cairkan tanpa verifikasi ketat, mitigasi penjamin tambahan, atau pemotongan plafon.';
    } else if (hasOpenFlag || finalScore < 70) {
      bName = 'KUNING — Perlu Tinjau';
      bColor = '#C55A11';
      recommendation = 'Boleh dilanjutkan dengan SYARAT: Verifikasi flag adverse, tambah penjamin grup, sesuaikan tenor, atau berikan pinjaman percobaan kecil.';
    } else {
      bName = 'HIJAU — Risiko Rendah';
      bColor = '#548235';
      recommendation = 'Skor prima. Sangat layak direkomendasikan langsung ke musyawarah kelompok.';
    }

    setScore(finalScore);
    setConfidence(finalConfidence);
    setBand(bName);
    setColor(bColor);
    setReco(recommendation);
    setPilarScores({ p1, p2, p3, penalty });
    setRincian(rinc);

  }, [consent, simpananRate, cicilanRate, tenure, hadirRate, income, debt, stability, isVerCapacity, vouch, reputation, knowCount, groupSize, flags]);

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="risk-screener-tool">
      {/* Header Banner */}
      <div className="p-5 text-white" style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2F6B6B 100%)' }}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-200">
              <Shield className="w-3 h-3 text-amber-300" /> Modul AI Skrining EWS
            </div>
            <h3 className="text-xl font-bold mt-2">Kalkulator Risiko RantaiRenteng</h3>
            <p className="text-slate-200 text-xs mt-1">
              Simulasikan skor anggota berdasar data internal, kapasitas bayar, ikatan sosial, dan adverse flag.
            </p>
          </div>
          <Sparkles className="w-8 h-8 text-amber-400 opacity-90 animate-pulse hidden sm:block" />
        </div>
      </div>

      {/* Consent & Presets Area */}
      <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#548235]"></div>
          </label>
          <span className="text-xs font-semibold text-slate-700">
            Persetujuan (Consent) Calon Peminjam <span className="text-red-500">*</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-500 font-medium">Muat Kasus:</span>
          <button
            onClick={() => loadPreset('sri')}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Bu Sri
          </button>
          <button
            onClick={() => loadPreset('x')}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Pak X (Tunggakan)
          </button>
          <button
            onClick={() => loadPreset('y')}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Bu Y (Belum Verif)
          </button>
          <button
            onClick={() => loadPreset('blank')}
            className="p-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title="Kosongkan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        
        {/* Left: Interactive Controls (lg:col-span-7) */}
        <div className="lg:col-span-7 p-5 space-y-5 max-h-[600px] overflow-y-auto">
          {/* Candidate Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Nama Calon Peminjam</label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Pilar 1 */}
          <div className="space-y-3.5 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-extrabold text-[#1F3864] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 bg-[#1F3864] text-white rounded-full flex items-center justify-center text-[10px]">1</span>
              Rekam Internal Koperasi (Bobot 45)
            </h4>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Simpanan Wajib Tepat Waktu</span>
                <span className="text-[#1F3864]">{simpananRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simpananRate}
                onChange={(e) => setSimpananRate(Number(e.target.value))}
                className="w-full accent-[#1F3864]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Riwayat Cicilan Tepat Waktu</span>
                <span className="text-[#1F3864]">{cicilanRate < 0 ? 'Anggota Baru (—)' : `${cicilanRate}%`}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="100"
                value={cicilanRate}
                onChange={(e) => setCicilanRate(Number(e.target.value))}
                className="w-full accent-[#1F3864]"
              />
              <span className="text-[10px] text-slate-400 block">-1 berarti belum pernah pinjam sebelumnya</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Keanggotaan (Bulan)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={tenure}
                  onChange={(e) => setTenure(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Kehadiran Pertemuan</span>
                  <span className="text-teal-700">{hadirRate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hadirRate}
                  onChange={(e) => setHadirRate(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            </div>
          </div>

          {/* Pilar 2 */}
          <div className="space-y-3.5 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-extrabold text-[#2F6B6B] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 bg-[#2F6B6B] text-white rounded-full flex items-center justify-center text-[10px]">2</span>
              Kapasitas Bayar (Bobot 30)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pendapatan Bulanan (Rp)</label>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Cicilan Bulanan (Rp)</label>
                <input
                  type="number"
                  value={debt}
                  onChange={(e) => setDebt(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Stabilitas Pendapatan</label>
                <select
                  value={stability}
                  onChange={(e: any) => setStability(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 bg-white"
                >
                  <option value="tetap">Tetap (Gaji/Dagang Stabil)</option>
                  <option value="musiman">Musiman (Pertanian/Panen)</option>
                  <option value="tidak_tetap">Tidak Tetap (Buruh Harian)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Verifikasi Dokumen</label>
                <select
                  value={isVerCapacity ? '1' : '0'}
                  onChange={(e) => setIsVerCapacity(e.target.value === '1')}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 bg-white"
                >
                  <option value="0">Belum Terverifikasi</option>
                  <option value="1">Terverifikasi (Slip/Mutasi)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pilar 3 */}
          <div className="space-y-3.5 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-extrabold text-[#C55A11] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 bg-[#C55A11] text-white rounded-full flex items-center justify-center text-[10px]">3</span>
              Referensi Sosial Grup (Bobot 25)
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ketua Kelompok Saling-Menjamin</label>
                <select
                  value={vouch}
                  onChange={(e: any) => setVouch(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 bg-white"
                >
                  <option value="ya">Ya, Menjamin Penuh</option>
                  <option value="ragu">Ragu-ragu / Bersyarat</option>
                  <option value="tidak">Tidak Menjamin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reputasi Komunitas</label>
                <select
                  value={reputation}
                  onChange={(e: any) => setReputation(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 bg-white"
                >
                  <option value="baik">Sangat Baik / Dipercaya</option>
                  <option value="cukup">Cukup / Normal</option>
                  <option value="kurang">Pernah Ada Konflik</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kenal Anggota &gt; 1 Tahun</label>
                <input
                  type="number"
                  min="0"
                  max={groupSize}
                  value={knowCount}
                  onChange={(e) => setKnowCount(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Ukuran Grup</label>
                <input
                  type="number"
                  min="5"
                  max="12"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Pilar 4 */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-4 h-4 bg-red-700 text-white rounded-full flex items-center justify-center text-[10px]">4</span>
                Sinyal Adverse (Penalti Skor)
              </h4>
              <button
                onClick={addFlag}
                className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded"
              >
                + Tambah Flag
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400">
              Pengurang hanya dihitung bila flag <strong>TERVERIFIKASI</strong>. Jika tidak terverifikasi, hanya memicu status kuning & perlunya tinjauan, bukan pemotongan nilai langsung.
            </p>

            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {flags.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-2 italic border border-dashed border-slate-200 rounded-lg">
                  Tidak ada flag adverse negatif
                </div>
              ) : (
                flags.map((flag, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <select
                      value={flag.jenis}
                      onChange={(e) => updateFlagType(idx, e.target.value)}
                      className="text-xs font-medium border border-slate-300 rounded p-1 bg-white flex-1 outline-none"
                    >
                      <option value="Tunggakan tersembunyi">Tunggakan tersembunyi (-25)</option>
                      <option value="Catatan hukum keuangan">Catatan hukum keuangan (-20)</option>
                      <option value="Ketidaksesuaian data">Ketidaksesuaian data (-12)</option>
                      <option value="Berita negatif keuangan">Berita negatif keuangan (-10)</option>
                    </select>
                    
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={flag.verified}
                        onChange={(e) => updateFlagVerified(idx, e.target.checked)}
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                      />
                      <span className="text-[10px] font-semibold text-slate-600">terverifikasi</span>
                    </label>

                    <button
                      onClick={() => removeFlag(idx)}
                      className="p-1 hover:bg-red-50 text-red-500 rounded"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Real-time Analysis Result (lg:col-span-5) */}
        <div className="lg:col-span-5 p-5 bg-slate-50/50 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Hasil Penilaian</span>
              <h4 className="text-sm font-bold text-slate-800 mt-0.5 truncate">{candidateName}</h4>
            </div>

            {/* Score Ring / Gauge */}
            <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-xl">
              <div
                className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-black shadow-sm"
                style={{ backgroundColor: color }}
              >
                <span className="text-xl leading-none">{score}</span>
                <span className="text-[8px] opacity-80 uppercase font-medium mt-0.5">Skor</span>
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-extrabold" style={{ color }}>{band}</h5>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: confidence >= 70 ? '#548235' : confidence >= 50 ? '#C55A11' : '#C0392B'
                    }}
                  >
                    Keandalan data: {confidence}%
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence warning bar if applicable */}
            {confidence < 50 && consent && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Data Kurang Lengkap!</strong> Harap lengkapi verifikasi kapasitas atau catatan rincian untuk menaikkan keandalan analisa.
                </span>
              </div>
            )}

            {/* Breakdown Bars */}
            <div className="space-y-2.5 bg-white border border-slate-200 p-3.5 rounded-xl text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Distribusi Nilai Pilar</span>
              
              <div className="space-y-1">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>1. Rekam Koperasi</span>
                  <span className="font-bold text-[#1F3864]">{pilarScores.p1.toFixed(1)}/45</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1F3864]" style={{ width: `${(pilarScores.p1 / 45) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>2. Kapasitas Keuangan</span>
                  <span className="font-bold text-[#2F6B6B]">{pilarScores.p2.toFixed(1)}/30</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2F6B6B]" style={{ width: `${(pilarScores.p2 / 30) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>3. Modal Sosial</span>
                  <span className="font-bold text-[#C55A11]">{pilarScores.p3.toFixed(1)}/25</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#C55A11]" style={{ width: `${(pilarScores.p3 / 25) * 100}%` }}></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>4. Penalti Adverse</span>
                  <span className="font-bold text-red-600">-{pilarScores.penalty.toFixed(0)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600" style={{ width: `${Math.min(100, (pilarScores.penalty / 50) * 100)}%` }}></div>
                </div>
              </div>
            </div>

            {/* Display Adverse flags if open */}
            {flags.length > 0 && consent && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Catatan Sinyal Buruk (Adverse)</span>
                {flags.map((f, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg text-xs ${
                      f.verified
                        ? 'bg-red-50 border border-red-100 text-red-800'
                        : 'bg-amber-50 border border-amber-100 text-amber-800'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-1">
                        {f.verified ? <AlertCircle className="w-3.5 h-3.5 text-red-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                        {f.jenis}
                      </span>
                      <span className="font-extrabold">{f.verified ? `-${ADVERSE_DEDUCTIONS[f.jenis]} poin` : 'Tangguhkan'}</span>
                    </div>
                    <span className="text-[10px] opacity-80 block mt-0.5">
                      {f.verified ? 'Terverifikasi sah — dipotong dari skor dasar.' : 'Belum diverifikasi — tidak dipotong, memerlukan wawancara langsung.'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* AI Recommendation Box */}
            <div
              className="p-4 rounded-xl text-xs font-semibold leading-relaxed"
              style={{
                backgroundColor: color === '#548235' ? '#e7f4e4' : color === '#C55A11' ? '#fdefe1' : '#fdecea',
                color: color === '#548235' ? '#2c4a17' : color === '#C55A11' ? '#8a480d' : '#7d241a'
              }}
            >
              <div className="font-extrabold uppercase tracking-wide mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Panduan Keputusan AI
              </div>
              {reco}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 space-y-3">
            <button
              onClick={() => {
                alert(`Simulasi Sanggahan Anggota:\n\nPengajuan keberatan atas flag adverse "${flags[0]?.jenis || 'Flag Sinyal'}" telah dikirim ke admin.\nStatus flag diubah sementara ke 'Perlu Verifikasi' untuk menunda penalti skor sementara, seraya menjadwalkan musyawarah khusus.`);
              }}
              className="w-full bg-[#eef2fb] border border-[#cdd9f0] hover:bg-[#dfe7f7] transition-colors text-[#274a86] font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5"
            >
              ⚖️ Ajukan Sanggahan Resmi (Hak Anggota)
            </button>

            <span className="text-[10px] text-slate-400 block text-center italic">
              AI hanya memberi usulan & tanda peringatan. Keputusan final disetujui lewat mufakat musyawarah kelompok tanggung renteng & pengurus koperasi.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

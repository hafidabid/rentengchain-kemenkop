import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Home,
  PiggyBank,
  Users,
  CreditCard,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Wallet,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, ApiError, DEMO_GROUP_ID } from '../lib/api';
import { formatIdr, shortAddress } from '../lib/format';
import type { Group, Loan, SavingJenis, SavingTransaction } from '../types';

type Tab = 'beranda' | 'simpan' | 'grup' | 'pinjaman' | 'profil';
type Flash = { type: 'success' | 'error' | 'info'; msg: string } | null;

interface QrisConfig {
  title: string;
  amount: number;
  onConfirm: () => void | Promise<void>;
}

const flagDot: Record<Loan['flagAi'], string> = {
  HIJAU: 'bg-[#548235]',
  KUNING: 'bg-[#C55A11]',
  MERAH: 'bg-[#C0392B]',
};

export default function AnggotaView() {
  const { member, refreshMember } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('beranda');

  const [group, setGroup] = useState<Group | null>(null);
  const [savings, setSavings] = useState<SavingTransaction[]>([]);
  const [appliedLoan, setAppliedLoan] = useState<Loan | null>(null);

  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);

  // QRIS mock modal
  const [qris, setQris] = useState<QrisConfig | null>(null);

  // Savings form
  const [saveType, setSaveType] = useState<'Wajib' | 'Sukarela'>('Wajib');
  const [saveAmount, setSaveAmount] = useState('50000');

  // Loan form
  const [loanAmount, setLoanAmount] = useState('3000000');
  const [loanPurpose, setLoanPurpose] = useState('Membeli stok dagangan sembako');
  const [loanTenor, setLoanTenor] = useState('6');
  const [sanggahText, setSanggahText] = useState('');
  const [showSanggah, setShowSanggah] = useState(false);

  const notify = useCallback((f: Flash) => {
    setFlash(f);
    if (f) window.setTimeout(() => setFlash(null), 6000);
  }, []);

  // Bootstrap: savings + demo group context.
  const loadData = useCallback(async () => {
    if (!member) return;
    try {
      const [sv, grp] = await Promise.allSettled([
        api.listSavings(member.id),
        api.getGroup(DEMO_GROUP_ID),
      ]);
      if (sv.status === 'fulfilled') setSavings(sv.value);
      if (grp.status === 'fulfilled') setGroup(grp.value);
    } catch {
      /* non-fatal for the mobile surface */
    }
  }, [member]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!member) return null;

  const totalSimpanan =
    member.simpananPokok + member.simpananWajib + member.simpananSukarela;
  const inGroup = group?.anggotaIds.includes(member.id) ?? false;

  const refreshMe = async () => {
    try {
      const fresh = await api.getMe();
      refreshMember(fresh);
    } catch {
      /* ignore */
    }
  };

  // --- Flow ④: pay a simpanan via simulated QRIS ---
  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(saveAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify({ type: 'error', msg: 'Nominal simpanan tidak valid.' });
      return;
    }
    setQris({
      title: `Simpanan ${saveType}`,
      amount,
      onConfirm: async () => {
        setBusy(true);
        try {
          const jenis: SavingJenis = saveType;
          const saving = await api.createSaving({
            memberId: member.id,
            jenis,
            nominal: amount,
            metode: 'QRIS',
          });
          setSavings((prev) => [saving, ...prev]);
          await refreshMe();
          notify({
            type: 'success',
            msg: `Simpanan ${saveType} ${formatIdr(amount)} tercatat di ledger.`,
          });
        } catch (err) {
          notify({
            type: 'error',
            msg: err instanceof ApiError ? err.message : 'Gagal menyetor simpanan.',
          });
        } finally {
          setBusy(false);
          setQris(null);
        }
      },
    });
  };

  // --- Flow ②: apply for a loan; see AI flag/score/reasons ---
  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = Number(loanAmount);
    const tenor = Number(loanTenor);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      notify({ type: 'error', msg: 'Nominal pinjaman tidak valid.' });
      return;
    }
    if (!group) {
      notify({
        type: 'error',
        msg: 'Konteks kelompok belum termuat. Coba lagi sesaat.',
      });
      return;
    }
    setBusy(true);
    try {
      const loan = await api.applyLoan({
        memberId: member.id,
        groupId: group.id,
        nominal,
        tujuan: loanPurpose,
        tenor,
      });
      setAppliedLoan(loan);
      setShowSanggah(false);
      notify({
        type: loan.flagAi === 'MERAH' ? 'error' : 'success',
        msg: `Pengajuan terkirim. Skrining AI: ${loan.flagAi} (skor ${loan.skorAi}).`,
      });
    } catch (err) {
      notify({
        type: 'error',
        msg: err instanceof ApiError ? err.message : 'Gagal mengajukan pinjaman.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSanggah = async () => {
    if (!appliedLoan) return;
    if (!sanggahText.trim()) {
      notify({ type: 'error', msg: 'Harap isi alasan sanggahan.' });
      return;
    }
    setBusy(true);
    try {
      const updated = await api.sanggahLoan(appliedLoan.id, sanggahText.trim());
      setAppliedLoan(updated);
      setSanggahText('');
      setShowSanggah(false);
      notify({ type: 'success', msg: 'Sanggahan terekam. Pengurus akan meninjau.' });
    } catch (err) {
      notify({
        type: 'error',
        msg: err instanceof ApiError ? err.message : 'Gagal mengirim sanggahan.',
      });
    } finally {
      setBusy(false);
    }
  };

  const initials = member.nama
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-[390px] mx-auto bg-[#1E1F21] rounded-[55px] p-3 shadow-[0_24px_50px_rgba(30,31,33,0.12)] border-[10px] border-[#1E1F21] relative flex flex-col overflow-hidden h-[860px] text-[#1E1F21]">
      {/* Notch */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#1E1F21] rounded-full z-40" />

      {/* Status bar */}
      <div className="bg-gradient-to-r from-[#F06A6A] to-[#E5544F] text-white pt-5 pb-2.5 px-6 flex justify-between items-center text-[10px] font-semibold tracking-wider shrink-0 z-30 select-none">
        <span>09:41</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-end gap-[1.5px] h-2.5">
            <div className="w-[2px] h-[3px] bg-white rounded-sm" />
            <div className="w-[2px] h-[5px] bg-white rounded-sm" />
            <div className="w-[2px] h-[7px] bg-white rounded-sm" />
            <div className="w-[2px] h-[9px] bg-white rounded-sm" />
          </div>
          <div className="w-5 h-2.5 border border-white/60 rounded-[3px] p-[1px] flex items-center">
            <div className="h-full w-4/5 bg-white rounded-[1.5px]" />
          </div>
        </div>
      </div>

      {/* Coral header */}
      <div className="bg-gradient-to-br from-[#F06A6A] via-[#E5544F] to-[#C83E3E] text-white pt-5 pb-6 px-5 shrink-0 z-20 relative overflow-hidden select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <motion.div
            animate={{ x: [0, 50, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.25, 0.85, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-12 -left-12 w-36 h-36 bg-amber-300 rounded-full blur-3xl opacity-30"
          />
          <motion.div
            animate={{ x: [0, -40, 50, 0], y: [0, 40, -30, 0], scale: [1, 0.8, 1.3, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-16 -right-16 w-44 h-44 bg-rose-300 rounded-full blur-3xl opacity-40"
          />
        </div>

        <div className="flex justify-between items-center mb-4 relative z-10">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-black text-[#F06A6A] text-[9px]">
              印
            </div>
            <span className="font-black text-[9px] tracking-wider text-white uppercase">
              Koperasi Desa Merah Putih
            </span>
          </div>
          <span className="text-[10px] font-extrabold text-white bg-white/15 px-2.5 py-1 rounded-full border border-white/10">
            {member.nama}
          </span>
        </div>

        <div className="relative z-10 mt-1">
          <span className="text-[9px] text-red-100 font-bold uppercase tracking-widest block">
            Ringkasan Keuangan
          </span>
          <h2 className="text-2xl font-black text-white mt-1">
            {formatIdr(totalSimpanan)}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-white/15 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-white/5">
              Skor Keanggotaan {member.skorKeanggotaan}
            </span>
            {member.walletAddress && (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-50 font-mono bg-white/10 px-2 py-0.5 rounded-full">
                <Wallet className="w-3 h-3" /> {shortAddress(member.walletAddress)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ethics banner */}
      <div className="bg-[#FAF9F8] border-b border-[#E4E4E4] py-2 px-3 text-[9px] text-[#6D6E6F] font-medium flex items-center gap-1.5 shrink-0 z-20">
        <AlertCircle className="w-3.5 h-3.5 text-[#F06A6A] shrink-0" />
        <span className="leading-tight">
          Keputusan akhir tetap mufakat musyawarah grup & pengurus. AI adalah asisten
          EWS.
        </span>
      </div>

      {/* Flash */}
      {flash && (
        <div
          className={`px-3 py-2 text-[11px] font-semibold shrink-0 z-20 flex items-center gap-1.5 ${
            flash.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
              : flash.type === 'error'
                ? 'bg-red-50 text-red-800 border-b border-red-200'
                : 'bg-amber-50 text-amber-800 border-b border-amber-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {flash.msg}
        </div>
      )}

      {/* Scroll body */}
      <div className="flex-1 overflow-y-auto bg-[#FAF9F8] p-4">
        {member.statusKyc === 'Requested' && (
          <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#C55A11] shrink-0 mt-0.5" />
            <div>
              <strong>Akun e-KYC Sedang Ditinjau.</strong> Pengurus koperasi harus
              menyetujui pendaftaran Anda untuk mengaktifkan seluruh fitur.
            </div>
          </div>
        )}

        {/* TAB BERANDA */}
        {activeTab === 'beranda' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#FCE8E6] border border-[#F06A6A]/10 flex items-center justify-center text-[#F06A6A] font-black text-sm">
                  {initials}
                </div>
                <div>
                  <span className="text-[10px] text-[#F06A6A] font-extrabold block uppercase tracking-wider">
                    Anggota Koperasi
                  </span>
                  <h3 className="text-xs font-black text-[#1E1F21] leading-tight">
                    {member.nama}
                  </h3>
                  <p className="text-[9px] text-[#6D6E6F] font-semibold">
                    {member.pekerjaan} · {member.alamat}
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-black text-[#F06A6A] bg-[#FCE8E6] border border-[#F06A6A]/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Skor {member.skorKeanggotaan}
              </span>
            </div>

            {/* Wallet card (Flow ①) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#F06A6A]" /> Dompet On-Chain
              </span>
              {member.walletAddress ? (
                <div className="flex items-center justify-between bg-[#FAF9F8] border border-[#E4E4E4] rounded-xl px-3 py-2">
                  <span className="font-mono text-[11px] text-[#1E1F21] break-all">
                    {member.walletAddress}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-[#6D6E6F]">
                  Dompet akan diterbitkan setelah e-KYC disetujui pengurus.
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex justify-around items-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
              {[
                { tab: 'simpan' as Tab, icon: PiggyBank, label: 'Setor Simpanan' },
                { tab: 'pinjaman' as Tab, icon: CreditCard, label: 'Ajukan Pinjaman' },
                { tab: 'grup' as Tab, icon: Users, label: 'Kelompok Kami' },
              ].map(({ tab, icon: Icon, label }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-12 h-12 rounded-full bg-[#F06A6A] group-hover:bg-[#E5544F] text-white flex items-center justify-center shadow-md transition-all group-active:scale-95">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#1E1F21] tracking-tight">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Savings breakdown */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Rincian Simpanan
              </h4>
              {[
                { label: 'Simpanan Pokok', value: member.simpananPokok },
                { label: 'Simpanan Wajib', value: member.simpananWajib },
                { label: 'Simpanan Sukarela', value: member.simpananSukarela },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-1.5 last:border-0"
                >
                  <span>{row.label}</span>
                  <span className="text-[#1E1F21] font-mono">
                    {formatIdr(row.value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Applied loan summary (Flow ②) */}
            {appliedLoan && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[8px] bg-[#5C0A1A]/10 text-[#5C0A1A] border border-[#5C0A1A]/20 px-2 py-0.5 rounded-full font-black uppercase inline-block">
                      {appliedLoan.status}
                    </span>
                    <h5 className="text-xs font-black text-slate-800 mt-1">
                      {appliedLoan.tujuan}
                    </h5>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-[#5C0A1A] block">
                      {formatIdr(appliedLoan.nominal)}
                    </span>
                    <span className="text-[8px] text-slate-400 font-bold">
                      {appliedLoan.tenor} bulan
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('pinjaman')}
                  className="text-[10px] font-black text-[#F06A6A] flex items-center gap-0.5"
                >
                  Lihat hasil skrining AI <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB SIMPAN (Flow ④) */}
        {activeTab === 'simpan' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="text-center">
              <PiggyBank className="w-10 h-10 text-[#F06A6A] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Setor Simpanan
              </h3>
              <p className="text-xs text-slate-500">
                Tercatat otomatis di ledger transparan kelompok
              </p>
            </div>

            <form
              onSubmit={handleDeposit}
              className="bg-white p-4 rounded-xl border border-slate-200 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Jenis Simpanan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveType('Wajib');
                      setSaveAmount('50000');
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold border transition-all ${
                      saveType === 'Wajib'
                        ? 'border-[#F06A6A] bg-[#FCE8E6] text-[#F06A6A]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Wajib (Rp50.000)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveType('Sukarela');
                      setSaveAmount('100000');
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold border transition-all ${
                      saveType === 'Sukarela'
                        ? 'border-[#F06A6A] bg-[#FCE8E6] text-[#F06A6A]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Sukarela (Bebas)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nominal Setoran (Rp)
                </label>
                <input
                  type="number"
                  value={saveAmount}
                  onChange={(e) => setSaveAmount(e.target.value)}
                  disabled={saveType === 'Wajib'}
                  className="w-full text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none disabled:opacity-70"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[#F06A6A] hover:bg-[#E5544F] disabled:opacity-60 text-white font-extrabold text-xs py-2.5 rounded-lg shadow-md transition-all"
              >
                Bayar Simpanan via QRIS
              </button>
            </form>

            {/* Recent savings + tx links */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Riwayat Simpanan
              </span>
              {savings.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2 text-center">
                  Belum ada transaksi simpanan.
                </p>
              ) : (
                savings.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        Simpanan {s.jenis}
                      </span>
                      <span className="text-[9px] text-slate-400">{s.metode}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-black text-[#1E1F21] block">
                        {formatIdr(s.nominal)}
                      </span>
                      {s.txLink && (
                        <a
                          href={s.txLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] font-bold text-[#F06A6A] inline-flex items-center gap-0.5"
                        >
                          Lihat tx <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* TAB GRUP (read-only) */}
        {activeTab === 'grup' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="text-center">
              <Users className="w-10 h-10 text-[#F06A6A] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Kelompok Tanggung Renteng
              </h3>
              <p className="text-xs text-slate-500">Agunan sosial saling menjamin</p>
            </div>

            {group ? (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-800">{group.nama}</h4>
                  <span className="text-[10px] font-bold text-[#548235] bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase">
                    Reputasi: {group.reputasiKomunitas}
                  </span>
                </div>
                <div className="bg-[#FCE8E6]/60 border border-[#F06A6A]/15 p-2.5 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-[#F06A6A] block font-bold uppercase tracking-wider">
                      Kode Undangan
                    </span>
                    <strong className="text-[#1E1F21] font-mono tracking-widest text-sm">
                      {group.kodeUndangan}
                    </strong>
                  </div>
                  {!inGroup && (
                    <span className="text-[9px] font-bold text-slate-500">
                      Anda belum terikat kelompok ini
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Plafon</span>
                    <strong className="text-[#1E1F21]">
                      {formatIdr(group.plafonMaks)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kehadiran</span>
                    <strong className="text-[#548235]">{group.kehadiranRate}%</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kas Sosial</span>
                    <strong className="text-[#1E1F21]">
                      {formatIdr(group.kasSosial)}
                    </strong>
                  </div>
                </div>
                <div className="bg-[#FAF9F8] border border-[#E4E4E4] p-3 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                  "Kami berikrar saling membantu cicilan dan bersedia bertanggung
                  renteng jika rekan tertimpa musibah."
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                Data kelompok belum termuat.
              </div>
            )}
          </motion.div>
        )}

        {/* TAB PINJAMAN (Flow ②) */}
        {activeTab === 'pinjaman' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="text-center">
              <CreditCard className="w-10 h-10 text-[#F06A6A] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Pengajuan Pembiayaan
              </h3>
              <p className="text-xs text-slate-500">
                Transparan & terikat kelompok tanggung renteng
              </p>
            </div>

            {appliedLoan ? (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block">
                      STATUS PENGAJUAN
                    </span>
                    <h4 className="text-sm font-bold text-[#1E1F21] mt-0.5">
                      {appliedLoan.status}
                    </h4>
                  </div>
                  <span className="text-[9px] font-bold text-[#C55A11] bg-amber-50 px-2 py-0.5 rounded-full">
                    AI Skor: {appliedLoan.skorAi}/100
                  </span>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plafon</span>
                    <strong className="text-slate-800">
                      {formatIdr(appliedLoan.nominal)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tenor</span>
                    <span className="text-slate-800">{appliedLoan.tenor} bulan</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Angsuran/bln</span>
                    <span className="text-slate-800">
                      {formatIdr(appliedLoan.cicilanBulanan)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Hasil Skrining AI EWS
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3 h-3 rounded-full ${flagDot[appliedLoan.flagAi]}`}
                    />
                    <strong className="text-slate-800">
                      Rekomendasi: {appliedLoan.flagAi}
                    </strong>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
                    {appliedLoan.flagAlasan.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {appliedLoan.txLink && (
                  <a
                    href={appliedLoan.txLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-[#F06A6A] inline-flex items-center gap-1"
                  >
                    Lihat transaksi on-chain <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {/* Sanggah — most relevant when MERAH */}
                {appliedLoan.status === 'Diajukan' && !appliedLoan.isSanggah && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#C55A11] uppercase">
                        Flag AI keliru?
                      </span>
                      <button
                        onClick={() => setShowSanggah((v) => !v)}
                        className="text-[10px] font-extrabold text-[#F06A6A] underline"
                      >
                        {showSanggah ? 'Batal' : 'Ajukan Hak Sanggah'}
                      </button>
                    </div>
                    {showSanggah && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
                        <textarea
                          rows={3}
                          value={sanggahText}
                          onChange={(e) => setSanggahText(e.target.value)}
                          placeholder="Contoh: Nama saya tertukar dengan warga lain, saya tidak punya tunggakan..."
                          className="w-full border border-slate-300 rounded p-1.5 bg-white text-xs outline-none"
                        />
                        <button
                          onClick={handleSanggah}
                          disabled={busy}
                          className="w-full bg-[#F06A6A] hover:bg-[#E5544F] disabled:opacity-60 text-white font-bold py-1.5 rounded"
                        >
                          Kirim Sanggahan ke Pengurus
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {appliedLoan.isSanggah && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-900">
                    <strong>Sanggahan Terdaftar:</strong> "{appliedLoan.sanggahAlasan}"
                    — pengajuan ditangguhkan untuk verifikasi manual pengurus.
                  </div>
                )}

                <button
                  onClick={() => {
                    setAppliedLoan(null);
                    setShowSanggah(false);
                  }}
                  className="w-full bg-white border border-[#E4E4E4] hover:bg-slate-50 text-slate-600 font-bold text-xs py-2 rounded-lg"
                >
                  Ajukan Pinjaman Lain
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleApplyLoan}
                className="bg-white p-4 rounded-xl border border-slate-200 space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Nominal Pembiayaan (Rp)
                  </label>
                  <input
                    type="number"
                    step="500000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none"
                  />
                  {group && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Plafon kelompok: <strong>{formatIdr(group.plafonMaks)}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Tujuan Penggunaan Dana
                  </label>
                  <input
                    type="text"
                    value={loanPurpose}
                    onChange={(e) => setLoanPurpose(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Tenor Pengembalian
                  </label>
                  <select
                    value={loanTenor}
                    onChange={(e) => setLoanTenor(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2 bg-white"
                  >
                    <option value="6">6 Bulan</option>
                    <option value="10">10 Bulan</option>
                    <option value="12">12 Bulan</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={busy || !group}
                  className="w-full bg-[#F06A6A] hover:bg-[#E5544F] disabled:opacity-60 text-white font-extrabold text-xs py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menyaring…
                    </>
                  ) : (
                    'Ajukan & Jalankan Skrining AI'
                  )}
                </button>
              </form>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-[#C55A11] space-y-1">
              <h5 className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Transparansi Skrining
              </h5>
              <p className="text-slate-600 leading-relaxed">
                Kami menilai riwayat kelompok dan ketaatan tabungan Anda — bukan data
                ponsel pribadi. Anda berhak menyanggah bila flag AI keliru.
              </p>
            </div>
          </motion.div>
        )}

        {/* TAB PROFIL (Flow ①) */}
        {activeTab === 'profil' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                <User className="w-4 h-4 text-[#F06A6A]" /> Akun & e-KYC
              </h4>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <p className="text-slate-400">Status Akun</p>
                <strong className="text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                  {member.statusKyc === 'Approved' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#548235]" /> Aktif (e-KYC
                      Terverifikasi)
                    </>
                  ) : member.statusKyc === 'Requested' ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-[#C55A11]" /> Menunggu
                      Persetujuan
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-[#C0392B]" /> Ditolak
                    </>
                  )}
                </strong>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  ['Nama Lengkap', member.nama],
                  ['NIK', member.nik],
                  ['No. HP', member.noHp],
                  ['Pekerjaan', member.pekerjaan],
                  ['Alamat', member.alamat],
                  ['Peran', member.peran],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between py-1 border-b border-slate-100 gap-3"
                  >
                    <span className="text-slate-400 shrink-0">{k}</span>
                    <span className="font-bold text-slate-800 text-right capitalize">
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-[#FCE8E6]/60 border border-[#F06A6A]/15 rounded-lg p-3 space-y-1">
                <span className="text-[10px] font-black text-[#F06A6A] uppercase tracking-wider flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Alamat Dompet On-Chain
                </span>
                <p className="font-mono text-[11px] text-[#1E1F21] break-all">
                  {member.walletAddress ?? 'Belum diterbitkan (menunggu e-KYC)'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-[#548235] font-bold">
                <ShieldCheck className="w-4 h-4" /> Data terenkripsi & mengikuti UU PDP
                27/2022.
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="bg-white text-slate-600 py-2 border-t border-slate-200 flex justify-around items-center shrink-0 z-20 select-none">
        {(
          [
            ['beranda', Home, 'Beranda'],
            ['simpan', PiggyBank, 'Simpan'],
            ['grup', Users, 'Grup'],
            ['pinjaman', CreditCard, 'Pinjaman'],
            ['profil', User, 'Profil'],
          ] as [Tab, typeof Home, string][]
        ).map(([tab, Icon, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              activeTab === tab
                ? 'text-[#F06A6A] font-extrabold scale-105'
                : 'text-slate-400 hover:text-[#1E1F21]'
            }`}
          >
            <Icon className="w-4.5 h-4.5" />
            <span className="text-[9px]">{label}</span>
          </button>
        ))}
      </div>

      {/* Home indicator */}
      <div className="bg-[#1E1F21] pt-2 pb-2 flex justify-center shrink-0 z-20">
        <div className="w-24 h-1 bg-white/40 rounded-full" />
      </div>

      {/* QRIS mock modal */}
      {qris && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 text-center shadow-2xl border border-slate-200/60 relative overflow-hidden">
            <div className="bg-[#F06A6A] text-white p-3 -mx-5 -mt-5 mb-4 flex flex-col items-center gap-0.5 select-none">
              <span className="text-[8px] tracking-widest font-black uppercase text-amber-200">
                Gerbang QRIS Digital
              </span>
              <h4 className="text-xs font-black tracking-wide uppercase">
                Koperasi Merah Putih
              </h4>
            </div>
            <p className="text-[11px] text-[#6D6E6F] font-bold uppercase tracking-wider">
              {qris.title}
            </p>
            <strong className="text-xl font-black text-[#1E1F21] block mt-1">
              {formatIdr(qris.amount)}
            </strong>
            <div className="w-32 h-32 border-4 border-[#1E1F21] mx-auto my-4 bg-white p-2.5 grid grid-cols-4 gap-1 rounded-xl">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${i % 3 === 0 || i % 5 === 0 ? 'bg-[#F06A6A]' : 'bg-white'}`}
                />
              ))}
            </div>
            <div className="text-[10px] text-slate-400 font-medium px-2 leading-relaxed">
              Scan otomatis terhubung ke immutable ledger. Bebas biaya admin (gas
              relayer).
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setQris(null)}
                disabled={busy}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-2 rounded-xl text-[10px] uppercase tracking-wide"
              >
                Batal
              </button>
              <button
                onClick={() => void qris.onConfirm()}
                disabled={busy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-wide flex items-center justify-center gap-1"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Bayar QRIS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

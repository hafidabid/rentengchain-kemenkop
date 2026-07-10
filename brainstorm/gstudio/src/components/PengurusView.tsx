import React, { useState } from 'react';
import { Member, Group, Loan, SavingTransaction, AuditLog } from '../types';
import { BarChart3, Users, CreditCard, ShieldAlert, BadgePercent, Check, X, ShieldCheck, Activity, Landmark, FileLineChart, ArrowUpRight, Heart, RefreshCw } from 'lucide-react';
import RiskScreenerTool from './RiskScreenerTool';

interface PengurusViewProps {
  members: Member[];
  groups: Group[];
  loans: Loan[];
  savings: SavingTransaction[];
  logs: AuditLog[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  setSavings: React.Dispatch<React.SetStateAction<SavingTransaction[]>>;
  addLog: (aktor: string, aksi: string, detail: string) => void;
}

export default function PengurusView({
  members,
  groups,
  loans,
  savings,
  logs,
  setMembers,
  setGroups,
  setLoans,
  setSavings,
  addLog
}: PengurusViewProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'anggota' | 'grup' | 'pinjaman' | 'penagihan' | 'laporan' | 'screener'>('dashboard');

  // Format IDR helper
  const formatIdr = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  // KPI Calculations
  const totalOutstanding = loans.filter(l => l.status === 'Cair').reduce((a, b) => a + (b.cicilanBulanan * b.sisaCicilan), 0);
  const totalSavingsVal = members.reduce((sum, m) => sum + m.simpananPokok + m.simpananWajib + m.simpananSukarela, 0);
  const unpaidInstallmentsCount = loans.filter(l => l.status === 'Cair' && l.statusCicilan === 'UNPAID').length;
  const totalLoansCount = loans.filter(l => l.status === 'Cair').length;
  const nplRate = totalLoansCount > 0 ? Math.round((unpaidInstallmentsCount / totalLoansCount) * 100) : 0;
  const digitalAdoptionRate = Math.round((members.filter(m => m.simpananSukarela > 10000).length / members.length) * 100);
  const dormanCount = members.filter(m => m.isDorman).length;

  // Handle KYC Approval
  const handleKycAction = (id: string, action: 'Approved' | 'Rejected') => {
    const member = members.find(m => m.id === id);
    if (!member) return;

    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          statusKyc: action,
          // give starting savings if approved to activate account
          simpananPokok: action === 'Approved' ? 100000 : 0,
          isDorman: action !== 'Approved'
        };
      }
      return m;
    }));

    if (action === 'Approved') {
      addLog('Pengurus', 'Persetujuan e-KYC', `Menyetujui pendaftaran e-KYC dan membuka wallet simpanan pokok Rp100.000 untuk ${member.nama}.`);
      alert(`e-KYC untuk ${member.nama} berhasil disetujui! Wallet simpanan diaktifkan.`);
    } else {
      addLog('Pengurus', 'Penolakan e-KYC', `Menolak pendaftaran e-KYC untuk ${member.nama}.`);
      alert(`Pendaftaran ${member.nama} telah ditolak.`);
    }
  };

  // Handle Loan Approval
  const handleLoanAction = (id: string, action: 'Disetujui' | 'Ditunda') => {
    const loan = loans.find(l => l.id === id);
    if (!loan) return;
    const member = members.find(m => m.id === loan.memberId);
    if (!member) return;

    setLoans(prev => prev.map(l => {
      if (l.id === id) {
        return {
          ...l,
          status: action === 'Disetujui' ? 'Cair' : 'Ditunda'
        };
      }
      return l;
    }));

    if (action === 'Disetujui') {
      addLog('Pengurus', 'Pencairan Escrow', `Menyetujui pinjaman ${formatIdr(loan.nominal)} untuk ${member.nama}. Memulai rilis dana otomatis via Escrow.`);
      alert(`Pinjaman ${member.nama} sebesar ${formatIdr(loan.nominal)} disetujui! Escrow dirilis bertahap ke dompet digital anggota.`);
    } else {
      addLog('Pengurus', 'Review Pinjaman', `Menunda keputusan pinjaman untuk ${member.nama} karena memerlukan investigasi lebih lanjut.`);
      alert(`Status pinjaman diubah menjadi Ditunda.`);
    }
  };

  // Toggle Uzur
  const handleToggleUzur = (id: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        const newUzur = !m.isUzur;
        if (newUzur) {
          // Find active loan of the member and apply penalty-free rescheduling
          addLog('Pengurus', 'Tandai Uzur', `Menandai ${m.nama} dalam status Uzur (Sakit/Musibah). Mengaktifkan subsidi dana sosial kelompok.`);
          alert(`${m.nama} berhasil ditandai UZUR. Sistem menonaktifkan denda keterlambatan dan merilis opsi dana sosial.`);
        } else {
          addLog('Pengurus', 'Pulih Uzur', `Menghapus status Uzur untuk ${m.nama}.`);
        }
        return {
          ...m,
          isUzur: newUzur,
          jumlahIzinUzur: newUzur ? m.jumlahIzinUzur + 1 : m.jumlahIzinUzur
        };
      }
      return m;
    }));
  };

  // Apply social fund coverage for an unpaid loan due to Uzur
  const handleApplySocialFund = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    const group = groups.find(g => g.id === loan.groupId);
    if (!group) return;

    if (group.kasSosial < loan.cicilanBulanan) {
      alert(`Kas Sosial Kelompok (${formatIdr(group.kasSosial)}) kurang untuk menutupi cicilan (${formatIdr(loan.cicilanBulanan)}). Harap pakai opsi restrukturisasi.`);
      return;
    }

    // Deduct social fund, mark loan as PAID (or DITALANGI with social fund)
    setGroups(prev => prev.map(g => {
      if (g.id === group.id) {
        return {
          ...g,
          kasSosial: g.kasSosial - loan.cicilanBulanan
        };
      }
      return g;
    }));

    setLoans(prev => prev.map(l => {
      if (l.id === loanId) {
        return {
          ...l,
          statusCicilan: 'PAID',
          sisaCicilan: l.sisaCicilan - 1,
          status: l.sisaCicilan - 1 <= 0 ? 'Lunas' : l.status,
          jadwalCicilan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      }
      return l;
    }));

    addLog('Pengurus', 'Kas Sosial Rilis', `Membayar cicilan ${formatIdr(loan.cicilanBulanan)} untuk anggota Uzur (${members.find(m => m.id === loan.memberId)?.nama}) menggunakan dana Kas Sosial Kelompok.`);
    alert(`Sukses! Angsuran ditalangi sepenuhnya oleh Kas Sosial Kelompok. Anggota tidak ditandai menunggak dan skor aman.`);
  };

  // Restructure loan
  const handleRestructureLoan = (loanId: string) => {
    setLoans(prev => prev.map(l => {
      if (l.id === loanId) {
        const newCicilan = Math.round(l.cicilanBulanan * 0.6); // 40% reduction
        const newTenor = l.sisaCicilan + 3; // extend tenor
        return {
          ...l,
          cicilanBulanan: newCicilan,
          sisaCicilan: newTenor,
          statusCicilan: 'PAID' // mark paid for this period as relief
        };
      }
      return l;
    }));
    addLog('Pengurus', 'Restrukturisasi', `Menyetujui restrukturisasi pinjaman ID ${loanId}: Memperpanjang tenor & memotong cicilan bulanan.`);
    alert(`Pinjaman berhasil direstrukturisasi! Tenor diperpanjang +3 bulan dan cicilan dipotong 40% agar lebih ringan.`);
  };

  // Trigger group collection penalty (Tanggung Renteng)
  const handleTriggerJointLiability = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    const member = members.find(m => m.id === loan.memberId);
    if (!member) return;

    setLoans(prev => prev.map(l => {
      if (l.id === loanId) {
        return {
          ...l,
          statusCicilan: 'DITALANGI' as const
        };
      }
      return l;
    }));

    // Penalize member score
    setMembers(prev => prev.map(m => {
      if (m.id === loan.memberId) {
        return {
          ...m,
          skorKeanggotaan: Math.max(0, m.skorKeanggotaan - 15)
        };
      }
      return m;
    }));

    addLog('Sistem', 'Tanggung Renteng Aktif', `Masa tenggang habis untuk ${member.nama}. Kewajiban cicilan ditalangi secara gotong-royong oleh iuran grup.`);
    alert(`Mekanisme Tanggung Renteng Aktif! Anggota kelompok bergotong-royong menalangi angsuran agar catatan kelompok tetap lancar. Skor pelanggar dikurangi.`);
  };

  return (
    <div className="w-full bg-[#FAF9F8] rounded-2xl border border-[#E4E4E4] overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[600px]">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-[#1E1F21] text-white p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-6">
            <Landmark className="w-6 h-6 text-[#F06A6A]" />
            <div>
              <h3 className="font-extrabold text-sm tracking-wider uppercase">RantaiRenteng</h3>
              <span className="text-[10px] text-slate-400">Sistem Pengurus v1.0</span>
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <BarChart3 className="w-4 h-4 text-white" /> Dashboard EWS
            </button>
            <button
              onClick={() => setActiveTab('anggota')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'anggota' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <Users className="w-4 h-4" /> Antre KYC ({members.filter(m => m.statusKyc === 'Requested').length})
            </button>
            <button
              onClick={() => setActiveTab('grup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'grup' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <Users className="w-4 h-4" /> Kelola Kelompok
            </button>
            <button
              onClick={() => setActiveTab('pinjaman')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'pinjaman' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <CreditCard className="w-4 h-4" /> Review Pinjaman ({loans.filter(l => l.status === 'Diajukan').length})
            </button>
            <button
              onClick={() => setActiveTab('penagihan')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'penagihan' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <ShieldAlert className="w-4 h-4 text-[#F1BD6C]" /> Tangga Penagihan
            </button>
            <button
              onClick={() => setActiveTab('laporan')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'laporan' ? 'bg-[#F06A6A] text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <FileLineChart className="w-4 h-4" /> Laporan & e-RAT
            </button>
            <button
              onClick={() => setActiveTab('screener')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition-all ${activeTab === 'screener' ? 'bg-[#F1BD6C] text-[#1E1F21] shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Skrining AI EWS (Kalkulator)
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-[#E4E4E4]/10 text-[10px] text-slate-400 space-y-1.5">
          <p className="font-semibold text-[#FAF9F8]">Governance Guard:</p>
          <p className="opacity-80 leading-relaxed">Semua aksi pengurus & escrow terikat kontrak tercatat aman di audit log ledger.</p>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 p-6 overflow-y-auto max-h-[700px] bg-[#FAF9F8]">
        
        {/* TAB 1: DASHBOARD EWS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-[#1E1F21]">Dashboard Early Warning System (EWS)</h2>
                <p className="text-xs text-[#6D6E6F]">Mendeteksi risiko kelompok secara dini untuk mencegah NPL koperasi.</p>
              </div>
              <span className="text-xs font-bold text-[#1E1F21] bg-white border border-[#E4E4E4] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#62D26F] inline-block"></span> RAT 2026: Terlaksana
              </span>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">% Simpanan Unpaid</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-[#F06A6A]">{nplRate}%</span>
                  <span className="text-[10px] text-[#F06A6A] font-semibold bg-[#FCE8E6] px-1.5 py-0.5 rounded">Rasio Warning</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Simpanan Ledger</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-base font-black text-[#1E1F21]">{formatIdr(totalSavingsVal)}</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Adopsi Akun Digital</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-[#62D26F]">{digitalAdoptionRate}%</span>
                  <span className="text-[10px] text-slate-400">Anggota Aktif</span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Anggota Dorman</span>
                <div className="flex justify-between items-baseline mt-1.5">
                  <span className="text-xl font-black text-[#1E1F21]">{dormanCount} / {members.length}</span>
                  <span className="text-[10px] text-[#F06A6A] font-semibold bg-[#FCE8E6] px-1.5 py-0.5 rounded">Tinggi</span>
                </div>
              </div>
            </div>

            {/* EWS Alert - Risky Groups or Members */}
            <div className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm overflow-hidden">
              <div className="bg-[#FCE8E6] px-4 py-3 border-b border-[#F06A6A]/10 flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#F06A6A] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#F06A6A]" /> Peringatan Kelompok Berisiko Tinggi
                </h4>
                <span className="text-[10px] bg-[#F06A6A] text-white font-bold px-2 py-0.5 rounded-full animate-pulse">EWS Paling Berisiko</span>
              </div>
              <div className="divide-y divide-slate-100">
                {loans.filter(l => l.statusCicilan === 'UNPAID' || l.flagAi === 'MERAH' || l.statusCicilan === 'DITALANGI').map(l => {
                  const m = members.find(x => x.id === l.memberId);
                  const g = groups.find(x => x.id === l.groupId);
                  if (!m || !g) return null;

                  return (
                    <div key={l.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400">{g.nama}</span>
                        <h5 className="font-bold text-[#1E1F21] text-sm mt-0.5">{m.nama}</h5>
                        <p className="text-slate-500 mt-1">
                          Masalah: <strong className="text-[#F06A6A]">
                            {l.statusCicilan === 'DITALANGI' ? 'Tanggung Renteng Aktif (Tunggakan ditalangi Kelompok)' : l.flagAi === 'MERAH' ? 'AI Flag Merah - Tunggakan Tersembunyi' : 'Angsuran Jatuh Tempo Unpaid'}
                          </strong>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab('penagihan')}
                          className="bg-white hover:bg-[#FCE8E6]/25 border border-[#F06A6A]/20 text-[#F06A6A] font-extrabold px-3 py-1.5 rounded-xl transition-all"
                        >
                          Tindak Lanjut Penagihan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Logs Overview */}
            <div className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm p-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Immutable Audit Log Ledger (Transparansi)</span>
              <div className="space-y-2 max-h-[200px] overflow-y-auto font-mono text-[11px] text-[#6D6E6F] bg-[#FAF9F8] p-3 rounded-xl border border-[#E4E4E4]">
                {logs.slice().reverse().map(log => (
                  <div key={log.id} className="border-b border-[#E4E4E4]/60 pb-1.5 last:border-0">
                    <span className="text-slate-400">[{log.timestamp}]</span> <strong className="text-[#62D26F]">{log.aktor}</strong>: <span className="text-slate-800">{log.aksi}</span> &rarr; <span className="text-slate-500">{log.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KYC VERIFICATION QUEUE */}
        {activeTab === 'anggota' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Verifikasi e-KYC Anggota</h2>
              <p className="text-xs text-[#6D6E6F]">Antrean pendaftaran digital. Melakukan verifikasi identitas (NIK) & verifikasi fisik.</p>
            </div>

            <div className="space-y-3">
              {members.filter(m => m.statusKyc === 'Requested').length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                  Tidak ada antrean registrasi e-KYC saat ini. Semua anggota telah terverifikasi.
                </div>
              ) : (
                members.filter(m => m.statusKyc === 'Requested').map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-xl border border-[#E4E4E4] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#1E1F21]">{m.nama}</h4>
                        <span className="text-[9px] bg-[#F1BD6C]/10 border border-[#F1BD6C]/20 text-[#F1BD6C] px-2.5 py-0.5 rounded-full font-bold">REKRUT BARU</span>
                      </div>
                      <p className="text-slate-500">NIK: {m.nik} · Telp: {m.noHp}</p>
                      <p className="text-slate-500">Alamat: {m.alamat} · Pekerjaan: <strong>{m.pekerjaan}</strong></p>
                      <p className="text-slate-500">Mendaftarkan Peran: <span className="capitalize font-bold text-[#62D26F]">{m.peran}</span></p>
                      
                      {/* Photo placeholder info */}
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-[#FAF9F8] border border-[#E4E4E4] px-2.5 py-1 rounded text-[10px] text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-[#62D26F]"></span> Foto KTP & Selfie Terlampir (Sesuai NIK Dukcapil)
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleKycAction(m.id, 'Rejected')}
                        className="bg-white border border-[#E4E4E4] hover:bg-[#FCE8E6]/30 text-[#F06A6A] font-bold p-2.5 rounded-xl transition-all"
                        title="Tolak"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleKycAction(m.id, 'Approved')}
                        className="bg-[#62D26F] hover:bg-[#52C25F] text-white font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Check className="w-4 h-4" /> Setujui & Rilis Wallet
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: KELOLA KELOMPOK */}
        {activeTab === 'grup' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Manajemen Kelompok Tanggung Renteng</h2>
              <p className="text-xs text-[#6D6E6F]">Konfigurasi ketua, plafon kelompok, pencatatan absensi kehadiran bulanan, & kas kelompok.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groups.map(g => {
                const ketua = members.find(m => m.id === g.ketuaId);

                return (
                  <div key={g.id} className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#1E1F21]">{g.nama}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Pertemuan: {g.jadwalPertemuan}</p>
                      </div>
                      <span className="text-[10px] bg-[#FCE8E6] border border-[#F06A6A]/10 text-[#F06A6A] px-2.5 py-1 rounded-full font-bold">
                        Hadir: {g.kehadiranRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#FAF9F8] p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Ketua Kelompok</span>
                        <strong className="text-slate-800">{ketua ? ketua.nama : 'Tidak Ada'}</strong>
                      </div>
                      <div className="bg-[#FAF9F8] p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Plafon Kredit Maks</span>
                        <strong className="text-[#1E1F21]">{formatIdr(g.plafonMaks)}</strong>
                      </div>
                      <div className="bg-[#FAF9F8] p-2 rounded-lg col-span-2">
                        <span className="text-[10px] text-slate-400 block">Kas Sosial Kelompok</span>
                        <strong className="text-[#62D26F]">{formatIdr(g.kasSosial)}</strong>
                      </div>
                    </div>

                    {/* Member details inside group */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Anggota Terikat ({g.anggotaIds.length})</span>
                      <div className="space-y-1">
                        {g.anggotaIds.map(mId => {
                          const m = members.find(x => x.id === mId);
                          if (!m) return null;
                          return (
                            <div key={m.id} className="text-xs flex justify-between bg-[#FAF9F8] px-2.5 py-1.5 rounded">
                              <span className="font-semibold text-slate-700">{m.nama}</span>
                              <span className="text-slate-400">{m.pekerjaan} · Skor {m.skorKeanggotaan}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: REVIEW & SETUJUI PINJAMAN */}
        {activeTab === 'pinjaman' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Review & Persetujuan Pembiayaan</h2>
              <p className="text-xs text-[#6D6E6F]">Melihat hasil skrining risiko AI + jaminan kelompok sebelum menyetujui pelepasan escrow.</p>
            </div>

            <div className="space-y-4">
              {loans.filter(l => l.status === 'Diajukan').length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                  Tidak ada pengajuan pinjaman yang perlu ditinjau saat ini.
                </div>
              ) : (
                loans.filter(l => l.status === 'Diajukan').map(l => {
                  const m = members.find(x => x.id === l.memberId);
                  const g = groups.find(x => x.id === l.groupId);
                  if (!m || !g) return null;

                  return (
                    <div key={l.id} className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm overflow-hidden">
                      {/* Alert/Review Header */}
                      <div className={`px-4 py-3 border-b flex justify-between items-center ${
                        l.flagAi === 'MERAH' ? 'bg-[#FCE8E6] border-[#F06A6A]/10 text-[#F06A6A]' : l.flagAi === 'KUNING' ? 'bg-[#FDF6E2] border-[#F1BD6C]/10 text-[#F1BD6C]' : 'bg-[#EDF9F0] border-[#62D26F]/10 text-[#62D26F]'
                      }`}>
                        <span className="text-xs font-extrabold flex items-center gap-1">
                          <Activity className="w-4 h-4" /> REKOMENDASI AI: {l.flagAi} (Skor {l.skorAi}/100)
                        </span>
                        <span className="text-[10px] font-bold uppercase">
                          {l.isSanggah ? '⚠️ Ada Sanggahan Anggota' : 'Menunggu Review'}
                        </span>
                      </div>

                      <div className="p-4 space-y-4 text-xs">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div>
                            <span className="text-[10px] text-slate-400">Calon Peminjam</span>
                            <h4 className="font-extrabold text-sm text-[#1E1F21] mt-0.5">{m.nama}</h4>
                            <p className="text-[#6D6E6F]">{m.pekerjaan} · Skor Keanggotaan {m.skorKeanggotaan}</p>
                            <p className="text-slate-400 text-[10px]">Grup: {g.nama}</p>
                          </div>
                          <div className="sm:text-right">
                            <span className="text-[10px] text-slate-400 block">Jumlah Pengajuan</span>
                            <strong className="text-[#1E1F21] text-base block mt-0.5">{formatIdr(l.nominal)}</strong>
                            <span className="text-[10px] text-[#6D6E6F] block">Tenor: {l.tenor} Bulan · Angsuran {formatIdr(l.cicilanBulanan)}/bln</span>
                          </div>
                        </div>

                        {/* Sinyal Risiko Breakdown */}
                        <div className="bg-[#FAF9F8] p-3 rounded-xl border border-[#E4E4E4]">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Butir Analisis AI</span>
                          <ul className="list-disc pl-4 space-y-1 text-[#6D6E6F]">
                            {l.flagAlasan.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>

                        {/* If sanggah is submitted */}
                        {l.isSanggah && (
                          <div className="bg-[#F0F4F8] border border-[#A2B6C7]/20 text-[#305A80] p-3 rounded-xl">
                            <strong className="block text-[11px] mb-1">⚖️ Pembelaan & Hak Sanggah Anggota:</strong>
                            <p className="italic">"{l.sanggahAlasan}"</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 border-t border-[#E4E4E4] pt-3">
                          <button
                            onClick={() => handleLoanAction(l.id, 'Ditunda')}
                            className="bg-white border border-[#E4E4E4] hover:bg-slate-50 text-slate-600 font-bold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Tunda / Minta Klarifikasi
                          </button>
                          <button
                            onClick={() => handleLoanAction(l.id, 'Disetujui')}
                            className="bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all"
                          >
                            Setujui & Rilis Escrow
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 5: PENAGIHAN & TANGGUNG RENTENG LADDER */}
        {activeTab === 'penagihan' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Tangga Penagihan (Arrears & Joint Liability)</h2>
              <p className="text-xs text-[#6D6E6F]">Bedakan alasan terlambat: Sakit/Uzur (Sikap Empati) vs Tanpa Kabar/Mangkir (Tanggung Renteng & Sanksi).</p>
            </div>

            {/* Arrears lists */}
            <div className="space-y-4">
              {loans.filter(l => l.status === 'Cair' && (l.statusCicilan === 'UNPAID' || l.statusCicilan === 'DITALANGI')).map(l => {
                const m = members.find(x => x.id === l.memberId);
                const g = groups.find(x => x.id === l.groupId);
                if (!m || !g) return null;

                return (
                  <div key={l.id} className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm space-y-4 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">{g.nama}</span>
                        <h4 className="font-extrabold text-sm text-[#1E1F21] mt-0.5">{m.nama}</h4>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                          m.isUzur ? 'bg-[#FDF6E2] text-[#F1BD6C]' : 'bg-[#FCE8E6] text-[#F06A6A]'
                        }`}>
                          {m.isUzur ? '🟢 Uzur Terdaftar' : '🔴 Tanpa Keterangan / Terlambat'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Tunggakan Bulan Ini</span>
                        <strong className="text-[#F06A6A] text-sm block mt-0.5">{formatIdr(l.cicilanBulanan)}</strong>
                        <span className="text-[9px] text-slate-400 block">Jatuh Tempo: {l.jadwalCicilan}</span>
                      </div>
                    </div>

                    {/* Step-by-Step Collection Ladder Info */}
                    <div className="bg-[#FAF9F8] p-3 rounded-xl border border-[#E4E4E4] space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Metrik Tangga Penagihan:</span>
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                        <div className="bg-[#F06A6A]/10 text-[#F06A6A] p-1.5 rounded font-bold">
                          1. Reminder WA (Aktif)
                        </div>
                        <div className={`p-1.5 rounded font-bold ${l.statusCicilan === 'DITALANGI' ? 'bg-[#F06A6A] text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                          2. Tanggung Renteng
                        </div>
                        <div className="bg-slate-100 text-slate-400 p-1.5 rounded font-bold">
                          3. Restrukturisasi
                        </div>
                        <div className="bg-slate-100 text-slate-400 p-1.5 rounded font-bold">
                          4. Sanksi / Audit
                        </div>
                      </div>
                    </div>

                    {/* Conditional Action Buttons based on Uzur Status */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E4E4] pt-3">
                      <div>
                        <button
                          onClick={() => handleToggleUzur(m.id)}
                          className={`font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${
                            m.isUzur
                              ? 'bg-[#FDF6E2] border-[#F1BD6C]/20 text-[#F1BD6C]'
                              : 'bg-white hover:bg-slate-100 border-[#E4E4E4] text-slate-600'
                          }`}
                        >
                          <Heart className="w-4 h-4 shrink-0" /> {m.isUzur ? 'Hapus Status Uzur' : 'Tandai Uzur (Sakit)'}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        {m.isUzur ? (
                          <>
                            <button
                              onClick={() => handleApplySocialFund(l.id)}
                              className="bg-[#62D26F] hover:bg-[#52C25F] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm"
                            >
                              Talangi via Kas Sosial Grup
                            </button>
                            <button
                              onClick={() => handleRestructureLoan(l.id)}
                              className="bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm"
                            >
                              Relief / Jadwal Ulang
                            </button>
                          </>
                        ) : (
                          <>
                            {l.statusCicilan !== 'DITALANGI' && (
                              <button
                                onClick={() => handleTriggerJointLiability(l.id)}
                                className="bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm"
                              >
                                Aktifkan Tanggung Renteng Kelompok
                              </button>
                            )}
                            <button
                              onClick={() => handleRestructureLoan(l.id)}
                              className="bg-white border border-[#E4E4E4] hover:bg-slate-100 text-slate-600 font-bold px-3.5 py-2 rounded-xl transition-all"
                            >
                              Musyawarah Restrukturisasi
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loans.filter(l => l.status === 'Cair' && (l.statusCicilan === 'UNPAID' || l.statusCicilan === 'DITALANGI')).length === 0 && (
                <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                  Luar biasa! Tidak ada tunggakan berjalan di koperasi saat ini. % NPL = 0%.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: LAPORAN & E-RAT */}
        {activeTab === 'laporan' && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Laporan Transparansi & e-RAT</h2>
              <p className="text-xs text-[#6D6E6F]">Publikasi berkala perkembangan keuangan koperasi yang disiarkan langsung ke anggota.</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E4E4E4] space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-extrabold text-[#1E1F21] uppercase tracking-wider text-sm">REKAPITULASI NERACA KOPERASI</span>
                <span className="text-[10px] text-slate-400">Update: Real-time dari ledger</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FAF9F8] p-3 rounded-lg">
                  <span className="text-slate-400">Total Aset Likuid (Tabungan)</span>
                  <strong className="text-base text-slate-800 block mt-1">{formatIdr(totalSavingsVal)}</strong>
                </div>
                <div className="bg-[#FAF9F8] p-3 rounded-lg">
                  <span className="text-slate-400">Total Piutang Berjalan (Escrow)</span>
                  <strong className="text-base text-[#62D26F] block mt-1">{formatIdr(totalOutstanding)}</strong>
                </div>
                <div className="bg-[#FAF9F8] p-3 rounded-lg">
                  <span className="text-slate-400">Jumlah Kelompok Tanggung Renteng</span>
                  <strong className="text-base text-slate-800 block mt-1">{groups.length} Kelompok</strong>
                </div>
                <div className="bg-[#FAF9F8] p-3 rounded-lg">
                  <span className="text-slate-400">Keanggotaan Terdaftar</span>
                  <strong className="text-base text-slate-800 block mt-1">{members.length} Orang</strong>
                </div>
              </div>

              <div className="p-3 bg-[#EDF9F0] border border-[#62D26F]/20 rounded-xl text-slate-700 space-y-1">
                <h4 className="font-bold text-[#1E1F21]">Keberhasilan Tata Kelola (Rasio NPL Aman)</h4>
                <p className="text-[#6D6E6F]">
                  Sistem agunan sosial Tanggung Renteng mengunci persentase gagal bayar tetap di angka <strong className="text-[#62D26F]">{nplRate}%</strong>. Jauh di bawah batas bahaya industri (5%).
                </p>
              </div>
            </div>

            {/* Annual Meeting RAT info */}
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status RAT Digital (e-RAT)</span>
              <div className="flex justify-between items-center bg-[#FAF9F8] p-3 rounded-xl">
                <div>
                  <h5 className="font-bold text-slate-800">RAT Tahun Buku 2025</h5>
                  <p className="text-[10px] text-slate-400">Tingkat kehadiran digital: 100% via aplikasi RantaiRenteng</p>
                </div>
                <span className="bg-[#62D26F] text-white px-2.5 py-1 rounded-lg font-bold uppercase text-[9px]">Selesai</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SCREENER AI ENHANCED */}
        {activeTab === 'screener' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">Asisten Skrining EWS AI (Tinjauan Manual)</h2>
              <p className="text-xs text-[#6D6E6F]">Gunakan simulasi parameter ini untuk menghitung secara transparan kelayakan sebelum pencairan.</p>
            </div>
            <RiskScreenerTool />
          </div>
        )}

      </div>

    </div>
  );
}

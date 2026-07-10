import React, { useState } from 'react';
import { Member, Group, Loan, SavingTransaction, AuditLog } from './types';
import { initialMembers, initialGroups, initialLoans, initialSavings, initialLogs } from './mockData';
import AnggotaView from './components/AnggotaView';
import PengurusView from './components/PengurusView';
import { Shield, Sparkles, Smartphone, Users, HelpCircle, Landmark, Play, RotateCcw, AlertCircle, Info, ChevronRight, Check } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'anggota' | 'pengurus'>('anggota');
  const [activeMemberId, setActiveMemberId] = useState<string>('m1'); // default is Bu Sri

  // Core synchronized memory state
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [savings, setSavings] = useState<SavingTransaction[]>(initialSavings);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);

  // Active scenario explanation tracking
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [scenarioExplanation, setScenarioExplanation] = useState<string>('');

  const addLog = (aktor: string, aksi: string, detail: string) => {
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      aktor,
      aksi,
      detail
    };
    setLogs(prev => [...prev, newLog]);
  };

  const resetAllState = () => {
    setMembers(JSON.parse(JSON.stringify(initialMembers)));
    setGroups(JSON.parse(JSON.stringify(initialGroups)));
    setLoans(JSON.parse(JSON.stringify(initialLoans)));
    setSavings(JSON.parse(JSON.stringify(initialSavings)));
    setLogs(JSON.parse(JSON.stringify(initialLogs)));
    setActiveMemberId('m1');
    setActiveScenario(null);
    setScenarioExplanation('');
    addLog('Sistem', 'Reset', 'Melakukan reset simulasi ke data awal.');
    alert('Simulasi RantaiRenteng berhasil di-reset ke data awal!');
  };

  // Scenario 1: Positif - Bayar tepat waktu
  const triggerScenarioPositif = () => {
    // Set Sri's loan to unpaid first so user can experience paying it,
    // or simulate that she just paid it instantly
    setLoans(prev => prev.map(l => {
      if (l.memberId === 'm1') {
        return {
          ...l,
          statusCicilan: 'PAID',
          sisaCicilan: Math.max(0, l.sisaCicilan - 1)
        };
      }
      return l;
    }));

    setMembers(prev => prev.map(m => {
      if (m.id === 'm1') {
        return {
          ...m,
          skorKeanggotaan: Math.min(100, m.skorKeanggotaan + 3)
        };
      }
      return m;
    }));

    setActiveMemberId('m1');
    setRole('anggota');
    setActiveScenario('positif');
    setScenarioExplanation(
      'Skenario Positif (Bu Sri): Bu Sri membayar cicilan tepat waktu via QRIS. Saldo tercatat di ledger, skor keanggotaan otomatis naik (+3), dan escrow rilis aman karena rekam jejak kelompok 100% lancar.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Positif diaktifkan: Bu Sri melunasi angsuran tepat waktu.');
  };

  // Scenario 2: Uzur (sakit) - Tanpa penalti
  const triggerScenarioUzur = () => {
    // Set Pak Deni as unpaid first, set isUzur
    setMembers(prev => prev.map(m => {
      if (m.id === 'm2') {
        return {
          ...m,
          isUzur: true,
          skorKeanggotaan: 78 // keeps score intact
        };
      }
      return m;
    }));

    setLoans(prev => prev.map(l => {
      if (l.memberId === 'm2') {
        return {
          ...l,
          statusCicilan: 'UNPAID', // is now overdue but marked as Uzur
          jadwalCicilan: '2026-07-05'
        };
      }
      return l;
    }));

    setActiveMemberId('m2');
    setRole('pengurus'); // switch to admin so they can see the mitigation options
    setActiveScenario('uzur');
    setScenarioExplanation(
      'Skenario Uzur (Pak Deni): Pak Deni (petani) sakit & mengajukan izin uzur. Pengurus menandai status UZUR. Skor keanggotaan Pak Deni aman (tidak dipotong). Pengurus kini mendapat tombol empati: "Talangi via Kas Sosial Grup" (menggunakan dana kas sosial Rp350.000) atau "Relief / Jadwal Ulang" tanpa penalti.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Uzur diaktifkan: Pak Deni sakit, pengurus mengaktifkan jalur empati.');
  };

  // Scenario 3: Telat tanpa kabar - Tanggung Renteng Aktif (kelompok menalangi)
  const triggerScenarioNoNews = () => {
    // Set Pak Deni as unpaid, trigger Joint Liability
    setLoans(prev => prev.map(l => {
      if (l.memberId === 'm2') {
        return {
          ...l,
          statusCicilan: 'DITALANGI', // group covered
        };
      }
      return l;
    }));

    setMembers(prev => prev.map(m => {
      if (m.id === 'm2') {
        return {
          ...m,
          skorKeanggotaan: Math.max(0, m.skorKeanggotaan - 15), // severely drops
          isUzur: false
        };
      }
      return m;
    }));

    setActiveMemberId('m2');
    setRole('anggota'); // Show the member how their dashboard looks with peer pressure
    setActiveScenario('no_news');
    setScenarioExplanation(
      'Skenario Telat Tanpa Kabar (Tanggung Renteng): Masa tenggang Pak Deni habis tanpa kabar. Sistem mengaktifkan tanggung renteng! Kelompok menalangi dari iuran iuran bersama. Kelompok tetap lancar, namun skor individu Pak Deni anjlok (-15 poin) dan notifikasi sungkan dikirim ke ponselnya.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Tanggung Renteng diaktifkan: Kelompok menalangi tunggakan Pak Deni.');
  };

  // Scenario 4: Mangkir Berulang
  const triggerScenarioMangkir = () => {
    // Set Pak X to red risk and block new applications
    setLoans(prev => prev.map(l => {
      if (l.memberId === 'm3') {
        return {
          ...l,
          status: 'Diajukan',
          flagAi: 'MERAH',
          skorAi: 35
        };
      }
      return l;
    }));

    setMembers(prev => prev.map(m => {
      if (m.id === 'm3') {
        return {
          ...m,
          skorKeanggotaan: 38,
          isDorman: true
        };
      }
      return m;
    }));

    setGroups(prev => prev.map(g => {
      if (g.id === 'g2') {
        return {
          ...g,
          reputasiKomunitas: 'kurang'
        };
      }
      return g;
    }));

    setRole('pengurus'); // Show admin the EWS dashboard and decision review
    setActiveScenario('mangkir');
    setScenarioExplanation(
      'Skenario Mangkir Berulang (Pak X): Terjadi risiko tinggi berkelanjutan. Escrow otomatis menahan pinjaman baru. Pengurus menjadwalkan musyawarah mediasi kelompok via aplikasi untuk merestrukturisasi angsuran atau mengeksekusi sanksi AD/ART.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Mangkir Berulang diaktifkan: Memblokir pencairan baru dan memicu mediasi kelompok.');
  };

  // Scenario 5: e-KYC Baru (Pak Budi)
  const triggerScenarioKyc = () => {
    setActiveMemberId('m6'); // Pak Budi Santoso who has status 'Requested'
    setRole('anggota');
    setActiveScenario('kyc');
    setScenarioExplanation(
      'Skenario e-KYC (Pak Budi): Pak Budi mendaftar secara digital. Akunnya berstatus "Requested" (tertunda). Pengurus dapat melihat pengajuannya di menu "Antre KYC" panel pengurus, memverifikasi data NIK Dukcapil, lalu mengeklik "Setujui" untuk merilis wallet simpanan pokok.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario e-KYC diaktifkan: Menyorot Pak Budi yang sedang mengantre verifikasi.');
  };

  // Scenario 6: Pembentukan Kelompok Baru (Bu Fatimah)
  const triggerScenarioGrupBaru = () => {
    setMembers(prev => {
      if (prev.some(m => m.id === 'm7')) return prev;
      return [
        ...prev,
        {
          id: 'm7',
          nama: 'Bu Fatimah',
          nik: '3273012345670007',
          noHp: '081234567896',
          alamat: 'RT 05 / RW 05, Desa Sukamaju',
          pekerjaan: 'Penjual Gorengan',
          peran: 'keduanya',
          statusKyc: 'Approved',
          skorKeanggotaan: 80,
          simpananPokok: 100000,
          simpananWajib: 0,
          simpananSukarela: 0,
          isDorman: false,
          isUzur: false,
          jumlahIzinUzur: 0
        }
      ];
    });
    setActiveMemberId('m7');
    setRole('anggota');
    setActiveScenario('grup_baru');
    setScenarioExplanation(
      'Skenario Grup Baru (Bu Fatimah): Bu Fatimah adalah anggota yang e-KYC-nya baru disetujui. Dia belum memiliki kelompok tanggung renteng. Buka tab "Grup" di layar HP untuk membuat kelompok baru ("Kamboja") atau bergabung dengan kelompok yang sudah ada.'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Grup Baru diaktifkan: Membuka dashboard Bu Fatimah (belum berkelompok).');
  };

  // Scenario 7: Undangan Kelompok Tanggung Renteng
  const triggerScenarioUndangan = () => {
    setMembers(prev => {
      if (prev.some(m => m.id === 'm7')) return prev;
      return [
        ...prev,
        {
          id: 'm7',
          nama: 'Bu Fatimah',
          nik: '3273012345670007',
          noHp: '081234567896',
          alamat: 'RT 05 / RW 05, Desa Sukamaju',
          pekerjaan: 'Penjual Gorengan',
          peran: 'keduanya',
          statusKyc: 'Approved',
          skorKeanggotaan: 80,
          simpananPokok: 100000,
          simpananWajib: 0,
          simpananSukarela: 0,
          isDorman: false,
          isUzur: false,
          jumlahIzinUzur: 0
        }
      ];
    });
    setActiveMemberId('m7');
    setRole('anggota');
    setActiveScenario('undangan');
    setScenarioExplanation(
      'Skenario Kode Undangan (Bu Fatimah): Bu Fatimah belum bergabung kelompok tanggung renteng. Dia menerima kode undangan "MAWAR9" dari Bu Sri (Mawar Melati). Silakan masuk ke tab "Grup" di HP Bu Fatimah, masukkan "MAWAR9" di kolom "Gabung via Kode Undangan", lalu klik "Gabung"!'
    );
    addLog('Sistem', 'Simulasi Skenario', 'Skenario Kode Undangan diaktifkan: Menyorot kemudahan gabung kelompok via kode rujukan sosial.');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F8] font-sans text-[#1E1F21] flex flex-col justify-between">
      
      {/* Top Professional Showcase Header */}
      <header className="bg-white border-b border-[#E4E4E4] text-[#1E1F21] px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FCE8E6] flex items-center justify-center text-[#F06A6A] shadow-sm border border-[#F06A6A]/10">
              <Landmark className="w-5 h-5 text-[#F06A6A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-[#1E1F21] uppercase">RantaiRenteng</h1>
                <span className="bg-[#FCE8E6] text-[9px] text-[#F06A6A] border border-[#F06A6A]/20 px-2 py-0.5 rounded-full font-bold">PROTOTIPE INTERAKTIF</span>
              </div>
              <p className="text-[#6D6E6F] text-xs font-medium">Koperasi Digital Tanggung Renteng & Asisten Skrining EWS AI</p>
            </div>
          </div>

          {/* Core Role Switcher */}
          <div className="flex items-center bg-[#F6F5F3] p-1 rounded-xl border border-[#E4E4E4] shadow-inner">
            <button
              onClick={() => {
                setRole('anggota');
                addLog('Sistem', 'Ganti Peran', 'Pindah ke antarmuka Aplikasi Anggota (Simulasi HP)');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition-all duration-150 active:scale-95 ${
                role === 'anggota'
                  ? 'bg-[#F06A6A] text-white shadow shadow-red-950/10'
                  : 'text-[#6D6E6F] hover:text-[#1E1F21]'
              }`}
            >
              <Smartphone className="w-4 h-4" /> Peran: Anggota (HP)
            </button>
            <button
              onClick={() => {
                setRole('pengurus');
                addLog('Sistem', 'Ganti Peran', 'Pindah ke antarmuka Panel Pengurus (Admin)');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold transition-all duration-150 active:scale-95 ${
                role === 'pengurus'
                  ? 'bg-[#1E1F21] text-white shadow shadow-black/10'
                  : 'text-[#6D6E6F] hover:text-[#1E1F21]'
              }`}
            >
              <Users className="w-4 h-4" /> Peran: Pengurus (Admin)
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 4 Cols: DEMO CONTROL CENTER & CONTEXT */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Dashboard Scenario Simulator Card */}
          <div className="bg-white text-[#1E1F21] p-6 rounded-3xl border border-[#E4E4E4] shadow-[0_2px_12px_rgba(30,31,33,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#F06A6A] uppercase tracking-wider flex items-center gap-1.5">
                <Play className="w-4 h-4 text-[#F06A6A] shrink-0" /> Simulasi Skenario Alur
              </h3>
              <button
                onClick={resetAllState}
                className="text-[10px] bg-[#F6F5F3] hover:bg-[#EDECE9] border border-[#E4E4E4] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 text-[#6D6E6F] transition-all active:scale-95 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
            
            <p className="text-[#6D6E6F] text-xs font-medium">
              Uji coba sistem penanganan risiko & denda tanggung renteng secara instan dengan memilih salah satu skenario di bawah ini:
            </p>

            <div className="space-y-2">
              <button
                onClick={triggerScenarioPositif}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'positif'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'positif' ? 'bg-[#37A66B] text-white' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>1</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">1. Skenario Positif (Lancar)</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Bu Sri bayar tepat waktu, skor naik, escrow lancar.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioUzur}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'uzur'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'uzur' ? 'bg-[#F1BD6C] text-[#1E1F21]' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>2</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">2. Skenario Uzur (Sakit)</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Pak Deni sakit, izin uzur, pengurus rilis dana sosial.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioNoNews}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'no_news'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'no_news' ? 'bg-[#E8384F] text-white' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>3</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">3. Telat Tanpa Kabar (Tanggung Renteng)</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Masa tenggang habis, kelompok menalangi, skor pelanggar anjlok.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioMangkir}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'mangkir'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'mangkir' ? 'bg-[#9D7AD9] text-white' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>4</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">4. Kasus Mangkir Berulang (Sanksi)</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Escrow menahan dana, musyawarah restrukturisasi kelompok.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioKyc}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'kyc'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'kyc' ? 'bg-[#4573D2] text-white' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>5</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">5. Skenario Registrasi & e-KYC</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Mendaftarkan Pak Budi (Requested), butuh persetujuan Admin.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioGrupBaru}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'grup_baru'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'grup_baru' ? 'bg-[#62D26F] text-white animate-pulse' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>6</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">6. Bentuk Grup Baru (Fatimah)</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Anggota baru aktif tanpa grup, buat kelompok dari nol.</span>
                </div>
              </button>

              <button
                onClick={triggerScenarioUndangan}
                className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 active:scale-[0.98] ${
                  activeScenario === 'undangan'
                    ? 'bg-[#FCE8E6] border-[#F06A6A] text-[#1E1F21] shadow-sm'
                    : 'bg-white border-[#E4E4E4] hover:bg-[#F6F5F3] text-[#6D6E6F]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                  activeScenario === 'undangan' ? 'bg-[#F06A6A] text-white' : 'bg-[#EDECE9] text-[#6D6E6F]'
                }`}>7</span>
                <div>
                  <span className="font-bold block text-[#1E1F21]">7. Undangan & Gabung Kelompok</span>
                  <span className="text-[10px] text-[#6D6E6F] block font-medium mt-0.5">Gabung kelompok "Mawar Melati" dengan kode undangan "MAWAR9".</span>
                </div>
              </button>
            </div>

            {/* Live Explanation Banner */}
            {activeScenario && (
              <div className="bg-[#FAF9F8] border border-[#E4E4E4] p-4 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-[#F06A6A] uppercase tracking-widest text-[9px] flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Kejadian di Sistem:
                </span>
                <p className="text-[#1E1F21] leading-relaxed font-sans text-xs bg-white p-3 rounded-xl border border-[#E4E4E4] shadow-sm">
                  {scenarioExplanation}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#37A66B] font-bold">
                  <Check className="w-3.5 h-3.5" /> State di memori terupdate otomatis.
                </div>
              </div>
            )}
          </div>

          {/* Educational Product Guide Block */}
          <div className="bg-white text-[#1E1F21] p-6 rounded-3xl border border-[#E4E4E4] shadow-[0_2px_12px_rgba(30,31,33,0.03)] space-y-3">
            <h4 className="text-xs font-bold text-[#6D6E6F] uppercase tracking-widest flex items-center gap-1">
              <Shield className="w-4 h-4 text-[#F06A6A] shrink-0" /> Nilai Inti RantaiRenteng
            </h4>
            <div className="space-y-3 text-xs text-[#6D6E6F] leading-relaxed">
              <div className="border-l-2 border-[#F06A6A] pl-3">
                <strong className="text-[#1E1F21] block font-semibold">Agunan Sosial (Rasa Sungkan)</strong>
                Sistem tanggung renteng Grameen memindahkan tanggung jawab jaminan dari fisik ke sosial.
              </div>
              <div className="border-l-2 border-[#F06A6A] pl-3">
                <strong className="text-[#1E1F21] block font-semibold">Transparansi Ledger</strong>
                Semua setoran wajib dan cicilan tercatat otomatis sehingga pengurus tidak bisa memanipulasi keuangan sepihak.
              </div>
              <div className="border-l-2 border-[#F06A6A] pl-3">
                <strong className="text-[#1E1F21] block font-semibold">AI Beretika & Human-In-The-Loop</strong>
                AI hanyalah alat bantu penyaji peringatan, penentu mufakat akhir tetaplah rembug kelompok dan pengurus.
              </div>
            </div>
          </div>

        </div>

        {/* Right 8 Cols: App Render View based on active role */}
        <div className="lg:col-span-8">
          
          {role === 'anggota' ? (
            <div className="space-y-2">
              <div className="text-center text-[#6D6E6F] text-xs mb-1 font-semibold flex items-center justify-center gap-1.5">
                <span>Simulasi Layar Smartphone Anggota</span>
              </div>
              <AnggotaView
                members={members}
                groups={groups}
                loans={loans}
                savings={savings}
                setMembers={setMembers}
                setGroups={setGroups}
                setLoans={setLoans}
                setSavings={setSavings}
                addLog={addLog}
                activeMemberId={activeMemberId}
                setActiveMemberId={setActiveMemberId}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-center text-[#6D6E6F] text-xs mb-1 font-semibold flex items-center justify-center gap-1.5">
                <span>Panel Pengurus / Administrator Dashboard</span>
              </div>
              <PengurusView
                members={members}
                groups={groups}
                loans={loans}
                savings={savings}
                logs={logs}
                setMembers={setMembers}
                setGroups={setGroups}
                setLoans={setLoans}
                setSavings={setSavings}
                addLog={addLog}
              />
            </div>
          )}

        </div>

      </main>

      {/* Footer copyright */}
      <footer className="bg-[#FAF9F8] border-t border-[#E4E4E4] text-[#9CA1A8] text-center py-6 text-[11px] shrink-0 font-medium">
        <p>&copy; 2026 RantaiRenteng. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="opacity-75 mt-1">Dibuat khusus untuk pengujian alur bisnis koperasi modern di Google AI Studio.</p>
      </footer>

    </div>
  );
}

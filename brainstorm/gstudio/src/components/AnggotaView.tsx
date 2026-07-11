import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Member, Group, Loan, SavingTransaction, AuditLog } from "../types";
import {
  Home,
  PiggyBank,
  Users,
  CreditCard,
  User,
  CheckCircle2,
  ShieldAlert,
  Award,
  FileText,
  Upload,
  AlertCircle,
  Sparkles,
  Send,
  Eye,
  ChevronRight,
} from "lucide-react";

interface AnggotaViewProps {
  members: Member[];
  groups: Group[];
  loans: Loan[];
  savings: SavingTransaction[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  setSavings: React.Dispatch<React.SetStateAction<SavingTransaction[]>>;
  addLog: (aktor: string, aksi: string, detail: string) => void;
  activeMemberId: string;
  setActiveMemberId: (id: string) => void;
}

export default function AnggotaView({
  members,
  groups,
  loans,
  savings,
  setMembers,
  setGroups,
  setLoans,
  setSavings,
  addLog,
  activeMemberId,
  setActiveMemberId,
}: AnggotaViewProps) {
  const [activeTab, setActiveTab] = useState<
    "beranda" | "simpan" | "grup" | "pinjaman" | "profil"
  >("beranda");

  // Active Member context
  const currentMember =
    members.find((m) => m.id === activeMemberId) || members[0];
  const currentGroup = groups.find((g) =>
    g.anggotaIds.includes(currentMember.id),
  );
  const currentLoan = loans.find(
    (l) => l.memberId === currentMember.id && l.status !== "Lunas",
  );

  // Local states
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisConfig, setQrisConfig] = useState<{
    title: string;
    amount: number;
    onConfirm: () => void;
  } | null>(null);

  // KYC States
  const [kycStep, setKycStep] = useState(1);
  const [kycForm, setKycForm] = useState({
    nama: "",
    nik: "",
    noHp: "",
    otp: "",
    alamat: "",
    pekerjaan: "",
    peran: "peminjam" as "penabung" | "peminjam" | "keduanya",
    ktpFile: null as string | null,
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // Savings Form States
  const [saveType, setSaveType] = useState<"Wajib" | "Sukarela">("Wajib");
  const [saveAmount, setSaveAmount] = useState("50000");

  // Loan Application Form States
  const [loanAmount, setLoanAmount] = useState("3000000");
  const [loanPurpose, setLoanPurpose] = useState(
    "Membeli stok dagangan sembako",
  );
  const [loanTenor, setLoanTenor] = useState("6");
  const [sanggahText, setSanggahText] = useState("");
  const [showSanggahArea, setShowSanggahArea] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");

  // Format IDR helper
  const formatIdr = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // OTP Simulator
  const handleSendOtp = () => {
    if (!kycForm.noHp) {
      alert("Masukkan nomor HP terlebih dahulu.");
      return;
    }
    setOtpSent(true);
    alert(
      "Simulasi SMS OTP dikirim ke " +
        kycForm.noHp +
        '. Gunakan kode OTP palsu: "1234"',
    );
  };

  const handleVerifyOtp = () => {
    if (kycForm.otp === "1234") {
      setOtpVerified(true);
      alert("OTP Berhasil diverifikasi!");
    } else {
      alert('Kode OTP salah! Gunakan kode "1234".');
    }
  };

  const handleKtpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setKycForm({
        ...kycForm,
        ktpFile: "KTP_" + kycForm.nama.replace(/\s+/g, "_") + ".jpg",
      });
    }
  };

  // Submit KYC
  const handleSubmitKyc = (e: React.FormEvent) => {
    e.preventDefault();
    // Create new temporary member or overwrite active placeholder
    const newMemberId = "m_" + Date.now();
    const newMember: Member = {
      id: newMemberId,
      nama: kycForm.nama || "Anggota Baru",
      nik: kycForm.nik || "3273010000000001",
      noHp: kycForm.noHp || "081200000000",
      alamat: kycForm.alamat || "Desa Sukamaju",
      pekerjaan: kycForm.pekerjaan || "Pedagang",
      peran: kycForm.peran,
      statusKyc: "Requested",
      skorKeanggotaan: 70, // default starting score
      simpananPokok: 0,
      simpananWajib: 0,
      simpananSukarela: 0,
      isDorman: false,
      isUzur: false,
      jumlahIzinUzur: 0,
    };

    setMembers([...members, newMember]);
    setActiveMemberId(newMemberId);
    addLog(
      kycForm.nama,
      "Daftar & e-KYC",
      `Mengajukan pendaftaran anggota baru NIK ${kycForm.nik}.`,
    );
    alert(
      "Pendaftaran Berhasil dikirim! Status akun Anda sekarang: Requested. Pengurus harus menyetujui di Panel Pengurus agar akun Anda aktif.",
    );
    setKycStep(1); // reset step
    setActiveTab("beranda");
  };

  // Pay Savings or Loan Installment via QRIS
  const triggerQris = (
    title: string,
    amount: number,
    onConfirm: () => void,
  ) => {
    setQrisConfig({ title, amount, onConfirm });
    setShowQrisModal(true);
  };

  const handleQrisPaymentConfirm = () => {
    if (qrisConfig) {
      qrisConfig.onConfirm();
      setShowQrisModal(false);
      setQrisConfig(null);
    }
  };

  // Deposit savings logic
  const handleDepositSavings = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(saveAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Nominal tabungan tidak valid.");
      return;
    }

    triggerQris(`Simpanan ${saveType}`, amount, () => {
      // update state
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === currentMember.id) {
            const updated = { ...m };
            if (saveType === "Wajib") {
              updated.simpananWajib += amount;
            } else {
              updated.simpananSukarela += amount;
            }
            updated.skorKeanggotaan = Math.min(
              100,
              updated.skorKeanggotaan + 2,
            ); // bonus score for savings
            return updated;
          }
          return m;
        }),
      );

      // add saving transaction
      const newTx: SavingTransaction = {
        id: "tx_" + Date.now(),
        memberId: currentMember.id,
        jenis: saveType,
        nominal: amount,
        tanggal: new Date().toISOString().split("T")[0],
        metode: "QRIS",
        status: "PAID",
      };
      setSavings((prev) => [...prev, newTx]);
      addLog(
        currentMember.nama,
        "Tabungan QRIS",
        `Berhasil menabung Simpanan ${saveType} senilai ${formatIdr(amount)}.`,
      );
      alert(
        `Alhamdulillah, Simpanan ${saveType} sebesar ${formatIdr(amount)} telah sukses disetor dan dicatat otomatis ke Immutable Ledger.`,
      );
    });
  };

  // Apply Loan logic
  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = Number(loanAmount);
    const tenor = Number(loanTenor);

    if (isNaN(nominal) || nominal <= 0) {
      alert("Nominal pinjaman tidak valid.");
      return;
    }

    if (!currentGroup) {
      alert(
        'Anda belum memiliki kelompok tanggung renteng! Silakan gabung atau buat grup terlebih dahulu di menu "Grup".',
      );
      return;
    }

    // AI scoring algorithm simulation inside client
    // Let's compute a mock AI Score for the application based on current stats
    let score = 75; // baseline
    const flagReasons: string[] = [];

    if (currentMember.skorKeanggotaan > 85) {
      score += 15;
      flagReasons.push("Anggota memiliki rekam jejak keanggotaan prima.");
    } else if (currentMember.skorKeanggotaan < 60) {
      score -= 20;
      flagReasons.push("Skor keanggotaan historis tergolong rendah.");
    }

    // Plafon check
    if (nominal > currentGroup.plafonMaks) {
      score -= 25;
      flagReasons.push(
        `Pengajuan (${formatIdr(nominal)}) melebihi batas plafon kelompok (${formatIdr(currentGroup.plafonMaks)}).`,
      );
    }

    // Custom check for simulated case 'Pak X'
    if (currentMember.nama.includes("Pak X") || currentMember.id === "m3") {
      score = 48;
      flagReasons.push(
        "Terdeteksi tunggakan tersembunyi di Koperasi Tetangga (terverifikasi lintas data).",
      );
    }

    let flagAi: "HIJAU" | "KUNING" | "MERAH" = "HIJAU";
    if (score < 50) flagAi = "MERAH";
    else if (score < 75) flagAi = "KUNING";

    const newLoan: Loan = {
      id: "l_" + Date.now(),
      memberId: currentMember.id,
      groupId: currentGroup.id,
      nominal: nominal,
      tujuan: loanPurpose,
      tenor: tenor,
      status: "Diajukan",
      statusCicilan: "UNPAID",
      sisaCicilan: tenor,
      cicilanBulanan: Math.round((nominal * 1.1) / tenor), // 10% interest mock
      jadwalCicilan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      skorAi: score,
      flagAi: flagAi,
      flagAlasan:
        flagReasons.length > 0
          ? flagReasons
          : ["Kapasitas mencukupi", "Grup aktif saling menjamin"],
      isSanggah: false,
    };

    setLoans((prev) => [...prev, newLoan]);
    addLog(
      currentMember.nama,
      "Pengajuan Pinjaman",
      `Mengajukan pinjaman ${formatIdr(nominal)} untuk ${loanPurpose}. AI Skor: ${score} (${flagAi}).`,
    );
    alert(
      `Pengajuan pinjaman sebesar ${formatIdr(nominal)} berhasil dikirim dan terikat ke Kelompok "${currentGroup.nama}". Hasil skrining awal AI: ${flagAi} (Skor ${score}).`,
    );
    setShowSanggahArea(false);
  };

  // Submit Sanggah
  const handleSanggahSubmit = (loanId: string) => {
    if (!sanggahText) {
      alert("Harap isi alasan sanggahan.");
      return;
    }
    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId) {
          return {
            ...l,
            isSanggah: true,
            sanggahAlasan: sanggahText,
          };
        }
        return l;
      }),
    );
    addLog(
      currentMember.nama,
      "Hak Sanggah",
      `Mengajukan sanggahan atas flag pinjaman: "${sanggahText}"`,
    );
    alert(
      "Sanggahan Anda berhasil direkam ke sistem! Pengurus akan meninjau alasan ini pada musyawarah verifikasi kelompok.",
    );
    setSanggahText("");
    setShowSanggahArea(false);
  };

  // Pay Loan Installment
  const handlePayInstallment = () => {
    if (!currentLoan) return;
    triggerQris(`Cicilan Bulanan`, currentLoan.cicilanBulanan, () => {
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id === currentLoan.id) {
            const sisa = l.sisaCicilan - 1;
            return {
              ...l,
              sisaCicilan: sisa,
              status: sisa <= 0 ? "Lunas" : l.status,
              statusCicilan: "PAID" as const,
              jadwalCicilan: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
            };
          }
          return l;
        }),
      );

      // Reward membership score
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === currentMember.id) {
            return {
              ...m,
              skorKeanggotaan: Math.min(100, m.skorKeanggotaan + 4),
              isUzur: false, // clear uzur status on payment
            };
          }
          return m;
        }),
      );

      addLog(
        currentMember.nama,
        "Bayar Cicilan",
        `Membayar cicilan bulanan ${formatIdr(currentLoan.cicilanBulanan)} via QRIS.`,
      );
      alert(
        `Alhamdulillah, pembayaran cicilan sebesar ${formatIdr(currentLoan.cicilanBulanan)} sukses! Skor keanggotaan Anda naik.`,
      );
    });
  };

  // Create Group or Join
  const [newGroupForm, setNewGroupForm] = useState({
    nama: "",
    plafon: "5000000",
    jadwal: "Setiap tanggal 5",
  });
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupForm.nama) {
      alert("Harap isi nama kelompok.");
      return;
    }
    const newGroupId = "g_" + Date.now();
    const generatedCode = (
      newGroupForm.nama
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 5)
        .toUpperCase() + Math.floor(10 + Math.random() * 90)
    ).padEnd(6, "X");

    const newGroup: Group = {
      id: newGroupId,
      nama: newGroupForm.nama + " (Tanggung Renteng)",
      ketuaId: currentMember.id,
      anggotaIds: [currentMember.id],
      plafonMaks: Number(newGroupForm.plafon),
      jadwalPertemuan: newGroupForm.jadwal,
      kehadiranRate: 100,
      kasSosial: 0,
      reputasiKomunitas: "baik",
      kodeUndangan: generatedCode,
    };
    setGroups((prev) => [...prev, newGroup]);
    addLog(
      currentMember.nama,
      "Bentuk Grup",
      `Membentuk kelompok tanggung renteng baru: "${newGroupForm.nama}" dengan kode undangan "${generatedCode}".`,
    );
    alert(
      `Kelompok "${newGroupForm.nama}" berhasil dibuat dengan Kode Undangan: ${generatedCode}! Anggota lain sekarang dapat bergabung dengan grup Anda menggunakan kode tersebut.`,
    );
    setNewGroupForm({
      nama: "",
      plafon: "5000000",
      jadwal: "Setiap tanggal 5",
    });
  };

  // Join existing group
  const handleJoinGroup = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          if (g.anggotaIds.includes(currentMember.id)) return g;
          return {
            ...g,
            anggotaIds: [...g.anggotaIds, currentMember.id],
          };
        }
        return g;
      }),
    );
    const joinedG = groups.find((g) => g.id === groupId);
    addLog(
      currentMember.nama,
      "Gabung Grup",
      `Bergabung dengan kelompok tanggung renteng "${joinedG?.nama || groupId}".`,
    );
    alert("Anda berhasil bergabung ke kelompok tanggung renteng!");
  };

  // Join group by invitation code
  const handleJoinByInviteCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) {
      alert("Harap masukkan kode undangan.");
      return;
    }
    const code = inviteCodeInput.trim().toUpperCase();
    const targetGroup = groups.find(
      (g) => g.kodeUndangan && g.kodeUndangan.toUpperCase() === code,
    );
    if (!targetGroup) {
      alert("Kode undangan tidak valid atau kelompok tidak ditemukan.");
      return;
    }
    if (targetGroup.anggotaIds.includes(currentMember.id)) {
      alert("Anda sudah tergabung dalam kelompok ini!");
      return;
    }

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === targetGroup.id) {
          return {
            ...g,
            anggotaIds: [...g.anggotaIds, currentMember.id],
          };
        }
        return g;
      }),
    );

    addLog(
      currentMember.nama,
      "Gabung via Undangan",
      `Bergabung ke kelompok "${targetGroup.nama}" menggunakan kode undangan "${code}".`,
    );
    alert(
      `Selamat! Anda berhasil bergabung dengan Kelompok Tanggung Renteng "${targetGroup.nama}".`,
    );
    setInviteCodeInput("");
  };

  return (
    <div className="w-full max-w-[390px] mx-auto bg-[#1E1F21] rounded-[55px] p-3 shadow-[0_24px_50px_rgba(30,31,33,0.12)] border-[10px] border-[#1E1F21] relative flex flex-col justify-between overflow-hidden h-[844px] text-[#1E1F21] font-sans">
      {/* iPhone Dynamic Island / Notch Bezel */}
      <div className="absolute top-4.5 left-1/2 -translate-x-1/2 w-28 h-6.5 bg-[#1E1F21] rounded-full z-40 flex items-center justify-center border border-white/5 shadow-inner">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-900 absolute right-4"></div>
      </div>

      {/* iOS-style Status Bar */}
      <div className="bg-gradient-to-r from-[#F06A6A] to-[#E5544F] text-white pt-5 pb-2.5 px-6 flex justify-between items-center text-[10px] font-semibold tracking-wider shrink-0 z-30 select-none">
        <span>09:41</span>
        <div className="flex items-center gap-1.5">
          {/* Signal bars */}
          <div className="flex items-end gap-[1.5px] h-2.5">
            <div className="w-[2px] h-[3px] bg-white rounded-sm"></div>
            <div className="w-[2px] h-[5px] bg-white rounded-sm"></div>
            <div className="w-[2px] h-[7px] bg-white rounded-sm"></div>
            <div className="w-[2px] h-[9px] bg-white rounded-sm"></div>
          </div>
          {/* Wifi */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 21l-12-12c4.14-4.14 10.86-4.14 15 0l-3 3c-2.48-2.48-6.52-2.48-9 0l9 9z" />
          </svg>
          {/* Battery */}
          <div className="w-5 h-2.5 border border-white/60 rounded-[3px] p-[1px] flex items-center">
            <div className="h-full w-4/5 bg-white rounded-[1.5px]"></div>
          </div>
        </div>
      </div>

      {/* Prominent Maroon Header Area */}
      <div className="bg-gradient-to-br from-[#F06A6A] via-[#E5544F] to-[#C83E3E] text-white pt-5 pb-6 px-5 shrink-0 z-20 shadow-sm relative overflow-hidden select-none">
        {/* Animated glowing fluid bubbles in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <motion.div
            animate={{
              x: [0, 50, -30, 0],
              y: [0, -30, 40, 0],
              scale: [1, 1.25, 0.85, 1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-12 -left-12 w-36 h-36 bg-amber-300 rounded-full blur-3xl opacity-30"
          />
          <motion.div
            animate={{
              x: [0, -40, 50, 0],
              y: [0, 40, -30, 0],
              scale: [1, 0.8, 1.3, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -bottom-16 -right-16 w-44 h-44 bg-rose-300 rounded-full blur-3xl opacity-40"
          />
          <motion.div
            animate={{
              opacity: [0.15, 0.35, 0.15],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-white rounded-full blur-[40px]"
          />
        </div>

        {/* Elegant top row with App Name + Simulation Selector inside it */}
        <div className="flex justify-between items-center mb-4 relative z-10">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-black text-[#F06A6A] text-[9px] shadow-sm">
              印
            </div>
            <span className="font-black text-[9px] tracking-wider text-white uppercase">
              Koperasi Desa Merah Putih
            </span>
          </div>

          {/* Simulated Account Switcher Dropdown styled beautifully */}
          <div className="flex items-center gap-1 bg-white/12 hover:bg-white/18 px-2.5 py-1.5 rounded-full border border-white/12 cursor-pointer transition-all relative">
            <span className="text-[10px] font-extrabold text-white">
              {currentMember.nama}
            </span>
            <select
              value={activeMemberId}
              onChange={(e) => {
                setActiveMemberId(e.target.value);
                addLog(
                  "Sistem",
                  "Pindah User HP",
                  `Pindah ke akun HP anggota: ${members.find((m) => m.id === e.target.value)?.nama}`,
                );
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              {members.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  className="text-slate-800 font-semibold"
                >
                  {m.nama}
                </option>
              ))}
            </select>
            <svg
              className="w-3 h-3 text-slate-200 fill-current"
              viewBox="0 0 20 20"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {/* Dynamic Title and Aset Summary */}
        <div className="relative z-10 mt-1">
          <span className="text-[9px] text-red-100 font-bold uppercase tracking-widest block">
            Ringkasan Keuangan
          </span>
          <h2 className="text-2xl font-black text-white mt-1 select-all">
            {formatIdr(
              currentMember.simpananPokok +
                currentMember.simpananWajib +
                currentMember.simpananSukarela,
            )}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-white/15 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-white/5">
              Kinerja +4.8%
            </span>
            <span className="text-[10px] text-red-50 font-medium">
              Aset Kelompok:{" "}
              <strong className="text-white">Rp15.250.000</strong>
            </span>
          </div>
        </div>
      </div>

      {/* BANNER ETIKA AI */}
      <div className="bg-[#FAF9F8] border-b border-[#E4E4E4] py-2 px-3 text-[9px] text-[#6D6E6F] font-medium flex items-center gap-1.5 shrink-0 z-20">
        <AlertCircle className="w-3.5 h-3.5 text-[#F06A6A] shrink-0" />
        <span className="leading-tight">
          Keputusan akhir tetap mufakat musyawarah grup & pengurus. AI adalah
          asisten EWS.
        </span>
      </div>

      {/* Main Panel Frame */}
      <div className="flex-1 overflow-y-auto bg-[#FAF9F8] p-4">
        {/* If KYC is requested / pending, show a special badge, but let them browse */}
        {currentMember.statusKyc === "Requested" && (
          <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#C55A11] shrink-0 mt-0.5" />
            <div>
              <strong>Akun e-KYC Sedang Ditinjau!</strong> Pendaftaran Anda
              telah dikirim. Harap tunggu persetujuan dari Pengurus Koperasi di
              panel pengurus untuk mengaktifkan seluruh fitur pembiayaan.
            </div>
          </div>
        )}

        {currentMember.statusKyc === "Rejected" && (
          <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-xs text-red-900 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#C0392B] shrink-0 mt-0.5" />
            <div>
              <strong>KYC Ditolak!</strong> Pengajuan verifikasi KTP Anda
              ditolak oleh pengurus. Silakan hubungi kantor koperasi terdekat
              atau perbarui e-KYC.
            </div>
          </div>
        )}

        {/* 1. TAB BERANDA */}
        {activeTab === "beranda" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Header Greeting */}
            <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#FCE8E6] border border-[#F06A6A]/10 flex items-center justify-center text-[#F06A6A] font-black text-sm shadow-inner">
                  {currentMember.nama
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] text-[#F06A6A] font-extrabold block uppercase tracking-wider">
                    Anggota Koperasi
                  </span>
                  <h3 className="text-xs font-black text-[#1E1F21] leading-tight">
                    {currentMember.nama}
                  </h3>
                  <p className="text-[9px] text-[#6D6E6F] font-semibold">
                    {currentMember.pekerjaan} · {currentMember.alamat}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-[#F06A6A] bg-[#FCE8E6] border border-[#F06A6A]/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Skor: {currentMember.skorKeanggotaan}
                </span>
              </div>
            </div>

            {/* Aksi Cepat Row */}
            <div>
              <div className="flex justify-around items-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                <button
                  onClick={() => setActiveTab("simpan")}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#F06A6A] hover:bg-[#E5544F] text-white flex items-center justify-center shadow-md shadow-red-950/10 transition-all group-active:scale-95">
                    <PiggyBank className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#1E1F21] tracking-tight">
                    Setor Simpanan
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("pinjaman")}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#F06A6A] hover:bg-[#E5544F] text-white flex items-center justify-center shadow-md shadow-red-950/10 transition-all group-active:scale-95">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#1E1F21] tracking-tight">
                    Bayar Cicilan
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("grup")}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#F06A6A] hover:bg-[#E5544F] text-white flex items-center justify-center shadow-md shadow-red-950/10 transition-all group-active:scale-95">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-extrabold text-[#1E1F21] tracking-tight">
                    Kelompok Kami
                  </span>
                </button>
              </div>
            </div>

            {/* Visual Sorotan */}
            <div className="bg-gradient-to-br from-white to-[#F6F5F3] p-4 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="mr-28 space-y-1.5 relative z-10">
                <span className="text-[8px] bg-[#FCE8E6] text-[#F06A6A] font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                  Agunan Sosial
                </span>
                <h4 className="text-xs font-black text-[#1E1F21] leading-snug">
                  Kepercayaan adalah Modal Utama
                </h4>
                <p className="text-[10px] text-[#6D6E6F] leading-relaxed font-semibold">
                  RantaiRenteng mendigitalkan gotong-royong. Tanpa jaminan
                  fisik, digantikan dengan mufakat tanggung renteng kelompok.
                </p>
                <button
                  onClick={() => setActiveTab("grup")}
                  className="text-[9px] font-black text-[#F06A6A] hover:underline flex items-center gap-0.5 pt-1"
                >
                  Pelajari selengkapnya <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Minimalist stylized geometric perspective graphic (pure Tailwind CSS) */}
              <div className="absolute right-3.5 bottom-3.5 w-20 h-20 pointer-events-none flex items-center justify-center">
                <div className="relative w-14 h-14 transform rotate-12">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#F06A6A] to-[#E5544F] rounded-lg shadow-md transform -skew-x-12 skew-y-6 flex items-center justify-center border border-white/20">
                    <span className="text-white/90 font-mono text-[9px] font-black">
                      RP
                    </span>
                  </div>
                  <div className="absolute -top-2.5 -left-2.5 w-8 h-8 bg-[#F1BD6C] rounded shadow-md transform skew-x-6 -skew-y-12 border border-white/20 flex items-center justify-center text-[#1E1F21] text-[9px] font-bold">
                    ★
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#1E1F21] rounded border border-white/10 opacity-90 transform -rotate-12 flex items-center justify-center text-[7px] text-[#62D26F] font-mono">
                    100
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Data (Scorecard/List) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Investasi Anggota & Sasaran Kelompok
                </h4>
                <span className="text-[9px] text-slate-400 font-bold font-mono uppercase">
                  Skor
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Score 1 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                    <span>Sasaran Simpanan Pokok</span>
                    <span className="text-[#5C0A1A] font-mono">100%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5C0A1A] rounded-full"
                      style={{ width: "100%" }}
                    ></div>
                  </div>
                </div>

                {/* Score 2 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                    <span>Sasaran Simpanan Wajib</span>
                    <span className="text-[#5C0A1A] font-mono">82%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5C0A1A] rounded-full"
                      style={{ width: "82%" }}
                    ></div>
                  </div>
                </div>

                {/* Score 3 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                    <span>Skor Rembug / Kehadiran</span>
                    <span className="text-[#5C0A1A] font-mono">92%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5C0A1A] rounded-full"
                      style={{ width: "92%" }}
                    ></div>
                  </div>
                </div>

                {/* Score 4 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                    <span>Skor Reputasi Pinjaman</span>
                    <span className="text-[#5C0A1A] font-mono">76%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5C0A1A] rounded-full"
                      style={{ width: "76%" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Loan & Escrow Card */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider">
                Pinjaman Berjalan
              </h4>
              {currentLoan ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] bg-[#5C0A1A]/10 text-[#5C0A1A] border border-[#5C0A1A]/20 px-2 py-0.5 rounded-full font-black uppercase inline-block">
                        {currentLoan.status} (Escrow Aktif)
                      </span>
                      <h5 className="text-xs font-black text-slate-800 mt-1">
                        {currentLoan.tujuan}
                      </h5>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-[#5C0A1A] block">
                        {formatIdr(currentLoan.nominal)}
                      </span>
                      <span className="text-[8px] text-slate-400 block font-bold">
                        {currentLoan.tenor} Bulan Tenor
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[11px] font-medium text-slate-600">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">
                        Angsuran / Bulan
                      </span>
                      <strong className="text-slate-800 font-bold">
                        {formatIdr(currentLoan.cicilanBulanan)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-bold">
                        Sisa Tenor
                      </span>
                      <strong className="text-slate-800 font-bold">
                        {currentLoan.sisaCicilan} bln lagi
                      </strong>
                    </div>
                  </div>

                  {currentLoan.statusCicilan === "UNPAID" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex justify-between items-center mt-2">
                      <div className="flex items-center gap-1.5 text-amber-800 text-[10px]">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-semibold">
                          Jatuh tempo {currentLoan.jadwalCicilan}
                        </span>
                      </div>
                      <button
                        onClick={handlePayInstallment}
                        className="bg-[#5C0A1A] hover:bg-[#400511] text-white font-black text-[9px] uppercase px-2.5 py-1.5 rounded shadow-sm transition-colors"
                      >
                        Bayar QRIS
                      </button>
                    </div>
                  )}

                  {currentLoan.statusCicilan === "PAID" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Periode bulan ini telah LUNAS (PAID)</span>
                    </div>
                  )}

                  {currentLoan.statusCicilan === "DITALANGI" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-[10px] text-red-900 space-y-1.5">
                      <p className="font-black flex items-center gap-1 text-red-700 uppercase tracking-wide">
                        <AlertCircle className="w-3.5 h-3.5" /> Tanggung Renteng
                        Aktif (Grup Menalangi)
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        Cicilan Anda ditalangi kas kelompok. Harap segera bayar
                        ganti talangan kelompok untuk mengembalikan skor Anda.
                      </p>
                      <button
                        onClick={handlePayInstallment}
                        className="w-full bg-[#C0392B] hover:bg-red-800 text-white font-black py-1.5 rounded text-[9px] uppercase tracking-wider shadow"
                      >
                        Ganti Talangan Kelompok via QRIS
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-dashed border-slate-300 text-center py-5 text-slate-400 text-xs">
                  Tidak ada pinjaman berjalan aktif.
                  <button
                    onClick={() => setActiveTab("pinjaman")}
                    className="block mx-auto mt-2 text-[#5C0A1A] font-black bg-[#5C0A1A]/5 hover:bg-[#5C0A1A]/10 px-3 py-1 rounded-full border border-[#5C0A1A]/10 text-[10px] uppercase tracking-wider"
                  >
                    Ajukan Pembiayaan Baru &gt;
                  </button>
                </div>
              )}
            </div>

            {/* Quick Member Status Info (Group) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm text-xs space-y-2">
              <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                Afiliasi Tanggung Renteng
              </span>
              {currentGroup ? (
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-slate-800">
                      {currentGroup.nama}
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Pertemuan: {currentGroup.jadwalPertemuan}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("grup")}
                    className="text-[10px] font-extrabold text-[#5C0A1A] bg-[#5C0A1A]/5 hover:bg-[#5C0A1A]/10 border border-[#5C0A1A]/10 px-2.5 py-1.5 rounded transition-all"
                  >
                    Lihat Grup
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center text-slate-500">
                  <span className="font-medium text-slate-500 text-[11px]">
                    Anda belum bergabung kelompok!
                  </span>
                  <button
                    onClick={() => setActiveTab("grup")}
                    className="text-[10px] font-black text-white bg-[#5C0A1A] hover:bg-[#400511] px-3 py-1.5 rounded uppercase tracking-wider transition-all"
                  >
                    Join Grup
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 2. TAB SIMPAN */}
        {activeTab === "simpan" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="text-center">
              <PiggyBank className="w-10 h-10 text-[#2F6B6B] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Sektor Tabungan Koperasi
              </h3>
              <p className="text-xs text-slate-500">
                Simpanan Anda aman terproteksi di ledger transparan kelompok
              </p>
            </div>

            {/* Savings Balance summary */}
            <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold text-[9px] block">
                  TOTAL SIMPANAN
                </span>
                <strong className="text-[#1F3864] text-sm">
                  {formatIdr(
                    currentMember.simpananPokok +
                      currentMember.simpananWajib +
                      currentMember.simpananSukarela,
                  )}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-bold text-[9px] block">
                  SKOR BONUS SIMPANAN
                </span>
                <span className="text-[#548235] font-extrabold">
                  +2 Poin Keaktifan
                </span>
              </div>
            </div>

            <form
              onSubmit={handleDepositSavings}
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
                      setSaveType("Wajib");
                      setSaveAmount("50000");
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold border transition-all ${
                      saveType === "Wajib"
                        ? "border-[#1F3864] bg-[#1F3864]/5 text-[#1F3864]"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Wajib (Rp50.000 / bln)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveType("Sukarela");
                      setSaveAmount("100000");
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold border transition-all ${
                      saveType === "Sukarela"
                        ? "border-[#1F3864] bg-[#1F3864]/5 text-[#1F3864]"
                        : "border-slate-200 bg-white text-slate-600"
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
                  disabled={saveType === "Wajib"}
                  className="w-full text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 outline-none"
                />
                {saveType === "Wajib" && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Simpanan Wajib dipatok Rp50.000 sesuai AD/ART koperasi.
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#1F3864] text-white font-extrabold text-xs py-2.5 rounded-lg shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
              >
                Bayar Simpanan via QRIS
              </button>
            </form>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 text-xs text-teal-900 space-y-1">
              <h5 className="font-bold">Mengapa Simpanan Wajib Itu Penting?</h5>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Menabung simpanan wajib secara disiplin sebelum tanggal jatuh
                tempo meningkatkan <strong>Skor Kelayakan AI</strong> Anda dan
                memperluas kapasitas pinjaman kelompok.
              </p>
            </div>
          </motion.div>
        )}

        {/* 3. TAB GRUP */}
        {activeTab === "grup" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="text-center">
              <Users className="w-10 h-10 text-[#2F6B6B] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Kelompok Tanggung Renteng
              </h3>
              <p className="text-xs text-slate-500">
                Agunan Sosial & Saling-Menjamin Anggota
              </p>
            </div>

            {currentGroup ? (
              <div className="space-y-4">
                {/* Group KPI card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Identitas Grup
                    </span>
                    <span className="text-[10px] font-bold text-[#548235] bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase">
                      Reputasi: {currentGroup.reputasiKomunitas}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {currentGroup.nama}
                  </h4>

                  {/* Invitation Code Section */}
                  <div className="bg-indigo-50/75 border border-indigo-100 p-2.5 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[9px] text-indigo-400 block font-bold uppercase tracking-wider">
                        KODE UNDANGAN
                      </span>
                      <strong className="text-indigo-800 font-mono tracking-widest text-sm">
                        {currentGroup.kodeUndangan || "BELUM_ADA"}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          currentGroup.kodeUndangan || "",
                        );
                        alert(
                          `Kode undangan "${currentGroup.kodeUndangan}" berhasil disalin!`,
                        );
                      }}
                      className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-1.5 rounded-md transition-all shadow-sm"
                    >
                      Salin Kode
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        Plafon Maks
                      </span>
                      <strong className="text-[#1F3864]">
                        {formatIdr(currentGroup.plafonMaks)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        Kehadiran Pertemuan
                      </span>
                      <strong className="text-[#2F6B6B]">
                        {currentGroup.kehadiranRate}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Pakta Tanggung Renteng */}
                <div className="bg-[#1F3864]/5 border border-[#1F3864]/20 p-3.5 rounded-xl space-y-2 text-xs text-slate-800">
                  <h5 className="font-extrabold text-[#1F3864] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-[#548235]" /> Pakta
                    Saling Menjamin
                  </h5>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    "Kami berikrar untuk saling memotivasi usaha, saling
                    membantu cicilan, dan bersedia bertanggung renteng (patungan
                    menalangi) jika rekan kami tertimpa musibah/tunggakan."
                  </p>
                </div>

                {/* Group Members List */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Daftar Anggota Kelompok
                  </span>
                  {currentGroup.anggotaIds.map((mId) => {
                    const m = members.find((x) => x.id === mId);
                    if (!m) return null;
                    const mLoan = loans.find(
                      (l) => l.memberId === m.id && l.status !== "Lunas",
                    );

                    // Identify indicators
                    let statusColor = "bg-[#548235]"; // green
                    let statusText = "Lancar / Sehat";

                    if (m.isUzur) {
                      statusColor = "bg-amber-500";
                      statusText = "Uzur (Sakit/Izin)";
                    } else if (mLoan && mLoan.statusCicilan === "UNPAID") {
                      statusColor = "bg-[#C55A11]";
                      statusText = "Belum Cicil";
                    } else if (mLoan && mLoan.statusCicilan === "DITALANGI") {
                      statusColor = "bg-[#C0392B] animate-pulse";
                      statusText = "Tunggakan - Tanggung Renteng";
                    }

                    return (
                      <div
                        key={m.id}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${statusColor}`}
                          ></div>
                          <div>
                            <h6 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {m.nama}
                              {m.id === currentGroup.ketuaId && (
                                <span className="text-[8px] bg-[#1F3864] text-white px-1.5 rounded font-black uppercase">
                                  Ketua
                                </span>
                              )}
                            </h6>
                            <span className="text-[10px] text-slate-400">
                              {m.pekerjaan} · Skor {m.skorKeanggotaan}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {statusText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Gabung via Kode Undangan Card */}
                <div className="bg-[#1F3864]/5 p-4 rounded-xl border border-[#1F3864]/20 space-y-2.5">
                  <h4 className="text-xs font-bold text-[#1F3864] uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Gabung via
                    Kode Undangan
                  </h4>
                  <p className="text-[10px] text-slate-600">
                    Punya kode dari ketua kelompok? Masukkan di bawah untuk
                    bergabung secara langsung.
                  </p>
                  <form
                    onSubmit={handleJoinByInviteCode}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Contoh: MAWAR9"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 uppercase font-mono font-bold tracking-wider outline-none bg-white focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="bg-[#1F3864] hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-sm"
                    >
                      Gabung
                    </button>
                  </form>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">
                    Buat Kelompok Baru
                  </h4>
                  <form
                    onSubmit={handleCreateGroup}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Nama Kelompok
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Flamboyan, Melati"
                        value={newGroupForm.nama}
                        onChange={(e) =>
                          setNewGroupForm({
                            ...newGroupForm,
                            nama: e.target.value,
                          })
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-600 mb-1">
                          Plafon Maksimal (Rp)
                        </label>
                        <select
                          value={newGroupForm.plafon}
                          onChange={(e) =>
                            setNewGroupForm({
                              ...newGroupForm,
                              plafon: e.target.value,
                            })
                          }
                          className="w-full border border-slate-200 rounded p-1.5 bg-white"
                        >
                          <option value="5000000">Rp5.000.000</option>
                          <option value="10000000">Rp10.000.000</option>
                          <option value="15000000">Rp15.000.000</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">
                          Pertemuan Rutin
                        </label>
                        <input
                          type="text"
                          value={newGroupForm.jadwal}
                          onChange={(e) =>
                            setNewGroupForm({
                              ...newGroupForm,
                              jadwal: e.target.value,
                            })
                          }
                          className="w-full border border-slate-200 rounded px-2 py-1.5"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#2F6B6B] text-white font-bold py-2 rounded"
                    >
                      Daftar Kelompok Baru
                    </button>
                  </form>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Gabung Grup Terbuka Sekitar Anda
                  </span>
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs"
                    >
                      <div>
                        <h5 className="font-bold text-slate-800">{g.nama}</h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Pertemuan bulanan: {g.jadwalPertemuan}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoinGroup(g.id)}
                        className="bg-teal-50 border border-teal-200 text-[#2F6B6B] font-bold px-3 py-1 rounded"
                      >
                        Gabung
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* 4. TAB PINJAMAN */}
        {activeTab === "pinjaman" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="text-center">
              <CreditCard className="w-10 h-10 text-[#2F6B6B] mx-auto" />
              <h3 className="text-base font-bold text-slate-800 mt-2">
                Pengajuan Pembiayaan
              </h3>
              <p className="text-xs text-slate-500">
                Transparan, Terkait Kelompok Tanggung Renteng
              </p>
            </div>

            {/* If has active loan, show status and sanggah */}
            {currentLoan ? (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block">
                      STATUS PENGAJUAN
                    </span>
                    <h4 className="text-sm font-bold text-[#1F3864] mt-0.5">
                      {currentLoan.status}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-[#C55A11] bg-amber-50 px-2 py-0.5 rounded-full">
                      AI Skor: {currentLoan.skorAi}/100
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plafond</span>
                    <strong className="text-slate-800">
                      {formatIdr(currentLoan.nominal)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tenor</span>
                    <span className="text-slate-800">
                      {currentLoan.tenor} Bulan
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tujuan</span>
                    <span className="text-slate-800">{currentLoan.tujuan}</span>
                  </div>
                </div>

                {/* AI Early Warning Alert Frame */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    Hasil Skrining AI EWS
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        currentLoan.flagAi === "HIJAU"
                          ? "bg-[#548235]"
                          : currentLoan.flagAi === "KUNING"
                            ? "bg-[#C55A11]"
                            : "bg-[#C0392B]"
                      }`}
                    ></span>
                    <strong className="text-slate-800">
                      Rekomendasi: {currentLoan.flagAi}
                    </strong>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
                    {currentLoan.flagAlasan.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Sanggah Feature */}
                {currentLoan.status === "Diajukan" && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#C55A11] uppercase">
                        Ada kesalahan flag AI?
                      </span>
                      <button
                        onClick={() => setShowSanggahArea(!showSanggahArea)}
                        className="text-[10px] font-extrabold text-[#2F6B6B] underline"
                      >
                        {showSanggahArea ? "Batal" : "Ajukan Hak Sanggah"}
                      </button>
                    </div>

                    {showSanggahArea && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
                        <label className="block font-bold text-slate-700">
                          Tuliskan Sanggahan Anda
                        </label>
                        <textarea
                          rows={3}
                          value={sanggahText}
                          onChange={(e) => setSanggahText(e.target.value)}
                          placeholder="Contoh: Nama saya terkeliru dengan warga dusun sebelah, saya tidak punya kredit macet..."
                          className="w-full border border-slate-300 rounded p-1.5 bg-white text-xs outline-none"
                        ></textarea>
                        <button
                          onClick={() => handleSanggahSubmit(currentLoan.id)}
                          className="w-full bg-[#2F6B6B] text-white font-bold py-1.5 rounded"
                        >
                          Kirim Sanggahan Ke Pengurus
                        </button>
                      </div>
                    )}

                    {currentLoan.isSanggah && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-900">
                        <strong>Sanggahan Terdaftar:</strong> "
                        {currentLoan.sanggahAlasan}" — Status pengajuan
                        ditangguhkan untuk diverifikasi manual oleh pengurus.
                      </div>
                    )}
                  </div>
                )}
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
                  {currentGroup && (
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Batas Plafon Kelompok Anda:{" "}
                      <strong>{formatIdr(currentGroup.plafonMaks)}</strong>
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
                    placeholder="Contoh: modal beli pupuk padi"
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
                    <option value="6">6 Bulan (Bunga Ringan)</option>
                    <option value="10">10 Bulan (Angsuran Kecil)</option>
                    <option value="12">12 Bulan (Tenor Panjang)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1F3864] text-white font-extrabold text-xs py-2.5 rounded-lg shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                >
                  Ajukan Pembiayaan Baru
                </button>
              </form>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-[#C55A11] space-y-1">
              <h5 className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Transparansi
                Skrining Risiko
              </h5>
              <p className="text-slate-600 leading-relaxed">
                RantaiRenteng menyaring risiko dengan parameter transparan. Kami
                tidak mengorek riwayat ponsel pribadi Anda, melainkan melihat
                riwayat kelompok dan ketaatan tabungan Anda.
              </p>
            </div>
          </motion.div>
        )}

        {/* 5. TAB PROFIL & REGISTRASI e-KYC */}
        {activeTab === "profil" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                <User className="w-4 h-4 text-[#1F3864]" /> Akun & Registrasi
                e-KYC
              </h4>

              {kycStep === 1 ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <p className="text-slate-400">Status Akun</p>
                    <strong className="text-slate-800 text-sm flex items-center gap-1.5 mt-0.5">
                      {currentMember.statusKyc === "Approved" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#548235]" />{" "}
                          Aktif (e-KYC Terverifikasi)
                        </>
                      ) : currentMember.statusKyc === "Requested" ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-[#C55A11]" />{" "}
                          Requested (Menunggu Persetujuan)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-[#C0392B]" />{" "}
                          Belum Verifikasi
                        </>
                      )}
                    </strong>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Nama Lengkap</span>
                      <span className="font-bold text-slate-800">
                        {currentMember.nama}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">NIK (Nomor Induk)</span>
                      <span className="font-bold text-slate-800">
                        {currentMember.nik}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Pekerjaan</span>
                      <span className="font-bold text-slate-800">
                        {currentMember.pekerjaan}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Alamat</span>
                      <span className="font-bold text-slate-800">
                        {currentMember.alamat}
                      </span>
                    </div>
                  </div>

                  {currentMember.statusKyc !== "Approved" && (
                    <button
                      onClick={() => setKycStep(2)}
                      className="w-full bg-[#1F3864] text-white font-bold py-2 rounded text-xs"
                    >
                      Daftar / Edit e-KYC Mandiri
                    </button>
                  )}
                </div>
              ) : (
                /* Step by Step form */
                <form
                  onSubmit={handleSubmitKyc}
                  className="space-y-3.5 text-xs"
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-700">
                      Form e-KYC Digital (Step 2)
                    </span>
                    <button
                      type="button"
                      onClick={() => setKycStep(1)}
                      className="text-[#C0392B] font-bold"
                    >
                      Kembali
                    </button>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      Nama Lengkap Sesuai KTP
                    </label>
                    <input
                      type="text"
                      required
                      value={kycForm.nama}
                      onChange={(e) =>
                        setKycForm({ ...kycForm, nama: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Nomor Induk Kependudukan (NIK)
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        value={kycForm.nik}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, nik: e.target.value })
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">
                        No. Handphone
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          required
                          value={kycForm.noHp}
                          onChange={(e) =>
                            setKycForm({ ...kycForm, noHp: e.target.value })
                          }
                          className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="bg-teal-700 text-white px-2 py-1 rounded font-bold text-[9px]"
                        >
                          OTP
                        </button>
                      </div>
                    </div>
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded space-y-1.5">
                      <label className="block text-slate-600 font-bold">
                        Masukkan Kode OTP
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={kycForm.otp}
                          onChange={(e) =>
                            setKycForm({ ...kycForm, otp: e.target.value })
                          }
                          className="border border-slate-300 rounded p-1 w-20 text-center"
                          placeholder="1234"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          className="bg-teal-800 text-white px-3 py-1 rounded font-bold"
                        >
                          Verifikasi
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 mb-1">
                      Alamat Domisili / Desa
                    </label>
                    <input
                      type="text"
                      required
                      value={kycForm.alamat}
                      onChange={(e) =>
                        setKycForm({ ...kycForm, alamat: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Pekerjaan Utama
                      </label>
                      <input
                        type="text"
                        required
                        value={kycForm.pekerjaan}
                        onChange={(e) =>
                          setKycForm({ ...kycForm, pekerjaan: e.target.value })
                        }
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Peran Koperasi
                      </label>
                      <select
                        value={kycForm.peran}
                        onChange={(e: any) =>
                          setKycForm({ ...kycForm, peran: e.target.value })
                        }
                        className="w-full border border-slate-200 rounded p-1.5 bg-white"
                      >
                        <option value="peminjam">Peminjam Saja</option>
                        <option value="penabung">Penabung Saja</option>
                        <option value="keduanya">Keduanya</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50 relative">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                    <span className="text-[10px] text-slate-500 font-bold block mt-1">
                      {kycForm.ktpFile
                        ? kycForm.ktpFile
                        : "Unggah Foto KTP & Swafoto"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleKtpUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpSent && !otpVerified}
                    className={`w-full text-white font-extrabold py-2.5 rounded-xl text-xs transition-colors ${
                      otpSent && !otpVerified
                        ? "bg-slate-300 cursor-not-allowed"
                        : "bg-[#F06A6A] hover:bg-[#E5544F]"
                    }`}
                  >
                    Kirim Form e-KYC
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div className="bg-white text-slate-600 py-2 border-t border-slate-200 flex justify-around items-center shrink-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] select-none">
        <button
          onClick={() => setActiveTab("beranda")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all ${activeTab === "beranda" ? "text-[#F06A6A] font-extrabold scale-105" : "text-slate-400 hover:text-[#1E1F21]"}`}
        >
          <Home className="w-4.5 h-4.5" />
          <span className="text-[9px]">Beranda</span>
        </button>
        <button
          onClick={() => setActiveTab("simpan")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all ${activeTab === "simpan" ? "text-[#F06A6A] font-extrabold scale-105" : "text-slate-400 hover:text-[#1E1F21]"}`}
        >
          <PiggyBank className="w-4.5 h-4.5" />
          <span className="text-[9px]">Simpan</span>
        </button>
        <button
          onClick={() => setActiveTab("grup")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all ${activeTab === "grup" ? "text-[#F06A6A] font-extrabold scale-105" : "text-slate-400 hover:text-[#1E1F21]"}`}
        >
          <Users className="w-4.5 h-4.5" />
          <span className="text-[9px]">Grup</span>
        </button>
        <button
          onClick={() => setActiveTab("pinjaman")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all ${activeTab === "pinjaman" ? "text-[#F06A6A] font-extrabold scale-105" : "text-slate-400 hover:text-[#1E1F21]"}`}
        >
          <CreditCard className="w-4.5 h-4.5" />
          <span className="text-[9px]">Pinjaman</span>
        </button>
        <button
          onClick={() => setActiveTab("profil")}
          className={`flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all ${activeTab === "profil" ? "text-[#F06A6A] font-extrabold scale-105" : "text-slate-400 hover:text-[#1E1F21]"}`}
        >
          <User className="w-4.5 h-4.5" />
          <span className="text-[9px]">Profil</span>
        </button>
      </div>

      {/* Subtle Brand Detail Band & iPhone Home Indicator */}
      <div className="bg-[#1E1F21] text-slate-400 px-5 pt-3 pb-2 flex flex-col items-center gap-2.5 shrink-0 z-20 select-none border-t border-white/5">
        <div className="flex items-center justify-between w-full text-[8px] font-bold tracking-widest text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F06A6A] border border-white/40 flex items-center justify-center text-[5px] text-white font-serif">
              印
            </span>
            <span>KOPERASI DESA MERAH PUTIH</span>
          </div>
          <span>SISTEM TANGGUNG RENTENG MODERN</span>
        </div>

        {/* Physical Home Indicator bar */}
        <div className="w-24 h-1 bg-white/40 rounded-full mx-auto"></div>
      </div>

      {/* QRIS PAYMENTS MOCK MODAL */}
      {showQrisModal && qrisConfig && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 text-center shadow-2xl border border-slate-200/60 relative overflow-hidden">
            {/* Header branding on Modal */}
            <div className="bg-[#F06A6A] text-white p-3 -mx-5 -mt-5 mb-4 flex flex-col items-center gap-0.5 select-none">
              <span className="text-[8px] tracking-widest font-black uppercase text-amber-200">
                GERBANG QRIS DIGITAL
              </span>
              <h4 className="text-xs font-black tracking-wide uppercase">
                KOPERASI MERAH PUTIH
              </h4>
            </div>

            <p className="text-[11px] text-[#6D6E6F] font-bold uppercase tracking-wider">
              {qrisConfig.title}
            </p>
            <strong className="text-xl font-black text-[#1E1F21] block mt-1">
              {formatIdr(qrisConfig.amount)}
            </strong>

            {/* Generated Simulated QR Code */}
            <div className="w-32 h-32 border-4 border-[#1E1F21] mx-auto my-4 bg-white p-2.5 flex flex-col justify-between items-center relative rounded-xl shadow-inner">
              <div className="grid grid-cols-4 gap-1 w-full h-full opacity-90">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${i % 3 === 0 || i % 5 === 0 ? "bg-[#F06A6A]" : "bg-white"}`}
                  ></div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-black bg-white border border-slate-200 px-1.5 py-0.5 text-[#F06A6A] rounded uppercase tracking-wider shadow-sm">
                  QRIS MOCK
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-medium px-2 leading-relaxed">
              Scan barcode otomatis terhubung ke immutable ledger Koperasi Desa.
              Bebas biaya admin (gas Relayer).
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowQrisModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-2 rounded-xl text-[10px] uppercase tracking-wide transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleQrisPaymentConfirm}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-wide shadow transition-all"
              >
                Bayar QRIS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

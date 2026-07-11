import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  CreditCard,
  ShieldAlert,
  Check,
  X,
  ShieldCheck,
  Activity,
  FileLineChart,
  Wallet,
  ExternalLink,
  Loader2,
  RefreshCw,
  HeartHandshake,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatIdr, shortAddress, formatTimestamp } from "../lib/format";
import type { AuditLog, Group, Loan, Member, OnchainStatus } from "../types";
import RiskScreenerTool from "./RiskScreenerTool";

type Tab =
  | "dashboard"
  | "kyc"
  | "grup"
  | "pinjaman"
  | "penagihan"
  | "laporan"
  | "screener";
type Flash = { type: "success" | "error"; msg: string } | null;

const flagStyle: Record<Loan["flagAi"], string> = {
  MERAH: "bg-[#FCE8E6] border-[#F06A6A]/10 text-[#F06A6A]",
  KUNING: "bg-[#FDF6E2] border-[#F1BD6C]/10 text-[#C55A11]",
  HIJAU: "bg-[#EDF9F0] border-[#62D26F]/10 text-[#548235]",
};

export default function PengurusView() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [onchain, setOnchain] = useState<OnchainStatus | null>(null);

  const [flash, setFlash] = useState<Flash>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notify = useCallback((f: Flash) => {
    setFlash(f);
    if (f) window.setTimeout(() => setFlash(null), 6000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [m, g, l, a, o] = await Promise.allSettled([
      api.listMembers(),
      api.listGroups(),
      api.listLoans(),
      api.listAuditLogs(100),
      api.onchainStatus(),
    ]);
    if (m.status === "fulfilled") setMembers(m.value);
    if (g.status === "fulfilled") setGroups(g.value);
    if (l.status === "fulfilled") setLoans(l.value);
    if (a.status === "fulfilled") setLogs(a.value);
    if (o.status === "fulfilled") setOnchain(o.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.nama ?? id.slice(0, 8);
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.nama ?? id.slice(0, 8);

  // --- KPIs ---
  const totalSavings = members.reduce(
    (s, m) => s + m.simpananPokok + m.simpananWajib + m.simpananSukarela,
    0,
  );
  const outstanding = loans
    .filter((l) => l.status === "Cair")
    .reduce((s, l) => s + l.cicilanBulanan * l.sisaCicilan, 0);
  const cairLoans = loans.filter((l) => l.status === "Cair");
  const unpaid = cairLoans.filter(
    (l) => l.statusCicilan === "UNPAID" || l.statusCicilan === "DITALANGI",
  ).length;
  const nplRate = cairLoans.length
    ? Math.round((unpaid / cairLoans.length) * 100)
    : 0;
  const dormanCount = members.filter((m) => m.isDorman).length;

  const kycQueue = members.filter((m) => m.statusKyc === "Requested");
  const pendingLoans = loans.filter((l) => l.status === "Diajukan");
  const arrears = loans.filter(
    (l) => l.statusCicilan === "UNPAID" || l.statusCicilan === "DITALANGI",
  );

  // --- Flow ①: KYC approve/reject ---
  const handleKyc = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const updated =
        action === "approve"
          ? await api.approveKyc(id)
          : await api.rejectKyc(id);
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      void api
        .listAuditLogs(100)
        .then(setLogs)
        .catch(() => {});
      notify({
        type: "success",
        msg:
          action === "approve"
            ? `e-KYC ${updated.nama} disetujui. Dompet: ${shortAddress(updated.walletAddress)}`
            : `Pendaftaran ${updated.nama} ditolak.`,
      });
    } catch (err) {
      notify({
        type: "error",
        msg: err instanceof ApiError ? err.message : "Aksi KYC gagal.",
      });
    } finally {
      setBusyId(null);
    }
  };

  // --- Flow ②: loan approve/reject ---
  const handleLoan = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const updated =
        action === "approve"
          ? await api.approveLoan(id)
          : await api.rejectLoan(id, "Perlu klarifikasi tambahan");
      setLoans((prev) => prev.map((l) => (l.id === id ? updated : l)));
      void api
        .listAuditLogs(100)
        .then(setLogs)
        .catch(() => {});
      notify({
        type: "success",
        msg:
          action === "approve"
            ? `Pinjaman ${memberName(updated.memberId)} disetujui — escrow dirilis.`
            : `Pinjaman ${memberName(updated.memberId)} ditolak.`,
      });
    } catch (err) {
      notify({
        type: "error",
        msg: err instanceof ApiError ? err.message : "Aksi pinjaman gagal.",
      });
    } finally {
      setBusyId(null);
    }
  };

  // --- Flow ③: renteng bailout ---
  const handleBailout = async (loan: Loan) => {
    setBusyId(loan.id);
    try {
      const res = await api.bailout(loan.id, {});
      setLoans((prev) => prev.map((l) => (l.id === loan.id ? res.loan : l)));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === res.group.id ? { ...g, kasSosial: res.group.kasSosial } : g,
        ),
      );
      void api
        .listAuditLogs(100)
        .then(setLogs)
        .catch(() => {});
      notify({
        type: "success",
        msg: `Tanggung renteng aktif. Kas sosial kelompok kini ${formatIdr(res.group.kasSosial)}.`,
      });
    } catch (err) {
      notify({
        type: "error",
        msg: err instanceof ApiError ? err.message : "Bailout renteng gagal.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleBootstrap = async () => {
    setBusyId("bootstrap");
    try {
      await api.bootstrapOnchain();
      const status = await api.onchainStatus();
      setOnchain(status);
      notify({
        type: "success",
        msg: "Bootstrap on-chain selesai (idempoten).",
      });
    } catch (err) {
      notify({
        type: "error",
        msg:
          err instanceof ApiError ? err.message : "Bootstrap on-chain gagal.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const navItems: [Tab, typeof BarChart3, string, number | null][] = [
    ["dashboard", BarChart3, "Dashboard", null],
    ["kyc", Users, "Antre KYC", kycQueue.length],
    ["grup", Users, "Kelola Kelompok", null],
    ["pinjaman", CreditCard, "Review Pinjaman", pendingLoans.length],
    ["penagihan", ShieldAlert, "Tangga Penagihan", arrears.length],
    ["laporan", FileLineChart, "Laporan & e-RAT", null],
    ["screener", ShieldCheck, "Screening Resiko by AI", null],
  ];

  return (
    <div className="w-full bg-[#FAF9F8] rounded-2xl border border-[#E4E4E4] overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[640px]">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-[#1E1F21] text-white p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-6">
            <img
              src="/logo_green.png"
              alt="RantaiRenteng"
              className="w-8 h-8 object-contain"
            />
            <div>
              <h3 className="font-extrabold text-sm tracking-wider uppercase">
                RantaiRenteng
              </h3>
              <span className="text-[10px] text-slate-400">
                Panel Pengurus v1.0
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            {navItems.map(([tab, Icon, label, badge]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold transition-all ${
                  activeTab === tab
                    ? "bg-[#F06A6A] text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" /> {label}
                </span>
                {badge != null && badge > 0 && (
                  <span className="bg-white/20 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/10 text-[10px] text-slate-400 space-y-2">
          <button
            onClick={loadAll}
            className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-200 font-bold py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Data
          </button>
          <p className="leading-relaxed opacity-80">
            Semua aksi pengurus & escrow tercatat di audit log ledger.
          </p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-6 overflow-y-auto max-h-[80vh] bg-[#FAF9F8]">
        {flash && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              flash.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" /> {flash.msg}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#6D6E6F] mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data koperasi…
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Dashboard Early Warning System (EWS)
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Deteksi dini risiko kelompok untuk mencegah NPL koperasi.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Rasio Tunggakan"
                value={`${nplRate}%`}
                accent="#F06A6A"
                badge="Warning"
              />
              <KpiCard
                label="Total Simpanan Ledger"
                value={formatIdr(totalSavings)}
                accent="#1E1F21"
              />
              <KpiCard
                label="Piutang Berjalan"
                value={formatIdr(outstanding)}
                accent="#548235"
              />
              <KpiCard
                label="Anggota Dorman"
                value={`${dormanCount} / ${members.length}`}
                accent="#1E1F21"
              />
            </div>

            {/* EWS risky loans */}
            <div className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm overflow-hidden">
              <div className="bg-[#FCE8E6] px-4 py-3 border-b border-[#F06A6A]/10 flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#F06A6A] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Kelompok / Anggota
                  Berisiko
                </h4>
                <span className="text-[10px] bg-[#F06A6A] text-white font-bold px-2 py-0.5 rounded-full">
                  EWS
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {loans
                  .filter(
                    (l) =>
                      l.flagAi === "MERAH" ||
                      l.statusCicilan === "UNPAID" ||
                      l.statusCicilan === "DITALANGI",
                  )
                  .map((l) => (
                    <div
                      key={l.id}
                      className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {groupName(l.groupId)}
                        </span>
                        <h5 className="font-bold text-[#1E1F21] text-sm mt-0.5">
                          {memberName(l.memberId)}
                        </h5>
                        <p className="text-slate-500 mt-1">
                          Masalah:{" "}
                          <strong className="text-[#F06A6A]">
                            {l.statusCicilan === "DITALANGI"
                              ? "Tanggung renteng aktif (ditalangi kelompok)"
                              : l.flagAi === "MERAH"
                                ? "AI flag MERAH"
                                : "Angsuran jatuh tempo"}
                          </strong>
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("penagihan")}
                        className="bg-white hover:bg-[#FCE8E6]/40 border border-[#F06A6A]/20 text-[#F06A6A] font-extrabold px-3 py-1.5 rounded-xl transition-all self-start"
                      >
                        Tindak Lanjut
                      </button>
                    </div>
                  ))}
                {loans.filter(
                  (l) =>
                    l.flagAi === "MERAH" ||
                    l.statusCicilan === "UNPAID" ||
                    l.statusCicilan === "DITALANGI",
                ).length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    Tidak ada risiko aktif.
                  </div>
                )}
              </div>
            </div>

            {/* Audit ledger */}
            <div className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm p-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">
                Immutable Audit Log Ledger
              </span>
              <div className="space-y-2 max-h-[240px] overflow-y-auto font-mono text-[11px] text-[#6D6E6F] bg-[#FAF9F8] p-3 rounded-xl border border-[#E4E4E4]">
                {logs.length === 0 ? (
                  <p className="italic text-slate-400">
                    Belum ada entri audit.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="border-b border-[#E4E4E4]/60 pb-1.5 last:border-0"
                    >
                      <span className="text-slate-400">
                        [{formatTimestamp(log.timestamp)}]
                      </span>{" "}
                      <strong className="text-[#548235]">{log.aktor}</strong>:{" "}
                      <span className="text-slate-800">{log.aksi}</span> &rarr;{" "}
                      <span className="text-slate-500">{log.detail}</span>{" "}
                      {log.txLink && (
                        <a
                          href={log.txLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F06A6A] inline-flex items-center gap-0.5"
                        >
                          tx <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* KYC (Flow ①) */}
        {activeTab === "kyc" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Verifikasi e-KYC Anggota
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Setujui untuk menerbitkan dompet on-chain simpanan pokok.
              </p>
            </div>

            {kycQueue.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                Tidak ada antrean e-KYC. Semua anggota terverifikasi.
              </div>
            ) : (
              kycQueue.map((m) => (
                <div
                  key={m.id}
                  className="bg-white p-4 rounded-xl border border-[#E4E4E4] flex flex-col md:flex-row justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#1E1F21]">
                        {m.nama}
                      </h4>
                      <span className="text-[9px] bg-[#FDF6E2] border border-[#F1BD6C]/30 text-[#C55A11] px-2.5 py-0.5 rounded-full font-bold">
                        REKRUT BARU
                      </span>
                    </div>
                    <p className="text-slate-500">
                      NIK: {m.nik} · Telp: {m.noHp}
                    </p>
                    <p className="text-slate-500">
                      {m.alamat} · Pekerjaan: <strong>{m.pekerjaan}</strong> ·
                      Peran:{" "}
                      <span className="capitalize font-bold text-[#548235]">
                        {m.peran}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 items-start">
                    <button
                      onClick={() => handleKyc(m.id, "reject")}
                      disabled={busyId === m.id}
                      className="bg-white border border-[#E4E4E4] hover:bg-[#FCE8E6]/40 text-[#F06A6A] font-bold p-2.5 rounded-xl transition-all disabled:opacity-50"
                      title="Tolak"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleKyc(m.id, "approve")}
                      disabled={busyId === m.id}
                      className="bg-[#62D26F] hover:bg-[#52C25F] text-white font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      {busyId === m.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}{" "}
                      Setujui & Rilis Wallet
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Recently minted wallets */}
            <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#F06A6A]" /> Dompet Anggota
                Aktif
              </span>
              {members
                .filter((m) => m.walletAddress)
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5 last:border-0"
                  >
                    <span className="font-bold text-slate-700">{m.nama}</span>
                    <span className="font-mono text-[11px] text-[#6D6E6F]">
                      {m.walletAddress}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* GRUP (read-only) */}
        {activeTab === "grup" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Manajemen Kelompok Tanggung Renteng
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Ketua, plafon, kehadiran, dan kas sosial kelompok.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm space-y-4"
                >
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#1E1F21]">
                        {g.nama}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {g.jadwalPertemuan} · Kode {g.kodeUndangan}
                      </p>
                    </div>
                    <span className="text-[10px] bg-[#FCE8E6] border border-[#F06A6A]/10 text-[#F06A6A] px-2.5 py-1 rounded-full font-bold">
                      Hadir {g.kehadiranRate}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Cell label="Ketua" value={memberName(g.ketuaId ?? "")} />
                    <Cell label="Plafon Maks" value={formatIdr(g.plafonMaks)} />
                    <Cell
                      label="Kas Sosial"
                      value={formatIdr(g.kasSosial)}
                      accent="#548235"
                    />
                    <Cell label="Reputasi" value={g.reputasiKomunitas} />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Anggota ({g.anggotaIds.length})
                    </span>
                    {g.anggotaIds.map((id) => (
                      <div
                        key={id}
                        className="text-xs flex justify-between bg-[#FAF9F8] px-2.5 py-1.5 rounded"
                      >
                        <span className="font-semibold text-slate-700">
                          {memberName(id)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PINJAMAN review (Flow ②) */}
        {activeTab === "pinjaman" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Review & Persetujuan Pembiayaan
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Skrining risiko AI + jaminan kelompok sebelum rilis escrow.
              </p>
            </div>
            {pendingLoans.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                Tidak ada pengajuan pinjaman untuk ditinjau.
              </div>
            ) : (
              pendingLoans.map((l) => (
                <div
                  key={l.id}
                  className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm overflow-hidden"
                >
                  <div
                    className={`px-4 py-3 border-b flex justify-between items-center ${flagStyle[l.flagAi]}`}
                  >
                    <span className="text-xs font-extrabold flex items-center gap-1">
                      <Activity className="w-4 h-4" /> REKOMENDASI AI:{" "}
                      {l.flagAi} (Skor {l.skorAi}/100)
                    </span>
                    <span className="text-[10px] font-bold uppercase">
                      {l.isSanggah
                        ? "Ada Sanggahan Anggota"
                        : "Menunggu Review"}
                    </span>
                  </div>
                  <div className="p-4 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400">
                          Calon Peminjam
                        </span>
                        <h4 className="font-extrabold text-sm text-[#1E1F21] mt-0.5">
                          {memberName(l.memberId)}
                        </h4>
                        <p className="text-slate-400 text-[10px]">
                          Grup: {groupName(l.groupId)}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-[10px] text-slate-400 block">
                          Jumlah Pengajuan
                        </span>
                        <strong className="text-[#1E1F21] text-base block mt-0.5">
                          {formatIdr(l.nominal)}
                        </strong>
                        <span className="text-[10px] text-[#6D6E6F] block">
                          Tenor {l.tenor} bln · {formatIdr(l.cicilanBulanan)}
                          /bln
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#FAF9F8] p-3 rounded-xl border border-[#E4E4E4]">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                        Butir Analisis AI
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-[#6D6E6F]">
                        {l.flagAlasan.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {l.isSanggah && (
                      <div className="bg-[#F0F4F8] border border-[#A2B6C7]/20 text-[#305A80] p-3 rounded-xl">
                        <strong className="block text-[11px] mb-1">
                          Pembelaan / Hak Sanggah Anggota:
                        </strong>
                        <p className="italic">"{l.sanggahAlasan}"</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 border-t border-[#E4E4E4] pt-3">
                      <button
                        onClick={() => handleLoan(l.id, "reject")}
                        disabled={busyId === l.id}
                        className="bg-white border border-[#E4E4E4] hover:bg-slate-50 text-slate-600 font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                      >
                        Tolak / Klarifikasi
                      </button>
                      <button
                        onClick={() => handleLoan(l.id, "approve")}
                        disabled={busyId === l.id}
                        className="bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busyId === l.id && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        Setujui & Rilis Escrow
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PENAGIHAN (Flow ③ renteng bailout) */}
        {activeTab === "penagihan" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Tangga Penagihan & Tanggung Renteng
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Talangi tunggakan dari kas sosial kelompok (renteng bailout).
              </p>
            </div>
            {arrears.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E4E4E4] p-8 text-center text-slate-400 text-xs italic">
                Tidak ada tunggakan berjalan. Rasio NPL sehat.
              </div>
            ) : (
              arrears.map((l) => (
                <div
                  key={l.id}
                  className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm space-y-4 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {groupName(l.groupId)}
                      </span>
                      <h4 className="font-extrabold text-sm text-[#1E1F21] mt-0.5">
                        {memberName(l.memberId)}
                      </h4>
                      <span
                        className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                          l.statusCicilan === "DITALANGI"
                            ? "bg-[#FCE8E6] text-[#F06A6A]"
                            : "bg-[#FDF6E2] text-[#C55A11]"
                        }`}
                      >
                        {l.statusCicilan === "DITALANGI"
                          ? "DITALANGI (Renteng aktif)"
                          : "Angsuran belum dibayar"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">
                        Tunggakan bulan ini
                      </span>
                      <strong className="text-[#F06A6A] text-sm block mt-0.5">
                        {formatIdr(l.cicilanBulanan)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-[#E4E4E4] pt-3">
                    {l.statusCicilan === "DITALANGI" ? (
                      <span className="text-[11px] font-bold text-[#F06A6A] bg-[#FCE8E6] px-3 py-2 rounded-xl">
                        Sudah ditalangi kas sosial kelompok
                      </span>
                    ) : (
                      <button
                        onClick={() => handleBailout(l)}
                        disabled={busyId === l.id}
                        className="bg-[#F06A6A] hover:bg-[#E5544F] text-white font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busyId === l.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <HeartHandshake className="w-4 h-4" />
                        )}{" "}
                        Aktifkan Tanggung Renteng (Talangi)
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* LAPORAN */}
        {activeTab === "laporan" && (
          <div className="space-y-4 text-xs">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Laporan Transparansi & e-RAT
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Rekapitulasi neraca real-time dari ledger koperasi.
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E4] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Cell
                  label="Total Aset Likuid (Tabungan)"
                  value={formatIdr(totalSavings)}
                  big
                />
                <Cell
                  label="Total Piutang (Escrow)"
                  value={formatIdr(outstanding)}
                  accent="#548235"
                  big
                />
                <Cell label="Jumlah Kelompok" value={`${groups.length}`} big />
                <Cell
                  label="Keanggotaan"
                  value={`${members.length} orang`}
                  big
                />
              </div>
              <div className="p-3 bg-[#EDF9F0] border border-[#62D26F]/20 rounded-xl text-slate-700 space-y-1">
                <h4 className="font-bold text-[#1E1F21]">
                  Rasio NPL Terkendali
                </h4>
                <p className="text-[#6D6E6F]">
                  Agunan sosial tanggung renteng menahan gagal bayar di{" "}
                  <strong className="text-[#548235]">{nplRate}%</strong>.
                </p>
              </div>
            </div>

            {/* On-chain status + bootstrap */}
            <div className="bg-white p-5 rounded-xl border border-[#E4E4E4] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Status On-Chain (Relayer)
                </span>
                <button
                  onClick={handleBootstrap}
                  disabled={busyId === "bootstrap"}
                  className="bg-[#1E1F21] hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busyId === "bootstrap" && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Bootstrap On-Chain
                </button>
              </div>
              {onchain ? (
                <div className="grid grid-cols-2 gap-3">
                  <Cell
                    label="Relayer"
                    value={shortAddress(onchain.relayerAddress)}
                  />
                  <Cell
                    label="Admin"
                    value={shortAddress(onchain.adminAddress)}
                  />
                  <Cell
                    label="Relayer dapat menulis"
                    value={onchain.canRelayerWrite ? "Ya" : "Tidak"}
                  />
                  <Cell
                    label="Koperasi dapat menulis"
                    value={onchain.canKoperasiWrite ? "Ya" : "Tidak"}
                  />
                </div>
              ) : (
                <p className="text-slate-400 italic">
                  Status on-chain tidak tersedia.
                </p>
              )}
            </div>
          </div>
        )}

        {/* SCREENER */}
        {activeTab === "screener" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1E1F21]">
                Asisten Skrining EWS AI (Kalkulator Manual)
              </h2>
              <p className="text-xs text-[#6D6E6F]">
                Hitung kelayakan secara transparan sebelum pencairan.
              </p>
            </div>
            <RiskScreenerTool />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  badge,
}: {
  label: string;
  value: string;
  accent: string;
  badge?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm">
      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
        {label}
      </span>
      <div className="flex justify-between items-baseline mt-1.5 gap-2">
        <span
          className="text-lg font-black break-all"
          style={{ color: accent }}
        >
          {value}
        </span>
        {badge && (
          <span className="text-[10px] text-[#F06A6A] font-semibold bg-[#FCE8E6] px-1.5 py-0.5 rounded shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div className="bg-[#FAF9F8] p-2.5 rounded-lg">
      <span className="text-[10px] text-slate-400 block">{label}</span>
      <strong
        className={`${big ? "text-base" : "text-xs"} block mt-0.5 capitalize`}
        style={{ color: accent ?? "#1E1F21" }}
      >
        {value}
      </strong>
    </div>
  );
}

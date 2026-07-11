import { useEffect, useState } from "react";
import {
  Loader2,
  Download,
  Users,
  PiggyBank,
  CreditCard,
  HeartHandshake,
  RefreshCw,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatIdr, formatTimestamp } from "../lib/format";
import type { ERatReport } from "../types";

const FLAG_COLORS: Record<string, string> = {
  HIJAU: "#62D26F",
  KUNING: "#F1BD6C",
  MERAH: "#F06A6A",
};
const JENIS_COLORS: Record<string, string> = {
  Pokok: "#1E1F21",
  Wajib: "#F06A6A",
  Sukarela: "#548235",
};

export default function ERatReportPanel() {
  const [report, setReport] = useState<ERatReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getERat()
      .then(setReport)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Gagal memuat laporan."),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      await api.exportERatXlsx();
    } catch (err) {
      setExportErr(err instanceof ApiError ? err.message : "Unduh gagal.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6D6E6F] py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Menyusun laporan e-RAT…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs flex items-center justify-between">
        <span>{error ?? "Laporan tidak tersedia."}</span>
        <button
          onClick={load}
          className="flex items-center gap-1 font-bold text-red-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Coba lagi
        </button>
      </div>
    );
  }

  const { summary, charts, tables } = report;

  return (
    <div className="space-y-5 text-xs">
      {/* Export bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl border border-[#E4E4E4] p-3">
        <div>
          <p className="text-[11px] text-[#6D6E6F]">
            Dihasilkan {formatTimestamp(report.generatedAt)} · rekap ledger
            real-time.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-[#548235] hover:bg-[#446a2b] disabled:opacity-60 text-white font-extrabold px-3.5 py-2 rounded-xl shadow-sm transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export XLSX
          </button>
          {exportErr && <span className="text-[10px] text-[#C0392B]">{exportErr}</span>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Anggota"
          value={`${summary.anggotaApproved}/${summary.totalAnggota}`}
          sub="terverifikasi"
          accent="#1E1F21"
        />
        <StatCard
          icon={PiggyBank}
          label="Total Simpanan"
          value={formatIdr(summary.totalSimpanan)}
          sub={`Kas sosial ${formatIdr(summary.totalKasSosial)}`}
          accent="#548235"
        />
        <StatCard
          icon={CreditCard}
          label="Total Pinjaman"
          value={formatIdr(summary.totalPinjaman)}
          sub={`${summary.pinjamanAktif} aktif (cair)`}
          accent="#F06A6A"
        />
        <StatCard
          icon={HeartHandshake}
          label="Renteng Aktif"
          value={`${summary.rentengAktif}`}
          sub="pinjaman ditalangi"
          accent="#C55A11"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Pinjaman per Flag AI (EWS)">
          <HBarChart
            data={charts.loansByFlag.map((d) => ({
              label: d.flag,
              value: d.count,
              color: FLAG_COLORS[d.flag] ?? "#F06A6A",
            }))}
            valueFmt={(v) => `${v}`}
          />
        </ChartCard>

        <ChartCard title="Komposisi Simpanan">
          <HBarChart
            data={charts.simpananByJenis.map((d) => ({
              label: d.jenis,
              value: d.total,
              color: JENIS_COLORS[d.jenis] ?? "#F06A6A",
            }))}
            valueFmt={formatIdr}
          />
        </ChartCard>

        <ChartCard title="Tren Simpanan (6 bulan)" full>
          <AreaChart data={charts.savingsOverTime} />
        </ChartCard>
      </div>

      {/* Tables */}
      <DataTable
        title={`Daftar Anggota (${tables.anggota.length})`}
        headers={["Nama", "NIK", "KYC", "Skor", "Simpanan", "Dompet"]}
        rows={tables.anggota.map((a) => [
          a.nama,
          a.nik,
          a.statusKyc,
          `${a.skorKeanggotaan}`,
          formatIdr(a.simpananTotal),
          a.walletAddress ? `${a.walletAddress.slice(0, 8)}…` : "—",
        ])}
      />
      <DataTable
        title={`Pinjaman (${tables.pinjaman.length})`}
        headers={["Anggota", "Nominal", "Status", "Cicilan", "Flag AI", "Skor"]}
        rows={tables.pinjaman.map((p) => [
          p.memberNama,
          formatIdr(p.nominal),
          p.status,
          p.statusCicilan,
          p.flagAi,
          `${p.skorAi}`,
        ])}
      />
      <DataTable
        title={`Tanggung Renteng (${tables.tanggungRenteng.length})`}
        headers={["Anggota", "Event", "Jumlah", "Periode", "Tanggal"]}
        rows={tables.tanggungRenteng.map((r) => [
          r.memberNama,
          r.event,
          formatIdr(r.amount),
          `${r.period}`,
          formatTimestamp(r.createdAt),
        ])}
      />
    </div>
  );
}

/* ---------- SVG charts (no external lib) ---------- */

function HBarChart({
  data,
  valueFmt,
}: {
  data: { label: string; value: number; color: string }[];
  valueFmt: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) {
    return <Empty>Belum ada data.</Empty>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-[#6D6E6F]">
            <span className="capitalize">{d.label}</span>
            <span className="text-[#1E1F21] font-bold">{valueFmt(d.value)}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color,
                minWidth: d.value > 0 ? "6px" : "0",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaChart({ data }: { data: { month: string; total: number }[] }) {
  if (data.length === 0) return <Empty>Belum ada transaksi simpanan.</Empty>;

  const W = 480;
  const H = 140;
  const P = 8;
  const max = Math.max(1, ...data.map((d) => d.total));
  const n = data.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);

  const linePts = data.map((d, i) => `${x(i)},${y(d.total)}`).join(" ");
  const areaPts = `${P},${H - P} ${linePts} ${x(n - 1)},${H - P}`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        className="w-full min-w-[320px]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="erat-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F06A6A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F06A6A" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#erat-area)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="#F06A6A"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={x(i)} cy={y(d.total)} r="3" fill="#E5544F" />
            <text
              x={x(i)}
              y={H + 14}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: "9px" }}
            >
              {d.month.slice(2)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------- Layout helpers ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="bg-white p-3.5 rounded-xl border border-[#E4E4E4] shadow-sm">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className="text-base font-black break-all mt-1"
        style={{ color: accent }}
      >
        {value}
      </div>
      <span className="text-[10px] text-slate-400">{sub}</span>
    </div>
  );
}

function ChartCard({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`bg-white p-4 rounded-xl border border-[#E4E4E4] shadow-sm ${full ? "lg:col-span-2" : ""}`}
    >
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-3">
        {title}
      </span>
      {children}
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E4E4] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E4E4E4]">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[480px]">
          <thead>
            <tr className="bg-[#FAF9F8] text-slate-400">
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left font-bold uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-4 text-center text-slate-400 italic"
                >
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-3 py-2 text-slate-700 whitespace-nowrap capitalize"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-slate-400 italic text-center py-4">{children}</p>
  );
}

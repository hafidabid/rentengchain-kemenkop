import { useNavigate } from "react-router-dom";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import PengurusView from "../components/PengurusView";

export default function PengurusPage() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F8] text-[#1E1F21] flex flex-col">
      <header className="bg-white border-b border-[#E4E4E4] px-6 py-3 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo_banner.png"
              alt="RantaiRenteng"
              className="h-8 w-auto object-contain"
            />
            <span className="hidden sm:inline-flex items-center gap-1 bg-[#1E1F21] text-[9px] text-white px-2 py-0.5 rounded-full font-bold uppercase">
              <Users className="w-3 h-3" /> Panel Pengurus
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-[#1E1F21] block leading-tight">
                {member?.nama}
              </span>
              <span className="text-[10px] text-[#6D6E6F]">Administrator</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-[#6D6E6F] hover:text-[#F06A6A] bg-[#F6F5F3] hover:bg-[#FCE8E6] border border-[#E4E4E4] px-3 py-1.5 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto p-4 lg:p-6">
        <PengurusView />
      </main>

      <footer className="bg-[#FAF9F8] border-t border-[#E4E4E4] text-center py-4 text-[11px] text-[#9CA1A8] font-medium">
        &copy; 2026 RantaiRenteng by Calon Manager Merah Putih
      </footer>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../lib/auth';
import AnggotaView from '../components/AnggotaView';

export default function AnggotaPage() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F8] text-[#1E1F21] flex flex-col">
      <header className="bg-white border-b border-[#E4E4E4] px-4 py-3 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo_banner.png"
              alt="RantaiRenteng"
              className="h-8 w-auto object-contain"
            />
            <span className="hidden sm:inline-flex items-center gap-1 bg-[#FCE8E6] text-[9px] text-[#F06A6A] border border-[#F06A6A]/20 px-2 py-0.5 rounded-full font-bold uppercase">
              <Smartphone className="w-3 h-3" /> Aplikasi Anggota
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-[#6D6E6F] hover:text-[#F06A6A] bg-[#F6F5F3] hover:bg-[#FCE8E6] border border-[#E4E4E4] px-3 py-1.5 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
            <span className="sm:hidden">{member?.nama.split(' ')[0]}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full py-6 px-2">
        <AnggotaView />
      </main>

      <footer className="bg-[#FAF9F8] border-t border-[#E4E4E4] text-center py-4 text-[11px] text-[#9CA1A8] font-medium">
        &copy; 2026 RantaiRenteng · Koperasi Desa Merah Putih
      </footer>
    </div>
  );
}

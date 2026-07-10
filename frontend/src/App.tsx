import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import LoginPage from './pages/LoginPage';
import AnggotaPage from './pages/AnggotaPage';
import PengurusPage from './pages/PengurusPage';
import type { Role } from './types';

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F8] text-[#6D6E6F] text-sm font-semibold">
      Memuat RantaiRenteng…
    </div>
  );
}

/** Route guard: requires a session and (optionally) a specific role. */
function Protected({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const { member, loading } = useAuth();
  if (loading) return <Splash />;
  if (!member) return <Navigate to="/login" replace />;
  if (role && member.role !== role) {
    // Send each role to its home surface.
    return (
      <Navigate to={member.role === 'Pengurus' ? '/laman-pengurus' : '/'} replace />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected role="Anggota">
            <AnggotaPage />
          </Protected>
        }
      />
      <Route
        path="/laman-pengurus"
        element={
          <Protected role="Pengurus">
            <PengurusPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Home from '@/pages/Home';
import AdminLogin from '@/pages/AdminLogin';
import AdminPanel from '@/pages/AdminPanel';
import Participants from '@/pages/Participants';
import TournamentSetup from '@/pages/TournamentSetup';
import TournamentDashboard from '@/pages/TournamentDashboard';
import ScoreboardView from '@/pages/ScoreboardView';

function ProtectedRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/panel" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/admin/participants" element={<ProtectedRoute><Participants /></ProtectedRoute>} />
          <Route path="/tournament/new" element={<TournamentSetup />} />
          <Route path="/tournament/:id" element={<ScoreboardView />} />
          <Route path="/tournament/:id/manage" element={<TournamentDashboard />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}

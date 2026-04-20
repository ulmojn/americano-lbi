import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trophy, Plus, ArrowRight, Trash, SignOut, Users } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const TYPE_LABELS = { americano: 'Americano', mexicano: 'Mexicano', winners_court: 'Winners Court' };
const STATUS_LABELS = { active: 'Aktiv', completed: 'Afsluttet' };

export default function AdminPanel() {
  const [tournaments, setTournaments] = useState([]);
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/api/tournaments`).then(r => setTournaments(r.data)).catch(() => {});
  }, []);

  async function handleDelete(id) {
    if (!window.confirm('Slet turnering?')) return;
    try {
      await axios.delete(`${API}/api/tournaments/${id}`, { headers });
      setTournaments(prev => prev.filter(t => t.id !== id));
      toast.success('Turnering slettet');
    } catch {
      toast.error('Kunne ikke slette');
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-[#D1F441]" weight="fill" />
          <span className="font-display text-xl font-bold tracking-wider uppercase">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/participants" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#D1F441] transition-colors">
            <Users size={14} /> Spillerpulje
          </Link>
          <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
            <SignOut size={14} /> Log ud
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Turneringer</h2>
          <Link to="/tournament/new">
            <Button size="sm">
              <Plus size={14} /> Ny turnering
            </Button>
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>Ingen turneringer endnu</p>
            <Link to="/tournament/new" className="mt-4 inline-block">
              <Button variant="outline" size="sm">Opret første turnering</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-[#111] border border-[#1A1A1A]">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {TYPE_LABELS[t.tournament_type]}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'active' ? 'bg-[#D1F441]/20 text-[#D1F441]' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/tournament/${t.id}/manage`}>
                    <Button variant="outline" size="sm">
                      Administrer <ArrowRight size={12} />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-gray-600 hover:text-red-400">
                    <Trash size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

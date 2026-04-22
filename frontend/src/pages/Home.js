import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Lock, Plus, Wrench } from '@phosphor-icons/react';
import LbiLogo from '@/components/LbiLogo';
import { Button } from '@/components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const TYPE_LABELS = { americano: 'Americano', mexicano: 'Mexicano', winners_court: 'Winners Court' };
const STATUS_LABELS = { setup: 'Opsætning', active: 'Aktiv', completed: 'Afsluttet' };

export default function Home() {
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/tournaments`).then(r => setTournaments(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LbiLogo size={28} />
          <span className="font-display text-xl font-bold tracking-wider uppercase">Padel LBI</span>
        </div>
        <Link to="/admin" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#D1F441] transition-colors">
          <Lock size={14} />
          Admin
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-wide uppercase mb-2">Turneringer</h1>
            <p className="text-gray-400">Følg live resultater og stillinger</p>
          </div>
          <Link to="/tournament/new">
            <Button size="sm"><Plus size={14} /> Ny turnering</Button>
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <LbiLogo size={48} className="mx-auto mb-4 opacity-30" />
            <p>Ingen turneringer endnu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(t => (
              <div key={t.id} className="flex items-center bg-[#111] border border-[#1A1A1A] hover:border-[#D1F441]/30 hover:bg-[#141414] transition-all group">
                <Link to={`/tournament/${t.id}`} className="flex-1 flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {TYPE_LABELS[t.tournament_type]}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === 'active' ? 'bg-[#D1F441]/20 text-[#D1F441]' :
                      t.status === 'completed' ? 'bg-gray-700 text-gray-400' :
                      'bg-blue-900/30 text-blue-400'
                    }`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    <ArrowRight size={16} className="text-gray-600 group-hover:text-[#D1F441] transition-colors" />
                  </div>
                </Link>
                {t.status === 'active' && (
                  <Link
                    to={`/tournament/${t.id}/manage`}
                    title="Administrer turnering"
                    className="px-4 py-4 text-gray-600 hover:text-[#D1F441] border-l border-[#1A1A1A] transition-colors"
                  >
                    <Wrench size={15} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

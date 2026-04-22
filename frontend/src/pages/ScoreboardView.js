import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Wrench } from '@phosphor-icons/react';
import LbiLogo from '@/components/LbiLogo';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const TYPE_LABELS = { americano: 'Americano', mexicano: 'Mexicano', winners_court: 'Winners Court' };

export default function ScoreboardView() {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [standings, setStandings] = useState([]);
  const [currentRoundMatches, setCurrentRoundMatches] = useState([]);

  useEffect(() => {
    async function fetch() {
      try {
        const [tRes, sRes] = await Promise.all([
          axios.get(`${API}/api/tournaments/${id}`),
          axios.get(`${API}/api/tournaments/${id}/scoreboard`),
        ]);
        setTournament(tRes.data);
        setStandings(sRes.data.standings || []);

        const matches = tRes.data.matches || [];
        const maxRound = Math.max(...matches.map(m => m.round), 0);
        setCurrentRoundMatches(matches.filter(m => m.round === maxRound));
      } catch {}
    }
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [id]);

  if (!tournament) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-500">Indlæser...</div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Alle turneringer
        </Link>
        <div className="text-center">
          <div className="font-display text-lg font-bold uppercase tracking-wide">{tournament.name}</div>
          <div className="text-xs text-gray-500">{TYPE_LABELS[tournament.tournament_type]}</div>
        </div>
        {tournament.status === 'active' ? (
          <Link to={`/tournament/${id}/manage`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#D1F441] transition-colors w-20 justify-end">
            <Wrench size={14} /> Administrer
          </Link>
        ) : (
          <div className="w-20" />
        )}
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {currentRoundMatches.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-4">
              Runde {currentRoundMatches[0]?.round} — Aktuelle kampe
            </h2>
            <div className="space-y-3">
              {currentRoundMatches.sort((a, b) => a.court - b.court).map(m => (
                <div key={m.id} className="bg-[#111] border border-[#1A1A1A] p-4">
                  <div className="text-xs text-gray-500 mb-2 font-mono uppercase">Bane {m.court}</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-center space-y-1">
                      {m.team1.map(p => <div key={p.id}>{p.name}</div>)}
                    </div>
                    <div className={`text-center font-display text-2xl font-bold w-20 ${m.completed ? 'text-[#D1F441]' : 'text-gray-600'}`}>
                      {m.completed ? `${m.team1_score}–${m.team2_score}` : 'vs'}
                    </div>
                    <div className="flex-1 text-sm text-center space-y-1">
                      {m.team2.map(p => <div key={p.id}>{p.name}</div>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide mb-4">Samlet stilling</h2>
          {standings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Ingen resultater endnu</div>
          ) : (
            <div className="space-y-1">
              {standings.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-4 px-4 py-3 border ${
                  i === 0 ? 'bg-[#D1F441]/5 border-[#D1F441]/20' : 'bg-[#111] border-[#1A1A1A]'
                }`}>
                  <span className={`w-6 text-sm font-mono font-bold ${i === 0 ? 'text-[#D1F441]' : 'text-gray-600'}`}>{p.rank}</span>
                  {i === 0 && <LbiLogo size={16} />}
                  <span className="flex-1 font-medium">{p.name}</span>
                  <div className="text-right">
                    <div className={`font-display text-xl font-bold ${i === 0 ? 'text-[#D1F441]' : 'text-white'}`}>{p.points}</div>
                    <div className="text-xs text-gray-500">{p.won}V / {p.played}K · diff {p.diff > 0 ? '+' : ''}{p.diff}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-gray-600">Opdateres automatisk hvert 15. sekund</p>
      </div>
    </div>
  );
}

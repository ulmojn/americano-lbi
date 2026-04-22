import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ListBullets, ChartBar, Users, Check, X, PencilSimple, FlagCheckered, Warning } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const TYPE_LABELS = { americano: 'Americano', mexicano: 'Mexicano', winners_court: 'Winners Court' };

export default function TournamentDashboard() {
  const { id } = useParams();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scoreboard, setScoreboard] = useState([]);
  const [activeTab, setActiveTab] = useState('kampe');
  const [scoreModal, setScoreModal] = useState(null); // { match }
  const [modalScores, setModalScores] = useState({ t1: '', t2: '' });
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [tRes, sRes] = await Promise.all([
        axios.get(`${API}/api/tournaments/${id}`, { timeout: 8000 }),
        axios.get(`${API}/api/tournaments/${id}/scoreboard`, { timeout: 8000 }),
      ]);
      setTournament(tRes.data);
      setScoreboard(sRes.data.standings || []);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function groupByRound(matches) {
    return matches.reduce((acc, m) => {
      const r = m.round;
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});
  }

  function formatTime(date) {
    if (!date) return '';
    return date.toLocaleTimeString('da-DK', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(/:/g, '.');
  }

  const pts = tournament?.points_per_game;

  function openModal(match, prefill = false) {
    setScoreModal({ match });
    setModalScores(prefill
      ? { t1: String(match.team1_score ?? ''), t2: String(match.team2_score ?? '') }
      : { t1: '', t2: '' }
    );
  }

  function handleT1Change(val) {
    const n = val === '' ? '' : Math.max(0, parseInt(val) || 0);
    const t2 = (pts && val !== '') ? Math.max(0, pts - n) : '';
    setModalScores({ t1: val === '' ? '' : n, t2: t2 === '' ? '' : String(t2) });
  }

  function handleT2Change(val) {
    const n = val === '' ? '' : Math.max(0, parseInt(val) || 0);
    const t1 = (pts && val !== '') ? Math.max(0, pts - n) : '';
    setModalScores({ t1: t1 === '' ? '' : String(t1), t2: val === '' ? '' : n });
  }

  async function completeTournament() {
    setCompleting(true);
    try {
      await axios.patch(`${API}/api/tournaments/${id}/complete`, {}, { headers });
      toast.success('Turnering afsluttet');
      setConfirmComplete(false);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Ukendt fejl';
      toast.error(`Kunne ikke afslutte: ${msg}`);
    } finally {
      setCompleting(false);
    }
  }

  async function submitScore() {
    if (modalScores.t1 === '' || modalScores.t2 === '') {
      return toast.error('Angiv begge scores');
    }
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/tournaments/${id}/matches/${scoreModal.match.id}/result`,
        { team1_score: parseInt(modalScores.t1), team2_score: parseInt(modalScores.t2) },
        { headers }
      );
      toast.success('Score gemt');
      setScoreModal(null);
      await fetchData();
    } catch {
      toast.error('Kunne ikke gemme score');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / Error states ──────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-500">
      <span className="animate-pulse">Indlæser...</span>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-gray-500 gap-3">
      <p>Kunne ikke forbinde til backend.</p>
      <p className="text-xs">Er serveren startet? <code className="bg-[#111] px-1">npm start</code> i backend-mappen.</p>
      <button onClick={fetchData} className="text-[#D1F441] text-sm hover:underline">Prøv igen</button>
    </div>
  );

  if (!tournament) return null;

  const rounds = groupByRound(tournament.matches || []);
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* Header */}
      <header className="border-b border-[#1A1A1A] px-6 py-4 flex items-center gap-4">
        <Link to="/admin/panel" className="text-gray-500 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-bold uppercase tracking-wide truncate">
            {tournament.name}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">
            {TYPE_LABELS[tournament.tournament_type]} • {tournament.courts} {tournament.courts === 1 ? 'bane' : 'baner'}
          </div>
        </div>
        {tournament.status === 'completed' ? (
          <span className="text-xs font-mono font-bold text-gray-500 bg-[#1A1A1A] px-2 py-1 shrink-0">AFSLUTTET</span>
        ) : confirmComplete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">Er du sikker?</span>
            <button onClick={completeTournament} disabled={completing}
              className="text-xs font-mono font-bold px-3 py-1.5 bg-[#D1F441] text-black hover:bg-[#c5e837] transition-colors disabled:opacity-50">
              {completing ? 'AFSLUTTER...' : 'JA, AFSLUT'}
            </button>
            <button onClick={() => setConfirmComplete(false)} className="text-gray-600 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmComplete(true)}
            className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-[#D1F441] transition-colors shrink-0">
            <FlagCheckered size={14} /> Afslut
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="border-b border-[#1A1A1A] px-6 flex gap-6">
        <button
          onClick={() => setActiveTab('kampe')}
          className={`flex items-center gap-2 py-3 text-xs font-mono font-bold tracking-widest border-b-2 transition-colors ${
            activeTab === 'kampe'
              ? 'border-[#D1F441] text-[#D1F441]'
              : 'border-transparent text-gray-500 hover:text-white'
          }`}
        >
          <ListBullets size={15} /> KAMPE
        </button>
        <button
          onClick={() => setActiveTab('stilling')}
          className={`flex items-center gap-2 py-3 text-xs font-mono font-bold tracking-widest border-b-2 transition-colors ${
            activeTab === 'stilling'
              ? 'border-[#D1F441] text-[#D1F441]'
              : 'border-transparent text-gray-500 hover:text-white'
          }`}
        >
          <ChartBar size={15} /> STILLING
        </button>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── KAMPE TAB ── */}
        {activeTab === 'kampe' && (
          <div className="space-y-10">
            {roundNumbers.map(r => {
              const roundMatches = rounds[r].slice().sort((a, b) => a.court - b.court);
              const completed = roundMatches.filter(m => m.completed).length;
              return (
                <div key={r}>
                  {/* Round heading */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-7 h-7 bg-[#1A1A1A] flex items-center justify-center text-xs font-mono font-bold text-[#D1F441]">
                      {r}
                    </span>
                    <h2 className="font-display text-base font-bold uppercase tracking-widest">
                      Runde {r}
                    </h2>
                    <span className="text-xs text-gray-600 font-mono ml-auto">
                      {completed}/{roundMatches.length} færdige
                    </span>
                  </div>

                  {/* Match grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {roundMatches.map(m => (
                      <div key={m.id} className="bg-[#111] border border-[#1A1A1A]">

                        {/* Card header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A1A1A]">
                          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                            Bane {m.court}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 font-mono font-bold uppercase tracking-wider ${
                            m.completed
                              ? 'bg-[#1A1A1A] text-gray-500'
                              : 'bg-[#D1F441]/15 text-[#D1F441]'
                          }`}>
                            {m.completed ? 'Færdig' : 'Aktiv'}
                          </span>
                        </div>

                        {/* Teams */}
                        <div className="divide-y divide-[#1A1A1A]">
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Users size={13} className="text-gray-600 shrink-0" />
                              <span className="text-sm truncate">
                                {m.team1.map(p => p.name).join(' & ')}
                              </span>
                            </div>
                            <span className={`text-sm font-mono ml-4 shrink-0 ${m.completed ? 'text-white font-bold' : 'text-gray-600'}`}>
                              {m.completed ? m.team1_score : '–'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Users size={13} className="text-gray-600 shrink-0" />
                              <span className="text-sm truncate">
                                {m.team2.map(p => p.name).join(' & ')}
                              </span>
                            </div>
                            <span className={`text-sm font-mono ml-4 shrink-0 ${m.completed ? 'text-white font-bold' : 'text-gray-600'}`}>
                              {m.completed ? m.team2_score : '–'}
                            </span>
                          </div>
                        </div>

                        {/* Action */}
                        {tournament.status !== 'completed' && (
                          <div className="px-4 py-3 border-t border-[#1A1A1A]">
                            {m.completed ? (
                              <button
                                onClick={() => openModal(m, true)}
                                className="w-full py-2.5 flex items-center justify-center gap-2 border border-[#1A1A1A] text-[11px] font-mono tracking-widest text-gray-600 hover:border-[#444] hover:text-gray-400 transition-colors"
                              >
                                <PencilSimple size={12} /> REDIGER RESULTAT
                              </button>
                            ) : (
                              <button
                                onClick={() => openModal(m)}
                                className="w-full py-2.5 border border-[#2A2A2A] text-[11px] font-mono tracking-widest text-gray-400 hover:border-[#D1F441] hover:text-[#D1F441] transition-colors"
                              >
                                INDTAST RESULTAT
                              </button>
                            )}
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {roundNumbers.length === 0 && (
              <p className="text-center text-gray-600 py-12">Ingen kampe endnu</p>
            )}
          </div>
        )}

        {/* ── STILLING TAB ── */}
        {activeTab === 'stilling' && (
          <div className="space-y-1">
            {scoreboard.length === 0 && (
              <p className="text-center text-gray-600 py-12">Ingen resultater endnu</p>
            )}
            {scoreboard.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-4 py-3 border ${
                  i === 0 ? 'bg-[#D1F441]/5 border-[#D1F441]/20' : 'bg-[#111] border-[#1A1A1A]'
                }`}
              >
                <span className={`w-6 text-sm font-mono font-bold shrink-0 ${i === 0 ? 'text-[#D1F441]' : 'text-gray-600'}`}>
                  {p.rank}
                </span>
                <span className="flex-1 text-sm">{p.name}</span>
                <span className="text-xs text-gray-500 font-mono">{p.played}K&nbsp;{p.won}V</span>
                <span className={`font-display text-xl font-bold w-10 text-right ${i === 0 ? 'text-[#D1F441]' : 'text-white'}`}>
                  {p.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Score Modal ── */}
      {scoreModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
          onClick={() => setScoreModal(null)}
        >
          <div
            className="bg-[#161616] border border-[#2A2A2A] w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div>
                <h3 className="font-display font-bold text-lg uppercase tracking-wide">
                  {scoreModal.match.completed ? 'Rediger Resultat' : 'Indtast Resultat'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bane {scoreModal.match.court} • Runde {scoreModal.match.round}
                  {pts && <span className="ml-2 text-[#D1F441]">• Til {pts} point</span>}
                </p>
              </div>
              <button
                onClick={() => setScoreModal(null)}
                className="text-gray-600 hover:text-white transition-colors mt-0.5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Score inputs */}
            <div className="px-6 pb-5 space-y-4">
              {/* Team 1 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={12} className="text-gray-600" />
                  <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                    {scoreModal.match.team1.map(p => p.name).join(' & ')}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  autoFocus
                  placeholder="0"
                  value={modalScores.t1}
                  onChange={e => handleT1Change(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitScore()}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white text-center text-3xl font-mono font-bold py-4 focus:border-[#D1F441] outline-none transition-colors"
                />
              </div>

              {/* Team 2 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={12} className="text-gray-600" />
                  <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                    {scoreModal.match.team2.map(p => p.name).join(' & ')}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={modalScores.t2}
                  onChange={e => handleT2Change(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitScore()}
                  className="w-full bg-[#0D0D0D] border border-[#2A2A2A] text-white text-center text-3xl font-mono font-bold py-4 focus:border-[#D1F441] outline-none transition-colors"
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setScoreModal(null)}
                className="flex-1 py-3 border border-[#2A2A2A] text-xs font-mono font-bold tracking-widest text-gray-400 hover:border-[#444] hover:text-white transition-colors"
              >
                ANNULLER
              </button>
              <button
                onClick={submitScore}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#D1F441] text-black text-xs font-mono font-bold tracking-widest hover:bg-[#c5e837] transition-colors disabled:opacity-50"
              >
                <Check size={14} weight="bold" />
                {saving ? 'GEMMER...' : scoreModal.match.completed ? 'OPDATER RESULTAT' : 'GEM RESULTAT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

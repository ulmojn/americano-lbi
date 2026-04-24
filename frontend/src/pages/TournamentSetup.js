import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, X, MagnifyingGlass, Shuffle } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const TYPES = [
  { value: 'americano', label: 'Americano', desc: 'Alle kampe genereres på forhånd' },
  { value: 'mexicano', label: 'Mexicano', desc: 'Næste runde baseres på stilling' },
  { value: 'winners_court', label: 'Winners Court', desc: 'Vindere avancerer til bedste bane' },
  { value: 'team_americano', label: 'Team Americano', desc: 'Faste hold spiller round-robin mod hinanden' },
];

export default function TournamentSetup() {
  const [name, setName] = useState('');
  const [type, setType] = useState('americano');
  const [courts, setCourts] = useState(1);
  const [pointsPerGame, setPointsPerGame] = useState(16);
  const [customPoints, setCustomPoints] = useState('');
  const [participants, setParticipants] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newPlayerInput, setNewPlayerInput] = useState('');
  const [newPlayers, setNewPlayers] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamOrder, setTeamOrder] = useState([]);
  const [swapSelect, setSwapSelect] = useState(null); // {orderIdx}
  const navigate = useNavigate();
  const inputRef = useRef();

  useEffect(() => {
    axios.get(`${API}/api/participants`).then(r => setParticipants(r.data)).catch(() => {});
  }, []);

  const filteredParticipants = participants.filter(p =>
    !selectedIds.has(p.id) &&
    (newPlayerInput.trim() === '' || p.name.toLowerCase().includes(newPlayerInput.toLowerCase()))
  );

  function handleTypeChange(newType) {
    setType(newType);
    if (newType === 'team_americano') {
      setTeamOrder([...selectedIds]);
    }
  }

  function selectParticipant(p) {
    setSelectedIds(prev => new Set([...prev, p.id]));
    setTeamOrder(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
    setNewPlayerInput('');
    inputRef.current?.focus();
  }

  function deselectParticipant(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setTeamOrder(prev => prev.filter(x => x !== id));
    setSwapSelect(null);
  }

  async function addNewPlayer(e) {
    if (e?.preventDefault) e.preventDefault();
    const playerName = newPlayerInput.trim();
    if (!playerName) return;

    const existing = participants.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (existing) {
      selectParticipant(existing);
      return;
    }
    if (newPlayers.some(p => p.toLowerCase() === playerName.toLowerCase())) {
      toast.error('Spiller allerede tilføjet');
      return;
    }
    try {
      const { data } = await axios.post(`${API}/api/participants`, { name: playerName });
      setParticipants(prev => [...prev, data]);
      setSelectedIds(prev => new Set([...prev, data.id]));
      setTeamOrder(prev => prev.includes(data.id) ? prev : [...prev, data.id]);
      setNewPlayerInput('');
    } catch {
      setNewPlayers(prev => [...prev, playerName]);
      setNewPlayerInput('');
    }
  }

  function removeNewPlayer(name) {
    setNewPlayers(prev => prev.filter(n => n !== name));
  }

  function shuffleTeams() {
    setTeamOrder(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    setSwapSelect(null);
  }

  function handleTeamPlayerClick(orderIdx) {
    if (swapSelect === null) {
      setSwapSelect(orderIdx);
    } else if (swapSelect === orderIdx) {
      setSwapSelect(null);
    } else {
      setTeamOrder(prev => {
        const arr = [...prev];
        [arr[swapSelect], arr[orderIdx]] = [arr[orderIdx], arr[swapSelect]];
        return arr;
      });
      setSwapSelect(null);
    }
  }

  // Derived team pairs from teamOrder
  const playerMap = Object.fromEntries(participants.filter(p => selectedIds.has(p.id)).map(p => [p.id, p]));
  const orderedPlayers = teamOrder.map(id => playerMap[id]).filter(Boolean);
  const teamPairs = [];
  for (let i = 0; i + 1 < orderedPlayers.length; i += 2) {
    teamPairs.push([orderedPlayers[i], orderedPlayers[i + 1], i, i + 1]);
  }
  const unpaired = orderedPlayers.length % 2 !== 0 ? orderedPlayers[orderedPlayers.length - 1] : null;

  const totalPlayers = selectedIds.size + newPlayers.length;

  const isTeamAmericano = type === 'team_americano';
  const teamCount = teamPairs.length;
  const submitDisabled = loading || totalPlayers < 4 ||
    (isTeamAmericano && (teamCount < 2 || unpaired !== null || newPlayers.length > 0));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Angiv et turneringsnavn');
    if (isTeamAmericano) {
      if (newPlayers.length > 0) return toast.error('Tilføj nye spillere til spillerpuljen inden Team Americano');
      if (teamCount < 2) return toast.error('Mindst 2 hold kræves');
      if (unpaired) return toast.error('Alle spillere skal være i hold – ulige antal spillere');
    } else {
      if (totalPlayers < 4) return toast.error('Mindst 4 spillere kræves');
    }
    setLoading(true);
    try {
      const resolvedPoints = pointsPerGame === 'custom' ? parseInt(customPoints) || 16 : pointsPerGame;

      if (isTeamAmericano) {
        const teams = teamPairs.map(([p1, p2]) => ({ player1_id: p1.id, player2_id: p2.id }));
        const { data } = await axios.post(`${API}/api/tournaments`, {
          name: name.trim(),
          tournament_type: type,
          courts,
          teams,
          points_per_game: resolvedPoints,
        });
        toast.success('Turnering oprettet!');
        navigate(`/tournament/${data.id}/manage`);
      } else {
        const { data } = await axios.post(`${API}/api/tournaments`, {
          name: name.trim(),
          tournament_type: type,
          courts,
          player_ids: [...selectedIds],
          manual_players: newPlayers,
          points_per_game: resolvedPoints,
        });
        toast.success('Turnering oprettet!');
        navigate(`/tournament/${data.id}/manage`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kunne ikke oprette turnering');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-1 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Tilbage
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-6 pb-12 space-y-8">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Ny turnering</h1>

        {/* Turnerings info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Turneringsnavn</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="f.eks. Lørdag Padel" autoFocus />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Format</label>
            <div className="space-y-2">
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                  className={`w-full text-left p-3 border transition-colors ${type === t.value ? 'border-[#D1F441] bg-[#D1F441]/5' : 'border-[#1A1A1A] hover:border-[#333]'}`}>
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Antal baner</label>
            <Input type="number" min="1" max="10" value={courts} onChange={e => setCourts(+e.target.value)} className="w-24" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Point per kamp</label>
            <div className="flex gap-2 flex-wrap">
              {[16, 24, 32].map(p => (
                <button key={p} type="button"
                  onClick={() => { setPointsPerGame(p); setCustomPoints(''); }}
                  className={`px-4 py-2 text-sm font-mono border transition-colors ${pointsPerGame === p ? 'border-[#D1F441] bg-[#D1F441]/10 text-[#D1F441]' : 'border-[#1A1A1A] text-gray-400 hover:border-[#333]'}`}>
                  {p}
                </button>
              ))}
              <button type="button"
                onClick={() => setPointsPerGame('custom')}
                className={`px-4 py-2 text-sm font-mono border transition-colors ${pointsPerGame === 'custom' ? 'border-[#D1F441] bg-[#D1F441]/10 text-[#D1F441]' : 'border-[#1A1A1A] text-gray-400 hover:border-[#333]'}`}>
                Andet
              </button>
            </div>
            {pointsPerGame === 'custom' && (
              <Input
                type="number" min="1" max="999"
                value={customPoints}
                onChange={e => setCustomPoints(e.target.value)}
                placeholder="Antal point"
                className="mt-2 w-32"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Spillere */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-gray-400">Spillere</label>
            <span className={`text-xs font-medium ${totalPlayers >= 4 ? 'text-[#D1F441]' : 'text-gray-600'}`}>
              {totalPlayers} valgt {courts > 0 && `(min. ${isTeamAmericano ? courts * 2 * 2 : courts * 4})`}
            </span>
          </div>

          {/* Søgefelt */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <Input
                ref={inputRef}
                value={newPlayerInput}
                onChange={e => setNewPlayerInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                placeholder="Søg eller skriv nyt navn..."
                className="pl-8"
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); if (filteredParticipants.length === 1) selectParticipant(filteredParticipants[0]); else addNewPlayer(e); }
                }}
              />
            </div>
            <Button type="button" size="icon" className="shrink-0" onClick={addNewPlayer}>
              <Plus size={16} />
            </Button>
          </div>

          {/* Inline liste */}
          {inputFocused && participants.length > 0 && (
            <div className="mt-1 border border-[#2A2A2A] bg-[#111] overflow-y-auto h-44">
              {filteredParticipants.map(p => (
                <button key={p.id} type="button"
                  onMouseDown={e => { e.preventDefault(); selectParticipant(p); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white active:bg-[#1A1A1A] transition-colors border-b border-[#1A1A1A] last:border-0">
                  {p.name}
                </button>
              ))}
              {newPlayerInput.trim() && !participants.some(p => p.name.toLowerCase() === newPlayerInput.trim().toLowerCase()) && (
                <button type="button"
                  onMouseDown={e => { e.preventDefault(); addNewPlayer(); }}
                  className="w-full text-left px-4 py-3 text-sm text-[#D1F441] hover:bg-[#1A1A1A] active:bg-[#1A1A1A] transition-colors flex items-center gap-2 border-b border-[#1A1A1A]">
                  <Plus size={12} /> Opret "{newPlayerInput.trim()}"
                </button>
              )}
              {filteredParticipants.length === 0 && !newPlayerInput.trim() && (
                <p className="px-4 py-3 text-sm text-gray-600">Alle spillere er valgt</p>
              )}
            </div>
          )}

          {/* Valgte spillere som chips */}
          {!isTeamAmericano && (selectedIds.size > 0 || newPlayers.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {participants.filter(p => selectedIds.has(p.id)).map(p => (
                <span key={p.id} className="flex items-center gap-1 bg-[#D1F441]/10 border border-[#D1F441]/30 px-2 py-1 text-sm text-[#D1F441]">
                  {p.name}
                  <button type="button" onClick={() => deselectParticipant(p.id)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                </span>
              ))}
              {newPlayers.map((n, i) => (
                <span key={i} className="flex items-center gap-1 bg-[#D1F441]/10 border border-[#D1F441]/30 px-2 py-1 text-sm text-[#D1F441]">
                  {n}
                  <button type="button" onClick={() => removeNewPlayer(n)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Team Americano: holdopdeling */}
        {isTeamAmericano && selectedIds.size > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400">Hold</label>
              <button type="button" onClick={shuffleTeams}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors">
                <Shuffle size={12} /> Bland hold
              </button>
            </div>

            {swapSelect !== null && (
              <p className="text-xs text-[#D1F441] mb-2">Klik en anden spiller for at bytte plads</p>
            )}

            <div className="space-y-2">
              {teamPairs.map(([p1, p2, idx1, idx2], teamIdx) => (
                <div key={teamIdx} className="flex items-center gap-2 bg-[#111] border border-[#1A1A1A] px-3 py-2">
                  <span className="text-xs font-mono text-gray-600 w-5 shrink-0">{teamIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleTeamPlayerClick(idx1)}
                    className={`text-sm px-2 py-0.5 border transition-colors ${swapSelect === idx1 ? 'border-[#D1F441] bg-[#D1F441]/10 text-[#D1F441]' : 'border-transparent text-gray-300 hover:text-white'}`}
                  >
                    {p1.name}
                  </button>
                  <span className="text-gray-600 text-xs">&</span>
                  <button
                    type="button"
                    onClick={() => handleTeamPlayerClick(idx2)}
                    className={`text-sm px-2 py-0.5 border transition-colors ${swapSelect === idx2 ? 'border-[#D1F441] bg-[#D1F441]/10 text-[#D1F441]' : 'border-transparent text-gray-300 hover:text-white'}`}
                  >
                    {p2.name}
                  </button>
                  <button type="button" onClick={() => { deselectParticipant(p1.id); deselectParticipant(p2.id); }}
                    className="ml-auto text-gray-600 hover:text-white opacity-50 hover:opacity-100 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {unpaired && (
                <div className="flex items-center gap-2 bg-[#111] border border-yellow-600/30 px-3 py-2">
                  <span className="text-xs text-yellow-500 mr-1">⚠</span>
                  <span className="text-sm text-gray-400">{unpaired.name} — mangler makker</span>
                  <button type="button" onClick={() => deselectParticipant(unpaired.id)}
                    className="ml-auto text-gray-600 hover:text-white opacity-50 hover:opacity-100 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {newPlayers.length > 0 && (
              <p className="text-xs text-yellow-500 mt-2">
                Nye spillere ({newPlayers.join(', ')}) kan ikke bruges i Team Americano — tilføj dem til spillerpuljen først.
              </p>
            )}

            {teamCount < 2 && selectedIds.size >= 4 && !unpaired && (
              <p className="text-xs text-gray-600 mt-2">Tilføj mindst 4 spillere for at danne 2 hold</p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitDisabled}>
          {loading ? 'Opretter...' : 'Opret turnering & generer kampe'}
        </Button>
      </form>
    </div>
  );
}

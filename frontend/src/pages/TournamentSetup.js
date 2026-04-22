import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, X, Check, MagnifyingGlass } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const TYPES = [
  { value: 'americano', label: 'Americano', desc: 'Alle kampe genereres på forhånd' },
  { value: 'mexicano', label: 'Mexicano', desc: 'Næste runde baseres på stilling' },
  { value: 'winners_court', label: 'Winners Court', desc: 'Vindere avancerer til bedste bane' },
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef();
  const dropdownRef = useRef();

  useEffect(() => {
    axios.get(`${API}/api/participants`).then(r => setParticipants(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = newPlayerInput.trim().length > 0
    ? participants.filter(p =>
        p.name.toLowerCase().includes(newPlayerInput.toLowerCase()) &&
        !selectedIds.has(p.id)
      )
    : [];

  function selectParticipant(p) {
    setSelectedIds(prev => new Set([...prev, p.id]));
    setNewPlayerInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function deselectParticipant(id) {
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
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
      setNewPlayerInput('');
      setShowSuggestions(false);
    } catch {
      setNewPlayers(prev => [...prev, playerName]);
      setNewPlayerInput('');
      setShowSuggestions(false);
    }
  }

  function removeNewPlayer(name) {
    setNewPlayers(prev => prev.filter(n => n !== name));
  }

  const totalPlayers = selectedIds.size + newPlayers.length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Angiv et turneringsnavn');
    if (totalPlayers < 4) return toast.error('Mindst 4 spillere kræves');
    setLoading(true);
    try {
      const resolvedPoints = pointsPerGame === 'custom' ? parseInt(customPoints) || 16 : pointsPerGame;
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
                <button key={t.value} type="button" onClick={() => setType(t.value)}
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
              {totalPlayers} valgt {courts > 0 && `(min. ${courts * 4})`}
            </span>
          </div>

          {/* Autocomplete input */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <Input
                  ref={inputRef}
                  value={newPlayerInput}
                  onChange={e => { setNewPlayerInput(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Søg eller skriv nyt navn..."
                  className="pl-8"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); if (suggestions.length === 1) selectParticipant(suggestions[0]); else addNewPlayer(e); }
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                />
              </div>
              <Button type="button" size="icon" className="shrink-0" onClick={addNewPlayer}>
                <Plus size={16} />
              </Button>
            </div>

            {/* Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div ref={dropdownRef} className="absolute z-10 left-0 right-10 mt-1 bg-[#111] border border-[#2A2A2A] shadow-xl">
                {suggestions.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={e => { e.preventDefault(); selectParticipant(p); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors flex items-center gap-2">
                    <Check size={12} className="text-[#D1F441] opacity-0" />
                    {p.name}
                  </button>
                ))}
                {newPlayerInput.trim() && !participants.some(p => p.name.toLowerCase() === newPlayerInput.trim().toLowerCase()) && (
                  <button type="button"
                    onMouseDown={e => { e.preventDefault(); addNewPlayer(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-[#1A1A1A] transition-colors border-t border-[#1A1A1A] flex items-center gap-2">
                    <Plus size={12} className="text-[#D1F441]" />
                    Opret "{newPlayerInput.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Valgte spillere som chips — under inputtet så siden ikke hopper */}
          {(selectedIds.size > 0 || newPlayers.length > 0) && (
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

        <Button type="submit" className="w-full" disabled={loading || totalPlayers < 4}>
          {loading ? 'Opretter...' : 'Opret turnering & generer kampe'}
        </Button>
      </form>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash, PencilSimple, Check, X, UploadSimple, Warning } from '@phosphor-icons/react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function Participants() {
  const [participants, setParticipants] = useState([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRating, setEditRating] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const fileRef = useRef();

  useEffect(() => {
    axios.get(`${API}/api/participants`).then(r => setParticipants(r.data)).catch(() => {});
  }, []);

  async function addParticipant(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { data } = await axios.post(`${API}/api/participants`, { name: newName.trim() }, { headers });
      setParticipants(prev => [...prev, data]);
      setNewName('');
    } catch {
      toast.error('Kunne ikke tilføje spiller');
    }
  }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    const rating = parseInt(editRating);
    try {
      const { data } = await axios.put(`${API}/api/participants/${id}`, {
        name: editName.trim(),
        ...(editRating !== '' && !isNaN(rating) ? { rating } : {}),
      }, { headers });
      setParticipants(prev => prev.map(p => p.id === id ? data : p));
      setEditing(null);
    } catch {
      toast.error('Kunne ikke opdatere');
    }
  }

  async function deleteParticipant(id) {
    try {
      await axios.delete(`${API}/api/participants/${id}`, { headers });
      setParticipants(prev => prev.filter(p => p.id !== id));
    } catch {
      toast.error('Kunne ikke slette');
    }
  }

  async function deleteAll() {
    try {
      await axios.delete(`${API}/api/participants`, { headers });
      setParticipants([]);
      setConfirmDeleteAll(false);
      toast.success('Alle spillere slettet');
    } catch {
      toast.error('Kunne ikke slette spillere');
    }
  }

  async function uploadCsv(e) {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post(`${API}/api/participants/upload-csv`, form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message);
      const { data: updated } = await axios.get(`${API}/api/participants`);
      setParticipants(updated);
    } catch {
      toast.error('Kunne ikke importere CSV');
    }
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between">
        <Link to="/admin/panel" className="flex items-center gap-1 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Panel
        </Link>
        <span className="font-display text-lg font-bold uppercase tracking-wide">Spillerpulje</span>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-400">{participants.length} spillere</p>
          <div className="flex gap-2">
            <input type="file" accept=".csv" ref={fileRef} onChange={uploadCsv} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current.click()}>
              <UploadSimple size={13} /> Import CSV
            </Button>
            {participants.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(true)}
                className="border-red-900 text-red-400 hover:bg-red-900/20 hover:text-red-300">
                <Trash size={13} /> Slet alle
              </Button>
            )}
          </div>
        </div>

        {confirmDeleteAll && (
          <div className="mb-6 p-4 border border-red-900 bg-red-950/30 flex items-start gap-3">
            <Warning size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-medium mb-1">Slet alle {participants.length} spillere?</p>
              <p className="text-xs text-gray-500 mb-3">Dette kan ikke fortrydes.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={deleteAll} className="bg-red-600 hover:bg-red-700 text-white">Ja, slet alle</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAll(false)}>Annuller</Button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={addParticipant} className="flex gap-2 mb-6">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Spillernavn" autoFocus />
          <Button type="submit" size="icon" className="shrink-0"><Plus size={16} /></Button>
        </form>

        <div className="space-y-1">
          {participants.map(p => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#1A1A1A]">
              {editing === p.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditing(null); }}
                  />
                  <Input
                    type="number"
                    value={editRating}
                    onChange={e => setEditRating(e.target.value)}
                    className="h-7 text-sm w-20 font-mono text-center"
                    placeholder="Rating"
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditing(null); }}
                  />
                  <button onClick={() => saveEdit(p.id)} className="text-[#D1F441] hover:opacity-70"><Check size={14} /></button>
                  <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{p.name}</span>
                  {p.note && <span className="text-xs text-gray-500">{p.note}</span>}
                  <span className="text-xs font-mono text-gray-500">{p.rating ?? 1000}</span>
                  <button onClick={() => { setEditing(p.id); setEditName(p.name); setEditRating(String(p.rating ?? 1000)); }} className="text-gray-600 hover:text-white transition-colors">
                    <PencilSimple size={13} />
                  </button>
                  <button onClick={() => deleteParticipant(p.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {participants.length === 0 && (
          <p className="text-center text-gray-600 py-8">Ingen spillere endnu</p>
        )}

        <p className="text-xs text-gray-600 mt-6">
          CSV-format: navn/name kolonne krævet, point/points og note/bemærkning er valgfrie.
        </p>
      </main>
    </div>
  );
}

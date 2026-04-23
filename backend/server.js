/**
 * Padel Tournament API
 * Node.js/Express + MySQL Backend
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { pool, initDatabase } = require('./db');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'skift-denne-hemmelighed';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// mysql2 auto-parser JSON-kolonner — dette sikrer vi ikke dobbeltp-parser
const parseJSON = v => typeof v === 'string' ? JSON.parse(v) : v;

// ==================== AUTH HELPERS ====================

function createToken(data) {
  return jwt.sign(data, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Ikke autoriseret' });
  }
  try {
    const payload = verifyToken(authHeader.slice(7));
    if (payload.role !== 'admin') {
      return res.status(403).json({ detail: 'Adgang nægtet' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Ugyldigt token' });
  }
}

// ==================== AUTH ENDPOINTS ====================

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = createToken({ role: 'admin' });
    return res.json({ token, message: 'Login succesfuldt' });
  }
  return res.status(401).json({ detail: 'Forkert adgangskode' });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ valid: true });
});

// ==================== PARTICIPANTS ENDPOINTS ====================

app.get('/api/participants', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM participants ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ detail: 'Database fejl' });
  }
});

app.post('/api/participants', async (req, res) => {
  const { name, points = 0, note = '' } = req.body;
  const id = uuidv4();
  try {
    await pool.execute(
      'INSERT INTO participants (id, name, points, note) VALUES (?, ?, ?, ?)',
      [id, name, points, note]
    );
    const [rows] = await pool.execute('SELECT * FROM participants WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating participant:', err);
    res.status(500).json({ detail: 'Kunne ikke tilføje deltager' });
  }
});

app.put('/api/participants/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, points, note } = req.body;
  try {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (points !== undefined) { updates.push('points = ?'); values.push(points); }
    if (note !== undefined) { updates.push('note = ?'); values.push(note); }

    if (updates.length === 0) {
      return res.status(400).json({ detail: 'Ingen data at opdatere' });
    }

    values.push(id);
    await pool.execute(`UPDATE participants SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM participants WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ detail: 'Deltager ikke fundet' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating participant:', err);
    res.status(500).json({ detail: 'Kunne ikke opdatere deltager' });
  }
});

app.delete('/api/participants', requireAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM participants');
    res.json({ message: 'Alle spillere slettet' });
  } catch (err) {
    console.error('Error deleting all participants:', err);
    res.status(500).json({ detail: 'Kunne ikke slette spillere' });
  }
});

app.delete('/api/participants/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM participants WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ detail: 'Deltager ikke fundet' });
    res.json({ message: 'Deltager slettet' });
  } catch (err) {
    console.error('Error deleting participant:', err);
    res.status(500).json({ detail: 'Kunne ikke slette deltager' });
  }
});

app.post('/api/participants/upload-csv', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: 'Ingen fil uploadet' });

  try {
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return res.status(400).json({ detail: 'CSV filen er tom' });

    const header = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim());
    const nameIdx = header.findIndex(h => ['name', 'navn'].includes(h));
    const pointsIdx = header.findIndex(h => ['points', 'point'].includes(h));
    const noteIdx = header.findIndex(h => ['note', 'bemærkning'].includes(h));

    if (nameIdx === -1) return res.status(400).json({ detail: 'CSV mangler navn/name kolonne' });

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;]/).map(c => c.trim());
      const name = cols[nameIdx];
      if (!name) continue;
      const points = pointsIdx !== -1 ? parseInt(cols[pointsIdx]) || 0 : 0;
      const note = noteIdx !== -1 ? cols[noteIdx] || '' : '';
      const id = uuidv4();
      await pool.execute(
        'INSERT INTO participants (id, name, points, note) VALUES (?, ?, ?, ?)',
        [id, name, points, note]
      );
      imported++;
    }
    res.json({ message: `${imported} deltagere importeret` });
  } catch (err) {
    console.error('Error importing CSV:', err);
    res.status(500).json({ detail: 'Kunne ikke importere CSV' });
  }
});

// ==================== TOURNAMENT LOGIC ====================

function generateMatches(players, courts, tournamentType) {
  if (tournamentType === 'americano') {
    return generateAmericanoMatches(players, courts);
  }

  // Mexicano / Winners Court: generer kun første runde tilfældigt
  // (næste runder genereres dynamisk via generateNextRound)
  const matches = [];
  const n = players.length;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const used = new Set();

  for (let court = 1; court <= courts; court++) {
    const available = shuffled.filter(p => !used.has(p.id));
    if (available.length < 4) break;
    const selected = available.slice(0, 4);
    selected.forEach(p => used.add(p.id));

    matches.push({
      id: uuidv4(),
      round: 1,
      court,
      team1: [selected[0], selected[1]],
      team2: [selected[2], selected[3]],
      team1_score: null,
      team2_score: null,
      completed: false
    });
  }
  return matches;
}

// Americano: circle method — sikrer at alle møder alle
// Med n spillere genereres n-1 runder, og hver spiller
// partner med samtlige andre nøjagtigt én gang.
function generateAmericanoMatches(players, courts) {
  const n = players.length;
  const effectiveCourts = Math.min(courts, Math.floor(n / 4));
  const totalRounds = n - 1;
  const matches = [];

  // Bland spillerne for tilfældig fordeling
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  // Fix første spiller, roter resten (circle method)
  const rest = shuffled.slice(1);

  for (let round = 1; round <= totalRounds; round++) {
    const circle = [shuffled[0], ...rest];

    // Par circle[i] med circle[n-1-i] → alle par er unikke per runde
    const pairs = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      pairs.push([circle[i], circle[n - 1 - i]]);
    }

    // Hvert bane bruger 2 par: pairs[2c] vs pairs[2c+1]
    for (let c = 0; c < effectiveCourts; c++) {
      const t1 = pairs[c * 2];
      const t2 = pairs[c * 2 + 1];
      if (t1 && t2) {
        matches.push({
          id: uuidv4(),
          round,
          court: c + 1,
          team1: t1,
          team2: t2,
          team1_score: null,
          team2_score: null,
          completed: false
        });
      }
    }

    // Roter: flyt sidste element i rest til forsiden
    rest.unshift(rest.pop());
  }

  return matches;
}

function calculateScoreboard(players, matches) {
  const standings = {};
  players.forEach(p => {
    standings[p.id] = { id: p.id, name: p.name, points: 0, played: 0, won: 0, diff: 0 };
  });

  matches.filter(m => m.completed).forEach(match => {
    const t1Score = match.team1_score || 0;
    const t2Score = match.team2_score || 0;
    match.team1.forEach(p => {
      if (standings[p.id]) {
        standings[p.id].points += t1Score;
        standings[p.id].played += 1;
        standings[p.id].diff += (t1Score - t2Score);
        if (t1Score > t2Score) standings[p.id].won += 1;
      }
    });
    match.team2.forEach(p => {
      if (standings[p.id]) {
        standings[p.id].points += t2Score;
        standings[p.id].played += 1;
        standings[p.id].diff += (t2Score - t1Score);
        if (t2Score > t1Score) standings[p.id].won += 1;
      }
    });
  });

  const sorted = Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.diff - a.diff;
  });
  sorted.forEach((player, i) => { player.rank = i + 1; });
  return sorted;
}

function generateNextRound(players, matches, courts, tournamentType) {
  const currentRound = Math.max(...matches.map(m => m.round), 0);
  const standings = calculateScoreboard(players, matches);
  const newMatches = [];
  const used = new Set();

  for (let court = 1; court <= courts; court++) {
    const available = standings.filter(s => !used.has(s.id));
    if (available.length < 4) break;

    let selected;

    if (tournamentType === 'winners_court' && court === 1) {
      const lastRoundMatches = matches.filter(m => m.round === currentRound && m.completed);
      const winners = [];
      lastRoundMatches.forEach(m => {
        if ((m.team1_score || 0) > (m.team2_score || 0)) {
          winners.push(...m.team1);
        } else {
          winners.push(...m.team2);
        }
      });
      selected = winners.filter(w => !used.has(w.id)).slice(0, 4);
    }

    if (!selected || selected.length < 4) {
      selected = available.slice(0, 4);
    }

    if (selected.length === 4) {
      selected.forEach(s => used.add(s.id));
      const playerObjs = selected.map(s => players.find(p => p.id === s.id) || s);
      newMatches.push({
        id: uuidv4(),
        round: currentRound + 1,
        court,
        team1: [playerObjs[0], playerObjs[1]],
        team2: [playerObjs[2], playerObjs[3]],
        team1_score: null,
        team2_score: null,
        completed: false
      });
    }
  }
  return newMatches;
}

// ==================== TOURNAMENT ENDPOINTS ====================

app.post('/api/tournaments', async (req, res) => {
  const { name, tournament_type, courts, player_ids = [], manual_players = [], points_per_game = 16 } = req.body;
  try {
    const players = [];
    if (player_ids.length > 0) {
      const placeholders = player_ids.map(() => '?').join(',');
      const [rows] = await pool.execute(
        `SELECT id, name FROM participants WHERE id IN (${placeholders})`,
        player_ids
      );
      players.push(...rows);
    }
    manual_players.forEach(playerName => {
      players.push({ id: uuidv4(), name: playerName });
    });

    if (players.length < 4) return res.status(400).json({ detail: 'Mindst 4 spillere påkrævet' });

    const matches = generateMatches(players, courts, tournament_type);
    const tournamentId = uuidv4();

    await pool.execute(
      'INSERT INTO tournaments (id, name, tournament_type, courts, players, points_per_game) VALUES (?, ?, ?, ?, ?, ?)',
      [tournamentId, name, tournament_type, courts, JSON.stringify(players), points_per_game]
    );

    for (const match of matches) {
      await pool.execute(
        'INSERT INTO matches (id, tournament_id, round, court, team1, team2, team1_score, team2_score, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [match.id, tournamentId, match.round, match.court, JSON.stringify(match.team1), JSON.stringify(match.team2), null, null, false]
      );
    }

    res.json({ id: tournamentId, message: 'Turnering oprettet' });
  } catch (err) {
    console.error('Error creating tournament:', err);
    res.status(500).json({ detail: 'Kunne ikke oprette turnering' });
  }
});

app.get('/api/tournaments', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, tournament_type, status, created_at FROM tournaments ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ detail: 'Database fejl' });
  }
});

app.get('/api/tournaments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [tournaments] = await pool.execute('SELECT * FROM tournaments WHERE id = ?', [id]);
    if (tournaments.length === 0) return res.status(404).json({ detail: 'Turnering ikke fundet' });

    const tournament = tournaments[0];
    tournament.players = parseJSON(tournament.players);

    const [matches] = await pool.execute(
      'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, court', [id]
    );
    const parsedMatches = matches.map(m => ({
      ...m,
      team1: parseJSON(m.team1),
      team2: parseJSON(m.team2),
      completed: Boolean(m.completed)
    }));

    // Berig spillere med aktuel rating
    const allPlayerIds = [...new Set(parsedMatches.flatMap(m => [...m.team1, ...m.team2].map(p => p.id)))];
    let ratingMap = {};
    if (allPlayerIds.length > 0) {
      const placeholders = allPlayerIds.map(() => '?').join(',');
      const [ratingRows] = await pool.execute(
        `SELECT id, rating FROM participants WHERE id IN (${placeholders})`, allPlayerIds
      );
      ratingRows.forEach(r => { ratingMap[r.id] = r.rating ?? 1000; });
    }
    tournament.matches = parsedMatches.map(m => ({
      ...m,
      team1: m.team1.map(p => ({ ...p, rating: ratingMap[p.id] ?? 1000 })),
      team2: m.team2.map(p => ({ ...p, rating: ratingMap[p.id] ?? 1000 })),
    }));

    res.json(tournament);
  } catch (err) {
    res.status(500).json({ detail: 'Database fejl' });
  }
});

app.patch('/api/tournaments/:id/complete', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      "UPDATE tournaments SET status = 'completed' WHERE id = ? AND status = 'active'",
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ detail: 'Turnering ikke fundet eller allerede afsluttet' });
    res.json({ message: 'Turnering afsluttet' });
  } catch (err) {
    res.status(500).json({ detail: 'Database fejl' });
  }
});

app.get('/api/tournaments/:id/scoreboard', async (req, res) => {
  const { id } = req.params;
  try {
    const [tournaments] = await pool.execute('SELECT * FROM tournaments WHERE id = ?', [id]);
    if (tournaments.length === 0) return res.status(404).json({ detail: 'Turnering ikke fundet' });

    const tournament = tournaments[0];
    const players = parseJSON(tournament.players);
    const [matches] = await pool.execute('SELECT * FROM matches WHERE tournament_id = ?', [id]);
    const parsedMatches = matches.map(m => ({
      ...m,
      team1: parseJSON(m.team1),
      team2: parseJSON(m.team2),
      completed: Boolean(m.completed)
    }));

    const standings = calculateScoreboard(players, parsedMatches);
    res.json({ tournament_name: tournament.name, tournament_type: tournament.tournament_type, standings });
  } catch (err) {
    res.status(500).json({ detail: 'Database fejl' });
  }
});

async function applyEloUpdate(team1Players, team2Players, team1_score, team2_score) {
  const K = 32;
  const allIds = [...team1Players, ...team2Players].map(p => p.id);
  const placeholders = allIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, rating FROM participants WHERE id IN (${placeholders})`, allIds
  );
  const ratingMap = {};
  rows.forEach(r => { ratingMap[r.id] = r.rating ?? 1000; });

  const avg = players => players.reduce((s, p) => s + (ratingMap[p.id] ?? 1000), 0) / players.length;
  const avg1 = avg(team1Players);
  const avg2 = avg(team2Players);

  const expected1 = 1 / (1 + Math.pow(10, (avg2 - avg1) / 400));
  const total = team1_score + team2_score;
  const actual1 = total > 0 ? team1_score / total : 0.5;

  const delta1 = Math.round(K * (actual1 - expected1));
  const delta2 = -delta1;

  for (const p of team1Players) {
    await pool.execute('UPDATE participants SET rating = rating + ? WHERE id = ?', [delta1, p.id]);
  }
  for (const p of team2Players) {
    await pool.execute('UPDATE participants SET rating = rating + ? WHERE id = ?', [delta2, p.id]);
  }
}

app.put('/api/tournaments/:tournamentId/matches/:matchId/result', async (req, res) => {
  const { tournamentId, matchId } = req.params;
  const { team1_score, team2_score } = req.body;
  try {
    // Check if match was already completed before updating
    const [existing] = await pool.execute('SELECT completed, team1, team2 FROM matches WHERE id = ?', [matchId]);
    const wasCompleted = existing[0] ? Boolean(existing[0].completed) : false;

    await pool.execute(
      'UPDATE matches SET team1_score = ?, team2_score = ?, completed = TRUE WHERE id = ? AND tournament_id = ?',
      [team1_score, team2_score, matchId, tournamentId]
    );

    // Only update ELO on first completion, not on edits
    if (!wasCompleted && existing[0]) {
      const team1 = parseJSON(existing[0].team1);
      const team2 = parseJSON(existing[0].team2);
      await applyEloUpdate(team1, team2, team1_score, team2_score);
    }

    const [tournaments] = await pool.execute('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    if (tournaments.length === 0) return res.status(404).json({ detail: 'Turnering ikke fundet' });

    const tournament = tournaments[0];
    const players = parseJSON(tournament.players);
    const [allMatches] = await pool.execute('SELECT * FROM matches WHERE tournament_id = ?', [tournamentId]);
    const parsedMatches = allMatches.map(m => ({
      ...m,
      team1: parseJSON(m.team1),
      team2: parseJSON(m.team2),
      completed: Boolean(m.completed)
    }));

    const currentRound = Math.max(...parsedMatches.map(m => m.round));
    const roundMatches = parsedMatches.filter(m => m.round === currentRound);
    const allCompleted = roundMatches.every(m => m.completed);

    if (allCompleted && ['mexicano', 'winners_court'].includes(tournament.tournament_type)) {
      const newMatches = generateNextRound(players, parsedMatches, tournament.courts, tournament.tournament_type);
      for (const match of newMatches) {
        await pool.execute(
          'INSERT INTO matches (id, tournament_id, round, court, team1, team2, team1_score, team2_score, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [match.id, tournamentId, match.round, match.court, JSON.stringify(match.team1), JSON.stringify(match.team2), null, null, false]
        );
      }
    }

    res.json({ message: 'Resultat gemt' });
  } catch (err) {
    console.error('Error updating match:', err);
    res.status(500).json({ detail: 'Kunne ikke gemme resultat' });
  }
});

app.delete('/api/tournaments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM tournaments WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ detail: 'Turnering ikke fundet' });
    res.json({ message: 'Turnering slettet' });
  } catch (err) {
    res.status(500).json({ detail: 'Kunne ikke slette turnering' });
  }
});

app.get('/api/', (req, res) => res.json({ message: 'Padel Turnerings API' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ==================== START SERVER ====================

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('═══════════════════════════════════════════');
      console.log('  PADEL TURNERINGS API');
      console.log('═══════════════════════════════════════════');
      console.log(`  Server: http://localhost:${PORT}`);
      console.log(`  Database: MySQL`);
      console.log(`  Admin password: ${ADMIN_PASSWORD}`);
      console.log('═══════════════════════════════════════════');
    });
  } catch (err) {
    console.error('Kunne ikke starte server:', err.message);
    process.exit(1);
  }
}

startServer();

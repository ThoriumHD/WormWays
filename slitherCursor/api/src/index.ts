import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { z } from 'zod';
import crypto from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL DEFAULT 1000
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  userId TEXT,
  result TEXT,
  score INTEGER,
  createdAt INTEGER
);
`);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/register', (req, res) => {
  const body = z.object({ username: z.string().min(3).max(16) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid' });
  const id = crypto.randomUUID();
  try {
    db.prepare('INSERT INTO users (id, username, credits) VALUES (?, ?, ?)').run(id, body.data.username, 1000);
    res.json({ id, username: body.data.username, credits: 1000 });
  } catch (e) {
    res.status(400).json({ error: 'username_taken' });
  }
});

app.get('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json(u);
});

app.post('/matches', (req, res) => {
  const body = z
    .object({ userId: z.string(), result: z.enum(['win', 'loss']), score: z.number().int().nonnegative() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO matches (id, userId, result, score, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(id, body.data.userId, body.data.result, body.data.score, Date.now());
  res.json({ id });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => console.log(`[api] listening on ${port}`));



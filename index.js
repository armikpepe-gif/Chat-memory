// Express + Postgres memory service
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan('tiny'));

// --- Database ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    create table if not exists users (
      id text primary key,
      created_at timestamptz default now()
    );
    create table if not exists memories (
      id uuid primary key,
      user_id text not null references users(id) on delete cascade,
      "key" text,
      "value" text not null,
      tags text[] default '{}',
      importance int default 1,     -- 1..5 (برای اولویت بازیابی)
      updated_at timestamptz default now()
    );
    create index if not exists idx_mem_user on memories(user_id);
    create index if not exists idx_mem_updated on memories(updated_at desc);
  `);
  console.log('DB ready ✅');
}
initDB().catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});

// Helpers
async function ensureUser(userId) {
  await pool.query('insert into users(id) values($1) on conflict do nothing', [userId]);
}
async function addMemory({ userId, key, value, tags = [], importance = 1 }) {
  await ensureUser(userId);
  const id = uuidv4();
  await pool.query(
    `insert into memories(id, user_id, "key", "value", tags, importance, updated_at)
     values ($1,$2,$3,$4,$5,$6, now())`,
    [id, userId, key || null, value, tags, importance]
  );
  return id;
}
async function listMemories(userId) {
  const { rows } = await pool.query(
    'select id, "key", "value", tags, importance, updated_at from memories where user_id=$1 order by updated_at desc limit 200',
    [userId]
  );
  return rows;
}
async function deleteMemory(userId, id) {
  await pool.query('delete from memories where id=$1 and user_id=$2', [id, userId]);
}
async function clearMemories(userId) {
  await pool.query('delete from memories where user_id=$1', [userId]);
}

// --- Routes ---
app.get('/', (_req, res) => {
  res.type('text/plain').send('Chat-memory is live! • /memory/:userId, /message');
});
app.get('/healthz', async (_req, res) => {
  try { await pool.query('select 1'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// CRUD حافظه
app.get('/memory/:userId', async (req, res) => {
  try { res.json(await listMemories(req.params.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/memory/:userId', async (req, res) => {
  try {
    const { key, value, tags, importance } = req.body || {};
    if (!value) return res.status(400).json({ error: 'value is required' });
    const id = await addMemory({ userId: req.params.userId, key, value, tags, importance });
    res.status(201).json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/memory/:userId/:id', async (req, res) => {
  try { await deleteMemory(req.params.userId, req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/memory/:userId', async (req, res) => {
  try { await clearMemories(req.params.userId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Endpoint هوشمند ساده برای تشخیص “یاد بگیر”
const rememberPatterns = [
  /(?:یاد بگیر|به خاطر بسپار|یادت باشه)\s+(.*)/i,
  /remember that\s+(.*)/i
];

app.post('/message', async (req, res) => {
  try {
    const { userId, text } = req.body || {};
    if (!userId || !text) return res.status(400).json({ error: 'userId and text are required' });

    // NER خیلی ساده برای استخراج “حافظه”
    let stored = null;
    for (const p of rememberPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const value = m[1].trim();
        const id = await addMemory({
          userId,
          key: 'note',
          value,
          tags: ['user-note'],
          importance: 3
        });
        stored = { id, value };
        break;
      }
    }

    // پاسخ نمونه (می‌تونی بعداً بجاش مدل قرار بدی)
    const memories = await listMemories(userId);
    const reply = stored
      ? `باشه! اینو یاد گرفتم: «${stored.value}» ✅`
      : `گرفتم! (${memories.length} مورد در حافظه‌ات دارم). برای ذخیره بگو: «یاد بگیر که ...»`;

    res.json({ reply, memories_count: memories.length, stored });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on :${port}`));

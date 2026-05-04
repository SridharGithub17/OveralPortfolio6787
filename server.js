const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'portfolio.db');
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';
const DEV_PORT = process.env.DEV_PORT || '5173';

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (CLIENT_ORIGIN && origin === CLIENT_ORIGIN) return true;

  try {
    const parsed = new URL(origin);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isPrivateNetworkHost = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(parsed.hostname);
    return parsed.protocol.startsWith('http') && parsed.port === DEV_PORT && (isLocalHost || isPrivateNetworkHost);
  } catch {
    return false;
  }
};

const DEFAULT_SETTINGS = {
  marketRate30: 0.0668,
  marketRate15: 0.0595,
  refiCostPct: 0.025,
  targetCap: 0.085,
  targetCoC: 0.1,
  minEquityPct: 0.2,
  refiThreshold: 150,
  vacancyPct: 0.08,
  mgmtPct: 0.08,
  netWorthTargets: { realEstate: 0.4, equities: 0.3, cash: 0.1, retirement: 0.15, metals: 0.05 },
};

const DEFAULT_FINANCES = { savings: [], investments: [], retirement: [], metals: [] };

const DEFAULT_DATA = {
  mode: 'plain',
  vault: null,
  props: [],
  maint: [],
  exp: [],
  ohio: [],
  finances: DEFAULT_FINANCES,
  settings: DEFAULT_SETTINGS,
};

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const mergeSettings = (incoming = {}) => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  netWorthTargets: {
    ...DEFAULT_SETTINGS.netWorthTargets,
    ...(incoming.netWorthTargets || {}),
  },
});

const normalizeState = (incoming = {}) => ({
  mode: incoming.mode === 'encrypted' ? 'encrypted' : 'plain',
  vault: incoming.vault || null,
  props: Array.isArray(incoming.props) ? incoming.props : [],
  maint: Array.isArray(incoming.maint) ? incoming.maint : [],
  exp: Array.isArray(incoming.exp) ? incoming.exp : [],
  ohio: Array.isArray(incoming.ohio) ? incoming.ohio : [],
  finances: {
    ...DEFAULT_FINANCES,
    ...(incoming.finances || {}),
  },
  settings: mergeSettings(incoming.settings),
});

const getState = () => {
  const row = db.prepare('SELECT data FROM app_state WHERE id = 1').get();
  if (!row) {
    const initial = normalizeState(DEFAULT_DATA);
    db.prepare('INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?)').run(JSON.stringify(initial), new Date().toISOString());
    return initial;
  }

  try {
    return normalizeState(JSON.parse(row.data));
  } catch {
    return normalizeState(DEFAULT_DATA);
  }
};

const saveState = (state) => {
  const normalized = normalizeState(state);
  db.prepare(
    `INSERT INTO app_state (id, data, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(JSON.stringify(normalized), new Date().toISOString());
  return normalized;
};

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      res.status(403).end();
      return;
    }
    res.status(204).end();
    return;
  }

  if (!isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  next();
});

app.get('/api/state', (_req, res) => {
  res.json(getState());
});

app.put('/api/state', (req, res) => {
  res.json(saveState(req.body || {}));
});

app.post('/api/reset', (_req, res) => {
  res.json(saveState(DEFAULT_DATA));
});

app.listen(PORT, HOST, () => {
  console.log(`SQLite backend listening on http://${HOST}:${PORT}`);
  console.log(`CORS allowed origin override: ${CLIENT_ORIGIN || 'auto-detect localhost/private-network clients on dev port'}`);
});

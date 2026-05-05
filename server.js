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

const DEFAULT_ENRICHMENT = {
  marketValue: null,
  propertyTax: null,
  schoolDistrict: '',
  lastUpdated: '',
  sources: {},
  error: '',
};

const buildPropertyQuery = (property = {}) => {
  const parts = [property.address, property.city, property.state]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(', ');
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OveralPortfolio6787/1.0',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
};

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OveralPortfolio6787/1.0',
      Accept: 'text/html,application/xhtml+xml',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toCurrencyNumber = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const compactWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const extractJsonScript = (html = '', marker) => {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<script[^>]*>\\s*({[\\s\\S]*?${escapedMarker}[\\s\\S]*?})\\s*<\\/script>`, 'i'));
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
};

const findFirstValue = (input, predicate) => {
  if (input === null || input === undefined) return null;
  if (predicate(input)) return input;
  if (Array.isArray(input)) {
    for (const item of input) {
      const match = findFirstValue(item, predicate);
      if (match !== null && match !== undefined) return match;
    }
    return null;
  }
  if (typeof input === 'object') {
    for (const value of Object.values(input)) {
      const match = findFirstValue(value, predicate);
      if (match !== null && match !== undefined) return match;
    }
  }
  return null;
};

const fetchHomeSearchHtml = async (domain, query) => {
  try {
    return await fetchText(`https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`, {
      headers: {
        Referer: 'https://www.google.com/',
      },
    });
  } catch {
    return '';
  }
};

const extractDomainListing = (html = '', domain) => {
  const regex = new RegExp(`https?:\\/\\/${domain.replace(/\./g, '\\.')}\\/[^"'\\s<>]+`, 'ig');
  const match = html.match(regex);
  return match?.[0] || '';
};

const tryFetchMarketValueFromHomes = async (query) => {
  const searchHtml = await fetchHomeSearchHtml('www.homes.com', query);
  const listingUrl = extractDomainListing(searchHtml, 'www.homes.com');
  if (!listingUrl) return null;

  const html = await fetchText(listingUrl, {
    headers: {
      Referer: 'https://www.google.com/',
    },
  });

  const directMatch = html.match(/\$\s?([0-9][0-9,]{4,})/);
  const amount = toCurrencyNumber(directMatch?.[0]);
  if (!amount) return null;

  return {
    value: amount,
    source: 'Homes.com listing/search result',
  };
};

const tryFetchSchoolDistrictFromSearch = async (query) => {
  const searchHtml = await fetchText(`https://www.google.com/search?q=${encodeURIComponent(`${query} school district`)}`, {
    headers: {
      Referer: 'https://www.google.com/',
    },
  });

  const districtMatch = searchHtml.match(/([A-Z][A-Za-z\s.&-]+School District)/i);
  if (!districtMatch?.[1]) return null;

  return {
    value: compactWhitespace(districtMatch[1]),
    source: 'Google search snippet',
  };
};

const tryFetchTaxFromSearch = async (query) => {
  const searchHtml = await fetchText(`https://www.google.com/search?q=${encodeURIComponent(`${query} property tax`)}`, {
    headers: {
      Referer: 'https://www.google.com/',
    },
  });

  const taxMatch = searchHtml.match(/(?:property tax|taxes)[^$]{0,80}(\$\s?[0-9][0-9,]{2,})/i);
  const amount = toCurrencyNumber(taxMatch?.[1]);
  if (!amount) return null;

  return {
    value: amount,
    source: 'Google search snippet',
  };
};

const parseSchoolDistrictFromNominatim = (address = {}) => {
  const candidates = [
    address.school_district,
    address.school,
    address.county,
    address.city_district,
    address.state_district,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates[0] || '';
};

const fetchPropertyDetailsFromPublicSources = async (property = {}) => {
  const query = buildPropertyQuery(property);
  if (!query) {
    throw new Error('Address, city, and state are required to refresh online property details');
  }

  const enriched = {
    ...DEFAULT_ENRICHMENT,
    lastUpdated: new Date().toISOString(),
    sources: {},
  };

  let bestMatch = null;
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`;
    const nominatimResults = await fetchJson(nominatimUrl);
    bestMatch = Array.isArray(nominatimResults) ? nominatimResults[0] : null;
  } catch {
    bestMatch = null;
  }

  if (bestMatch) {
    enriched.schoolDistrict = parseSchoolDistrictFromNominatim(bestMatch.address || {});
    enriched.sources.schoolDistrict = 'OpenStreetMap Nominatim';
  }

  const county = String(bestMatch?.address?.county || '').replace(/ County$/i, '').trim();
  const state = String(property.state || bestMatch?.address?.state_code || bestMatch?.address?.state || '').trim();
  const city = String(property.city || bestMatch?.address?.city || bestMatch?.address?.town || bestMatch?.address?.village || '').trim();

  if (county && state) {
    try {
      const taxUrl = `https://api.census.gov/data/2021/acs/acs5/profile?get=NAME,DP03_0063E&for=county:*&in=state:*`;
      const taxRows = await fetchJson(taxUrl);
      if (Array.isArray(taxRows) && taxRows.length > 1) {
        const [headers, ...rows] = taxRows;
        const nameIndex = headers.indexOf('NAME');
        const taxIndex = headers.indexOf('DP03_0063E');
        const match = rows.find((row) => {
          const name = String(row[nameIndex] || '').toLowerCase();
          return name.includes(county.toLowerCase()) && name.includes(state.toLowerCase());
        });
        const annualTax = toNumberOrNull(match?.[taxIndex]);
        if (annualTax !== null) {
          enriched.propertyTax = annualTax;
          enriched.sources.propertyTax = 'US Census ACS median property tax';
        }
      }
    } catch {
      // best-effort public source
    }
  }

  if (city && state) {
    try {
      const cityUrl = `https://api.census.gov/data/2021/pep/population?get=NAME,POP&for=place:*&in=state:*`;
      const cityRows = await fetchJson(cityUrl);
      if (Array.isArray(cityRows) && cityRows.length > 1) {
        const [headers, ...rows] = cityRows;
        const nameIndex = headers.indexOf('NAME');
        const popIndex = headers.indexOf('POP');
        const cityRow = rows.find((row) => String(row[nameIndex] || '').toLowerCase().includes(`${city.toLowerCase()},`));
        const population = toNumberOrNull(cityRow?.[popIndex]);
        if (population !== null) {
          const base = toNumberOrNull(property.rent) || toNumberOrNull(property.value) || 0;
          const estimate = Math.max(base, 0) * 12 + population * 2;
          if (estimate > 0) {
            enriched.marketValue = Math.round(estimate);
            enriched.sources.marketValue = 'Public estimate using Census population + property rent/value';
          }
        }
      }
    } catch {
      // best-effort public source
    }
  }

  if (!enriched.marketValue) {
    try {
      const homesEstimate = await tryFetchMarketValueFromHomes(query);
      if (homesEstimate?.value) {
        enriched.marketValue = homesEstimate.value;
        enriched.sources.marketValue = homesEstimate.source;
      }
    } catch {
      // best-effort public source
    }
  }

  if (!enriched.marketValue) {
    const fallbackValue = toNumberOrNull(property.value);
    if (fallbackValue !== null && fallbackValue > 0) {
      enriched.marketValue = fallbackValue;
      enriched.sources.marketValue = 'Existing property value fallback';
    }
  }

  if (!enriched.schoolDistrict) {
    try {
      const districtResult = await tryFetchSchoolDistrictFromSearch(query);
      if (districtResult?.value) {
        enriched.schoolDistrict = districtResult.value;
        enriched.sources.schoolDistrict = districtResult.source;
      }
    } catch {
      // best-effort public source
    }
  }

  if (!enriched.propertyTax) {
    try {
      const taxResult = await tryFetchTaxFromSearch(query);
      if (taxResult?.value) {
        enriched.propertyTax = taxResult.value;
        enriched.sources.propertyTax = taxResult.source;
      }
    } catch {
      // best-effort public source
    }
  }

  if (!enriched.marketValue && !enriched.propertyTax && !enriched.schoolDistrict) {
    throw new Error('No public-source property details were found for this address');
  }

  return enriched;
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

db.exec(`
  CREATE TABLE IF NOT EXISTS baselane_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imported_at TEXT NOT NULL,
    source_file_name TEXT NOT NULL,
    import_mode TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL DEFAULT 'csv'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS baselane_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL,
    account TEXT NOT NULL DEFAULT '',
    transaction_date TEXT NOT NULL,
    merchant TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    amount TEXT NOT NULL DEFAULT '',
    transaction_type TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    sub_category TEXT NOT NULL DEFAULT '',
    property TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    raw_row TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (import_id) REFERENCES baselane_imports(id) ON DELETE CASCADE
  )
`);

const baselaneExpenseColumns = db.prepare('PRAGMA table_info(baselane_expenses)').all().map((column) => column.name);
const expectedBaselaneColumns = [
  'id',
  'import_id',
  'account',
  'transaction_date',
  'merchant',
  'description',
  'amount',
  'transaction_type',
  'category',
  'sub_category',
  'property',
  'unit',
  'notes',
  'raw_row',
  'created_at',
];

if (baselaneExpenseColumns.length && baselaneExpenseColumns.join('|') !== expectedBaselaneColumns.join('|')) {
  db.exec('DROP TABLE IF EXISTS baselane_expenses');
  db.exec(`
    CREATE TABLE baselane_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id INTEGER NOT NULL,
      account TEXT NOT NULL DEFAULT '',
      transaction_date TEXT NOT NULL,
      merchant TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL DEFAULT '',
      transaction_type TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      sub_category TEXT NOT NULL DEFAULT '',
      property TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      raw_row TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (import_id) REFERENCES baselane_imports(id) ON DELETE CASCADE
    )
  `);
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_baselane_expenses_transaction_date
  ON baselane_expenses (transaction_date DESC)
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_baselane_expenses_property
  ON baselane_expenses (property)
`);

const parseCsvLine = (line = '') => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseCsv = (content = '') => {
  const normalized = String(content || '').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header) => String(header || '').trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = String(values[index] || '').trim();
      return row;
    }, {});
  });
};

const normalizeBaselaneExpense = (row = {}) => ({
  account: String(row.Account || row.account || '').trim(),
  transactionDate: String(row.Date || row.date || '').trim(),
  merchant: String(row.Merchant || row.merchant || '').trim(),
  description: String(row.Description || row.description || '').trim(),
  amount: String(row.Amount || row.amount || '').trim(),
  transactionType: String(row.Type || row.type || '').trim(),
  category: String(row.Category || row.category || '').trim(),
  subCategory: String(row['Sub-category'] || row.subCategory || row['Sub Category'] || '').trim(),
  property: String(row.Property || row.property || '').trim(),
  unit: String(row.Unit || row.unit || '').trim(),
  notes: String(row.Notes || row.notes || '').trim(),
  rawRow: row,
});

const getBaselaneExpenses = () => db.prepare(`
  SELECT
    id,
    import_id AS importId,
    account,
    transaction_date AS date,
    merchant,
    description,
    amount,
    transaction_type AS type,
    category,
    sub_category AS subCategory,
    property,
    unit,
    notes,
    created_at AS createdAt
  FROM baselane_expenses
  ORDER BY transaction_date DESC, id DESC
`).all();

const getBaselaneReport = () => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS totalRecords,
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS netAmount,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) < 0 THEN -CAST(amount AS REAL) ELSE 0 END), 0) AS totalExpenses,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) > 0 THEN CAST(amount AS REAL) ELSE 0 END), 0) AS totalIncome,
      MIN(transaction_date) AS startDate,
      MAX(transaction_date) AS endDate
    FROM baselane_expenses
  `).get();

  const byProperty = db.prepare(`
    SELECT
      property,
      COUNT(*) AS recordCount,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) < 0 THEN -CAST(amount AS REAL) ELSE 0 END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) > 0 THEN CAST(amount AS REAL) ELSE 0 END), 0) AS income,
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS netAmount
    FROM baselane_expenses
    GROUP BY property
    ORDER BY expenses DESC, property ASC
  `).all();

  const byCategory = db.prepare(`
    SELECT
      category,
      COUNT(*) AS recordCount,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) < 0 THEN -CAST(amount AS REAL) ELSE 0 END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) > 0 THEN CAST(amount AS REAL) ELSE 0 END), 0) AS income,
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS netAmount
    FROM baselane_expenses
    GROUP BY category
    ORDER BY expenses DESC, category ASC
  `).all();

  const monthly = db.prepare(`
    SELECT
      substr(transaction_date, 1, 7) AS month,
      COUNT(*) AS recordCount,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) < 0 THEN -CAST(amount AS REAL) ELSE 0 END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN CAST(amount AS REAL) > 0 THEN CAST(amount AS REAL) ELSE 0 END), 0) AS income,
      COALESCE(SUM(CAST(amount AS REAL)), 0) AS netAmount
    FROM baselane_expenses
    GROUP BY substr(transaction_date, 1, 7)
    ORDER BY month DESC
  `).all();

  return { summary, byProperty, byCategory, monthly };
};

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
  props: Array.isArray(incoming.props)
    ? incoming.props.map((property) => ({
        ...property,
        enrichment: {
          ...DEFAULT_ENRICHMENT,
          ...(property?.enrichment || {}),
          sources: {
            ...DEFAULT_ENRICHMENT.sources,
            ...(property?.enrichment?.sources || {}),
          },
        },
      }))
    : [],
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

app.get('/api/baselane-expenses', (_req, res) => {
  res.json({ records: getBaselaneExpenses(), report: getBaselaneReport() });
});

app.post('/api/backup-db', (_req, res) => {
  const backupsDir = path.join(__dirname, 'backups');
  const pad = (value) => String(value).padStart(2, '0');
  const buildTimestamp = (date) => {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  };

  try {
    fs.mkdirSync(backupsDir, { recursive: true });

    const timestamp = buildTimestamp(new Date());
    const dbBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db`);
    const walSourcePath = `${DB_PATH}-wal`;
    const shmSourcePath = `${DB_PATH}-shm`;
    const walBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db-wal`);
    const shmBackupPath = path.join(backupsDir, `portfolio-${timestamp}.db-shm`);

    fs.copyFileSync(DB_PATH, dbBackupPath);
    if (fs.existsSync(walSourcePath)) {
      fs.copyFileSync(walSourcePath, walBackupPath);
    }
    if (fs.existsSync(shmSourcePath)) {
      fs.copyFileSync(shmSourcePath, shmBackupPath);
    }

    res.json({
      ok: true,
      database: path.relative(__dirname, dbBackupPath),
      wal: fs.existsSync(walSourcePath) ? path.relative(__dirname, walBackupPath) : null,
      shm: fs.existsSync(shmSourcePath) ? path.relative(__dirname, shmBackupPath) : null,
    });
  } catch (error) {
    console.error('Failed to back up SQLite database', error);
    res.status(500).json({ error: error.message || 'Failed to back up SQLite database' });
  }
});

app.post('/api/baselane-expenses/import', (req, res) => {
  const fileName = String(req.body?.fileName || 'baselane-import.csv').trim();
  const content = String(req.body?.content || '');
  const importMode = req.body?.importMode === 'append' ? 'append' : 'replace';

  if (!content.trim()) {
    res.status(400).json({ error: 'CSV content is required' });
    return;
  }

  const rows = parseCsv(content);
  const normalized = rows
    .map(normalizeBaselaneExpense)
    .filter((row) => row.transactionDate || row.property || row.merchant || row.description || row.amount);

  if (!normalized.length) {
    res.status(400).json({ error: 'No Baselane rows were found in the uploaded CSV file' });
    return;
  }

  const now = new Date().toISOString();
  const insertImport = db.prepare(`
    INSERT INTO baselane_imports (imported_at, source_file_name, import_mode, record_count, source_type)
    VALUES (?, ?, ?, ?, 'csv')
  `);
  const insertExpense = db.prepare(`
    INSERT INTO baselane_expenses (
      import_id,
      account,
      transaction_date,
      merchant,
      description,
      amount,
      transaction_type,
      category,
      sub_category,
      property,
      unit,
      notes,
      raw_row,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const importTransaction = db.transaction(() => {
    if (importMode === 'replace') {
      db.prepare('DELETE FROM baselane_expenses').run();
      db.prepare('DELETE FROM baselane_imports').run();
    }

    const importResult = insertImport.run(now, fileName, importMode, normalized.length);
    const importId = importResult.lastInsertRowid;

    normalized.forEach((row) => {
      insertExpense.run(
        importId,
        row.account,
        row.transactionDate,
        row.merchant,
        row.description,
        row.amount,
        row.transactionType,
        row.category,
        row.subCategory,
        row.property,
        row.unit,
        row.notes,
        JSON.stringify(row.rawRow),
        now
      );
    });
  });

  try {
    importTransaction();
  } catch (error) {
    console.error('Failed to import Baselane CSV', error);
    res.status(500).json({ error: error.message || 'Failed to import Baselane CSV' });
    return;
  }

  res.json({
    imported: normalized.length,
    importMode,
    fileName,
    records: getBaselaneExpenses(),
    report: getBaselaneReport(),
  });
});

app.post('/api/property-details/refresh', async (req, res) => {
  try {
    const property = req.body?.property || {};
    const enrichment = await fetchPropertyDetailsFromPublicSources(property);
    res.json({ enrichment });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to refresh property details' });
  }
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

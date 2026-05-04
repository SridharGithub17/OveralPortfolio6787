export const DEFAULT_SETTINGS = {
  marketRate30: 0.0668,
  marketRate15: 0.0595,
  refiCostPct: 0.025,
  targetCap: 0.085,
  targetCoC: 0.10,
  minEquityPct: 0.20,
  refiThreshold: 150,
  vacancyPct: 0.08,
  mgmtPct: 0.08,
  netWorthTargets: { realEstate: 0.40, equities: 0.30, cash: 0.10, retirement: 0.15, metals: 0.05 }
};

export const DEFAULT_FINANCES = { savings: [], investments: [], retirement: [], metals: [] };

export const LEGACY_KEYS = {
  props:'rep_props_v1', maint:'rep_maint_v1', exp:'rep_exp_v1', ohio:'rep_ohio_v1',
  finances:'rep_finances_v1', settings:'rep_settings_v1'
};

export const LEGACY_VAULT_KEY = 'rep_vault_v1';
export const LEGACY_MODE_KEY = 'rep_lock_mode_v1';

export const DEFAULT_STATE = {
  mode: 'plain',
  vault: null,
  props: [],
  maint: [],
  exp: [],
  ohio: [],
  finances: DEFAULT_FINANCES,
  settings: DEFAULT_SETTINGS,
};

const API_BASE = 'http://localhost:3001/api';

export const mergeSettings = (incoming = {}) => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  netWorthTargets: {
    ...DEFAULT_SETTINGS.netWorthTargets,
    ...(incoming.netWorthTargets || {}),
  },
});

export const normalizeState = (incoming = {}) => ({
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

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`Backend request failed (${res.status})`);
  }

  return res.json();
}

export async function fetchState() {
  return normalizeState(await api('/state'));
}

export function readLegacyBrowserState() {
  try {
    const mode = localStorage.getItem(LEGACY_MODE_KEY) === 'encrypted' ? 'encrypted' : 'plain';
    const vaultRaw = localStorage.getItem(LEGACY_VAULT_KEY);
    const vault = vaultRaw ? JSON.parse(vaultRaw) : null;

    return normalizeState({
      mode,
      vault,
      props: JSON.parse(localStorage.getItem(LEGACY_KEYS.props) || '[]'),
      maint: JSON.parse(localStorage.getItem(LEGACY_KEYS.maint) || '[]'),
      exp: JSON.parse(localStorage.getItem(LEGACY_KEYS.exp) || '[]'),
      ohio: JSON.parse(localStorage.getItem(LEGACY_KEYS.ohio) || '[]'),
      finances: JSON.parse(localStorage.getItem(LEGACY_KEYS.finances) || JSON.stringify(DEFAULT_FINANCES)),
      settings: JSON.parse(localStorage.getItem(LEGACY_KEYS.settings) || JSON.stringify(DEFAULT_SETTINGS)),
    });
  } catch {
    return normalizeState(DEFAULT_STATE);
  }
}

export function hasLegacyBrowserData() {
  return [
    LEGACY_VAULT_KEY,
    LEGACY_MODE_KEY,
    ...Object.values(LEGACY_KEYS),
  ].some((key) => localStorage.getItem(key) !== null);
}

export function clearLegacyBrowserData() {
  [LEGACY_VAULT_KEY, LEGACY_MODE_KEY, ...Object.values(LEGACY_KEYS)].forEach((key) => localStorage.removeItem(key));
}

export async function persistState(state) {
  return normalizeState(await api('/state', { method: 'PUT', body: JSON.stringify(normalizeState(state)) }));
}

export async function migrateLegacyBrowserDataIfNeeded() {
  if (!hasLegacyBrowserData()) {
    return { migrated: false, state: null };
  }

  const backendState = await fetchState();
  const backendHasData = Boolean(
    backendState.vault ||
    backendState.props.length ||
    backendState.maint.length ||
    backendState.exp.length ||
    backendState.ohio.length ||
    (backendState.finances.savings?.length || 0) ||
    (backendState.finances.investments?.length || 0) ||
    (backendState.finances.retirement?.length || 0) ||
    (backendState.finances.metals?.length || 0)
  );

  if (backendHasData) {
    return { migrated: false, state: backendState };
  }

  const legacyState = readLegacyBrowserState();
  const migratedState = await persistState(legacyState);
  clearLegacyBrowserData();
  return { migrated: true, state: migratedState };
}

export async function resetState() {
  return normalizeState(await api('/reset', { method: 'POST' }));
}

export const PBKDF2_ITER = 200000;
export const b64enc = b => btoa(String.fromCharCode(...new Uint8Array(b)));
export const b64dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:PBKDF2_ITER, hash:'SHA-256'},
    baseKey,
    {name:'AES-GCM', length:256},
    false, ['encrypt','decrypt']
  );
}

export async function encryptObj(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
  return {iv: b64enc(iv), ct: b64enc(ct)};
}

export async function decryptObj(key, blob) {
  const iv = b64dec(blob.iv);
  const ct = b64dec(blob.ct);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

export async function saveVault(key, salt, data, baseState = DEFAULT_STATE) {
  const blob = await encryptObj(key, data);
  return persistState({
    ...baseState,
    mode: 'encrypted',
    vault: { salt: b64enc(salt), iv: blob.iv, ct: blob.ct, v: 1 },
  });
}

export async function unlockVault(password, state) {
  const vault = state?.vault;
  if (!vault) return null;
  const salt = b64dec(vault.salt);
  const key = await deriveKey(password, salt);
  const data = await decryptObj(key, {iv:vault.iv, ct:vault.ct});
  return {data, key, salt};
}

export async function createVault(password, data, baseState = DEFAULT_STATE) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  await saveVault(key, salt, data, baseState);
  return {key, salt};
}

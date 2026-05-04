import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { fmtMoney, todayISO } from './calculations.js';
import { KPI } from './KPI.jsx';

const CATS = ['Mortgage','Property Tax','Insurance','Utilities','Repairs','Capital Improvement','Mgmt Fee','HOA','Travel','Legal/Accounting','Other'];

const BASELANE_BANK_HEADERS = ['Date', 'Property', 'Category', 'Payee', 'Memo', 'Amount'];

const BASELANE_SAMPLE_CONNECTIONS = [
  { id: 'baselane-checking', name: 'Baselane Operating Checking', status: 'Connected', lastSync: 'Just now' },
  { id: 'baselane-card', name: 'Baselane Rewards Card', status: 'Ready to sync', lastSync: '2 days ago' },
];

const parseDateValue = (value) => {
  if (value == null || value === '') return todayISO();
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }
  }
  const text = String(value).trim();
  if (!text) return todayISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const asDate = new Date(text);
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  const numeric = Number(text);
  if (!Number.isNaN(numeric) && numeric > 0) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }
  }
  return todayISO();
};

const parseAmountValue = (value) => {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '')
    .replace(/[$,]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .trim();
  return Number(cleaned) || 0;
};

const normalizeCategory = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'Other';
  const match = CATS.find((cat) => cat.toLowerCase() === text.toLowerCase());
  return match || 'Other';
};

const normalizeExpense = (row = {}) => ({
  date: parseDateValue(row.date || row.Date || row.transaction_date || row.TransactionDate),
  property: row.property || row.Property || row.unit || row.Unit || '',
  category: normalizeCategory(row.category || row.Category || row.type || row.Type),
  vendor: row.vendor || row.Vendor || row.merchant || row.Merchant || row.payee || row.Payee || '',
  description: row.description || row.Description || row.memo || row.Memo || '',
  amount: parseAmountValue(row.amount ?? row.Amount ?? row.total ?? row.Total ?? row.debit ?? row.Debit ?? row.credit ?? row.Credit ?? 0),
});

const detectProperty = (row = {}, propNames = []) => {
  const direct = row.property || row.Property || row.unit || row.Unit || row.account || row.Account || '';
  if (direct) return String(direct).trim();
  const haystack = [row.description, row.Description, row.memo, row.Memo, row.vendor, row.Vendor, row.payee, row.Payee]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const matched = propNames.find((name) => haystack.includes(String(name).toLowerCase()));
  return matched || '';
};

const normalizeImportedExpense = (row = {}, propNames = []) => ({
  ...normalizeExpense(row),
  property: detectProperty(row, propNames),
});

const classifyImportSource = (rows = []) => {
  const headers = Object.keys(rows[0] || {}).map((key) => key.toLowerCase());
  if (!headers.length) return 'unknown';
  if (headers.includes('vendor') || headers.includes('property')) return 'baselane-expenses';
  if (headers.includes('payee') || headers.includes('account') || headers.includes('debit')) return 'baselane-transactions';
  return 'generic';
};

export const Expenses = ({exp, setExp, props}) => {
  const [filterProp, setFP] = useState('');
  const [filterCat, setFC] = useState('');
  const importInputRef = useRef(null);
  const [syncMode, setSyncMode] = useState('replace');
  const [syncStatus, setSyncStatus] = useState('');
  const update = (i,k,v) => { const n=[...exp]; n[i]={...n[i],[k]:v}; setExp(n); };
  const add = () => setExp([...exp, {date:todayISO(),property:'',category:'Mortgage',amount:0}]);
  const del = i => { const n=[...exp]; n.splice(i,1); setExp(n); };
  const propNames = [...new Set(props.map(p=>p.nickname||p.address).filter(Boolean))];
  const triggerSpreadsheetImport = () => importInputRef.current?.click();

  const runBaselaneOnlineSync = () => {
    window.open('https://www.baselane.com/login', '_blank', 'noopener,noreferrer');
    setSyncStatus('Opened Baselane login in a new tab. After signing in, export the Transactions tab from Baselane and import that spreadsheet here to load the data for calculations.');
  };

  const importBaselaneSpreadsheet = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet || {}, { defval: '' });
        const source = classifyImportSource(rows);
        const imported = rows
          .map((row) => normalizeImportedExpense(row, propNames))
          .filter((row) => row.date || row.property || row.vendor || row.description || row.amount);
        if (!imported.length) {
          window.alert('No expense rows were found in that spreadsheet.');
        } else {
          setExp(syncMode === 'append' ? [...exp, ...imported] : imported);
          setSyncStatus(`Imported ${imported.length} ${source === 'baselane-transactions' ? 'transaction' : 'expense'} rows from ${file.name} using ${syncMode === 'append' ? 'append' : 'replace'} mode.`);
        }
      } catch (error) {
        window.alert(`Failed to import Baselane spreadsheet: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const filtered = exp.filter(e =>
    (!filterProp || e.property===filterProp) && (!filterCat || e.category===filterCat));
  const today = new Date();
  const sumYTD = filtered.filter(e=>e.date && new Date(e.date).getFullYear()===today.getFullYear()).reduce((s,e)=>s+(+e.amount||0),0);
  const sumMTD = filtered.filter(e=>{const d=new Date(e.date); return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth();}).reduce((s,e)=>s+(+e.amount||0),0);
  const sum12 = filtered.filter(e=>{const d=new Date(e.date); return (today-d)/86400000 <= 365;}).reduce((s,e)=>s+(+e.amount||0),0);

  const catTotals = {};
  filtered.filter(e=>e.date && new Date(e.date).getFullYear()===today.getFullYear()).forEach(e=>{
    const c = e.category||'Other'; catTotals[c] = (catTotals[c]||0)+(+e.amount||0);
  });
  const total = Object.values(catTotals).reduce((s,v)=>s+v,0);

  const sorted = [...filtered].map((e,i)=>({...e,_orig:exp.indexOf(e)})).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  return (
    <div>
      <h2>Expense Tracker</h2>
      <div className="card">
        <h3>Baselane import</h3>
        <div className="toolbar">
          <button className="primary" onClick={runBaselaneOnlineSync}>Connect Baselane online</button>
          <button className="ghost" onClick={triggerSpreadsheetImport}>Import Baselane spreadsheet</button>
          <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={importBaselaneSpreadsheet} style={{display:'none'}} />
        </div>
        <div className="row cols-3" style={{marginTop:12}}>
          <label>
            <div className="small">Import mode</div>
            <select value={syncMode} onChange={e=>setSyncMode(e.target.value)}>
              <option value="replace">Replace existing expenses</option>
              <option value="append">Append imported rows</option>
            </select>
          </label>
        </div>
        <div className="small" style={{marginTop:8}}>Click Connect Baselane online to open Baselane login, then export the Transactions tab from Baselane and upload that spreadsheet here. Imported rows load into this page for further calculations. Expected headers include {BASELANE_BANK_HEADERS.join(', ')}.</div>
        <div className="card" style={{marginTop:12,padding:12}}>
          <h4 style={{marginTop:0}}>Baselane online connections</h4>
          {BASELANE_SAMPLE_CONNECTIONS.map((connection)=>(
            <div className="alloc-row" key={connection.id}>
              <div className="name">{connection.name}</div>
              <div className="val">{connection.status}</div>
              <div className="pct">Last sync: {connection.lastSync}</div>
            </div>
          ))}
          <div className="small" style={{marginTop:8}}>Live syncing is not available in this local app. Use the Baselane website to sign in, export Transactions, and import the spreadsheet here.</div>
        </div>
        {!!syncStatus && <div className="small" style={{marginTop:10}}>{syncStatus}</div>}
      </div>
      <div className="row cols-3">
        <select value={filterProp} onChange={e=>setFP(e.target.value)}>
          <option value="">All properties</option>{propNames.map(p=><option key={p}>{p}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFC(e.target.value)}>
          <option value="">All categories</option>{CATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <button className="primary" onClick={add}>+ Add expense</button>
      </div>
      <div className="grid">
        <KPI label="MTD" value={fmtMoney(sumMTD)} />
        <KPI label="YTD" value={fmtMoney(sumYTD)} />
        <KPI label="Last 12 mo" value={fmtMoney(sum12)} />
        <KPI label="Entries" value={filtered.length} />
      </div>
      {filtered.length === 0
        ? <div className="card empty">No expenses match. Add an entry to start tracking.</div>
        : <div className="card" style={{padding:8}}>
            <table className="responsive">
              <thead><tr>
                <th>Date</th><th>Property</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th></th>
              </tr></thead>
              <tbody>{sorted.map(e=>(
                <tr key={e._orig}>
                  <td data-l="Date"><input type="date" value={e.date||''} onChange={ev=>update(e._orig,'date',ev.target.value)} /></td>
                  <td data-l="Property"><input list="exp-prop-opts" value={e.property||''} onChange={ev=>update(e._orig,'property',ev.target.value)} /></td>
                  <td data-l="Category">
                    <select value={e.category||'Other'} onChange={ev=>update(e._orig,'category',ev.target.value)}>
                      {CATS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td data-l="Vendor"><input value={e.vendor||''} onChange={ev=>update(e._orig,'vendor',ev.target.value)} /></td>
                  <td data-l="Description"><input value={e.description||''} onChange={ev=>update(e._orig,'description',ev.target.value)} /></td>
                  <td data-l="Amount" className="num"><input type="number" value={e.amount||''} onChange={ev=>update(e._orig,'amount',ev.target.value)} /></td>
                  <td><button className="danger-link" onClick={()=>del(e._orig)}>×</button></td>
                </tr>
              ))}</tbody>
            </table>
            <datalist id="exp-prop-opts">{propNames.map(p=>(<option key={p} value={p}/>))}</datalist>
          </div>}

      {total > 0 && (
        <div className="card">
          <h3>YTD by category</h3>
          {Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([c,v])=>(
            <div className="alloc-row" key={c}>
              <div className="name">{c}</div>
              <div className="val">{fmtMoney(v)}</div>
              <div className="pct">{(v/total*100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

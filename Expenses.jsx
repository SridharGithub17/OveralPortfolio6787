import React, { useRef, useState } from 'react';
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

export const Expenses = ({exp, setExp, props, baselaneExpenses = [], baselaneReport = null, onImportBaselaneCsv}) => {
  const [filterProp, setFP] = useState('');
  const [filterCat, setFC] = useState('');
  const importInputRef = useRef(null);
  const [syncMode, setSyncMode] = useState('replace');
  const [syncStatus, setSyncStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const propNames = [...new Set(props.map(p=>p.nickname||p.address).filter(Boolean))];
  const triggerSpreadsheetImport = () => importInputRef.current?.click();

  const runBaselaneOnlineSync = () => {
    window.open('https://www.baselane.com/login', '_blank', 'noopener,noreferrer');
    setSyncStatus('Opened Baselane login in a new tab. After signing in, export the Transactions tab from Baselane and import that spreadsheet here to load the data for calculations.');
  };

  const importBaselaneSpreadsheet = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      window.alert('Upload a Baselane CSV file. Excel files are no longer used for this import flow.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsImporting(true);
        const result = await onImportBaselaneCsv({
          fileName: file.name,
          content: String(reader.result || ''),
          importMode: syncMode,
        });
        setSyncStatus(`Imported ${result.imported} Baselane CSV rows from ${file.name} into the backend using ${syncMode === 'append' ? 'append' : 'replace'} mode.`);
      } catch (error) {
        window.alert(`Failed to import Baselane CSV: ${error.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
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
  const reportSummary = baselaneReport?.summary;
  const reportByProperty = baselaneReport?.byProperty || [];
  const reportByCategory = baselaneReport?.byCategory || [];
  const reportMonthly = baselaneReport?.monthly || [];

  return (
    <div>
      <h2>Expense Tracker</h2>
      <div className="card">
        <h3>Baselane import</h3>
        <div className="toolbar">
          <button className="primary" onClick={runBaselaneOnlineSync}>Connect Baselane online</button>
          <button className="ghost" onClick={triggerSpreadsheetImport} disabled={isImporting}>{isImporting ? 'Importing CSV…' : 'Import Baselane CSV'}</button>
          <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importBaselaneSpreadsheet} style={{display:'none'}} />
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
        <div className="small" style={{marginTop:8}}>Click Connect Baselane online to open Baselane login, then export the Transactions tab from Baselane as CSV and upload it here. Imported rows are saved into a dedicated SQLite Baselane table using the same CSV columns as the source file and become the source for this expenses page and reporting. Expected headers include {BASELANE_BANK_HEADERS.join(', ')}.</div>
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
      <div className="grid">
        <KPI label="Baselane rows" value={String(baselaneExpenses.length)} />
        <KPI label="Baselane expense total" value={fmtMoney(reportSummary?.totalExpenses || 0)} />
        <KPI label="Baselane income total" value={fmtMoney(reportSummary?.totalIncome || 0)} />
        <KPI label="Baselane net" value={fmtMoney(reportSummary?.netAmount || 0)} />
      </div>
      <div className="row cols-2">
        <select value={filterProp} onChange={e=>setFP(e.target.value)}>
          <option value="">All properties</option>{propNames.map(p=><option key={p}>{p}</option>)}
        </select>
        <select value={filterCat} onChange={e=>setFC(e.target.value)}>
          <option value="">All categories</option>{CATS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid">
        <KPI label="MTD" value={fmtMoney(sumMTD)} />
        <KPI label="YTD" value={fmtMoney(sumYTD)} />
        <KPI label="Last 12 mo" value={fmtMoney(sum12)} />
        <KPI label="Entries" value={filtered.length} />
      </div>
      {filtered.length === 0
        ? <div className="card empty">No imported Baselane expenses match the selected filters.</div>
        : <div className="card" style={{padding:8}}>
            <table className="responsive">
              <thead><tr>
                <th>Date</th><th>Property</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th>
              </tr></thead>
              <tbody>{sorted.map((e, index)=>(
                <tr key={`${e.date || 'no-date'}-${e.property || 'no-property'}-${e.vendor || 'no-vendor'}-${index}`}>
                  <td data-l="Date">{e.date || ''}</td>
                  <td data-l="Property">{e.property || ''}</td>
                  <td data-l="Category">{e.category || 'Other'}</td>
                  <td data-l="Vendor">{e.vendor || ''}</td>
                  <td data-l="Description">{e.description || ''}</td>
                  <td data-l="Amount" className="num">{fmtMoney(Number(e.amount || 0))}</td>
                </tr>
              ))}</tbody>
            </table>
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

      {!!baselaneExpenses.length && (
        <>
          <div className="card">
            <h3>Baselane reporting by property</h3>
            {reportByProperty.map((row) => (
              <div className="alloc-row" key={row.property || 'unassigned-property'}>
                <div className="name">{row.property || 'Unassigned'}</div>
                <div className="val">{fmtMoney(row.expenses || 0)}</div>
                <div className="pct">Income {fmtMoney(row.income || 0)} · Net {fmtMoney(row.netAmount || 0)}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Baselane reporting by category</h3>
            {reportByCategory.map((row) => (
              <div className="alloc-row" key={row.category}>
                <div className="name">{row.category}</div>
                <div className="val">{fmtMoney(row.expenses || 0)}</div>
                <div className="pct">Income {fmtMoney(row.income || 0)} · Net {fmtMoney(row.netAmount || 0)}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:8}}>
            <h3 style={{padding:'0 8px'}}>Imported Baselane records</h3>
            <table className="responsive">
              <thead><tr>
                <th>Account</th><th>Date</th><th>Merchant</th><th>Description</th><th>Amount</th><th>Type</th><th>Category</th><th>Sub-category</th><th>Property</th><th>Unit</th><th>Notes</th>
              </tr></thead>
              <tbody>{baselaneExpenses.map((row) => (
                <tr key={row.id}>
                  <td data-l="Account">{row.account || ''}</td>
                  <td data-l="Date">{row.date || ''}</td>
                  <td data-l="Merchant">{row.merchant || ''}</td>
                  <td data-l="Description">{row.description || ''}</td>
                  <td data-l="Amount" className="num">{fmtMoney(Number(row.amount || 0))}</td>
                  <td data-l="Type">{row.type || ''}</td>
                  <td data-l="Category">{row.category || ''}</td>
                  <td data-l="Sub-category">{row.subCategory || ''}</td>
                  <td data-l="Property">{row.property || ''}</td>
                  <td data-l="Unit">{row.unit || ''}</td>
                  <td data-l="Notes">{row.notes || ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="card">
            <h3>Baselane monthly trend</h3>
            {reportMonthly.map((row) => (
              <div className="alloc-row" key={row.month}>
                <div className="name">{row.month}</div>
                <div className="val">{fmtMoney(row.expenses || 0)}</div>
                <div className="pct">Income {fmtMoney(row.income || 0)} · Net {fmtMoney(row.netAmount || 0)} · {row.recordCount} rows</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

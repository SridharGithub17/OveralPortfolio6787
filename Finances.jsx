import React, { useState } from 'react';
import { fmtMoney } from './calculations.js';
import { KPI } from './KPI.jsx';

const SAVINGS_TYPES = ['Checking','Savings','High-Yield Savings','CD','Money Market'];
const INVEST_TYPES = ['Stock','ETF','Mutual Fund','Bond','Crypto','Other'];
const RETIRE_TYPES = ['401(k)','Traditional IRA','Roth IRA','Roth 401(k)','SEP IRA','HSA','Pension','Other'];
const METAL_TYPES = ['Gold','Silver','Platinum','Palladium','Other'];
const METAL_FORMS = ['Coin','Bar','Round','ETF','Other'];

const SECTION_CONFIG = {
  savings: {
    title: 'Cash & Savings',
    totalLabel: 'Total balance',
    totalKey: 'balance',
    emptyText: 'No cash or savings accounts yet. Click + Add account.',
    create: () => ({ institution:'', type:'Savings', balance:0, apy:0, notes:'' }),
    getName: (item) => item.institution || item.type || 'New account',
    getSubtitle: (item) => [item.type, item.notes].filter(Boolean).join(' · ') || 'No details added yet',
    summaryFields: [
      { key:'institution', label:'Institution', format:'text' },
      { key:'type', label:'Type', format:'text' },
      { key:'balance', label:'Balance', format:'money' },
    ],
    fields: [
      { key:'institution', label:'Institution', type:'text' },
      { key:'type', label:'Type', type:'select', options:SAVINGS_TYPES },
      { key:'balance', label:'Balance', type:'number' },
      { key:'apy', label:'APY', type:'number', step:'0.0001' },
      { key:'notes', label:'Notes', type:'text' },
    ]
  },
  investments: {
    title: 'Investments',
    totalLabel: 'Market value',
    totalKey: 'value',
    emptyText: 'No investments yet. Click + Add holding.',
    create: () => ({ holding:'', type:'Stock', account:'', shares:0, value:0, costBasis:0 }),
    getName: (item) => item.holding || item.account || 'New investment',
    getSubtitle: (item) => [item.type, item.account].filter(Boolean).join(' · ') || 'No details added yet',
    summaryFields: [
      { key:'holding', label:'Holding / Ticker', format:'text' },
      { key:'account', label:'Account', format:'text' },
      { key:'value', label:'Market value', format:'money' },
    ],
    fields: [
      { key:'holding', label:'Holding / Ticker', type:'text' },
      { key:'type', label:'Type', type:'select', options:INVEST_TYPES },
      { key:'account', label:'Account', type:'text' },
      { key:'shares', label:'Shares', type:'number', step:'0.001' },
      { key:'value', label:'Market value', type:'number' },
      { key:'costBasis', label:'Cost basis', type:'number' },
    ]
  },
  retirement: {
    title: 'Retirement Accounts',
    totalLabel: 'Total balance',
    totalKey: 'balance',
    emptyText: 'No retirement accounts yet. Click + Add account.',
    create: () => ({ account:'', type:'401(k)', provider:'', balance:0, ytdContrib:0 }),
    getName: (item) => item.account || item.provider || 'New retirement account',
    getSubtitle: (item) => [item.type, item.provider].filter(Boolean).join(' · ') || 'No details added yet',
    summaryFields: [
      { key:'account', label:'Account', format:'text' },
      { key:'provider', label:'Provider', format:'text' },
      { key:'balance', label:'Balance', format:'money' },
    ],
    fields: [
      { key:'account', label:'Account', type:'text' },
      { key:'type', label:'Type', type:'select', options:RETIRE_TYPES },
      { key:'provider', label:'Provider', type:'text' },
      { key:'balance', label:'Balance', type:'number' },
      { key:'ytdContrib', label:'YTD contribution', type:'number' },
    ]
  },
  metals: {
    title: 'Precious Metals',
    totalLabel: 'Total value',
    totalKey: 'value',
    emptyText: 'No precious metals yet. Click + Add holding.',
    create: () => ({ type:'Gold', form:'Coin', quantity:0, value:0, notes:'' }),
    getName: (item) => item.type || item.form || 'New metal holding',
    getSubtitle: (item) => [item.form, item.notes].filter(Boolean).join(' · ') || 'No details added yet',
    summaryFields: [
      { key:'type', label:'Metal', format:'text' },
      { key:'form', label:'Form', format:'text' },
      { key:'value', label:'Value', format:'money' },
    ],
    fields: [
      { key:'type', label:'Metal', type:'select', options:METAL_TYPES },
      { key:'form', label:'Form', type:'select', options:METAL_FORMS },
      { key:'quantity', label:'Quantity (oz)', type:'number', step:'0.001' },
      { key:'value', label:'Value', type:'number' },
      { key:'notes', label:'Notes', type:'text' },
    ]
  }
};

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatSummaryValue = (item, field) => {
  const value = item[field.key];
  if (field.format === 'money') return fmtMoney(+value || 0);
  return value || '—';
};

const FinanceSectionList = ({ config, items, onAdd, onSelect }) => {
  const total = items.reduce((sum, item) => sum + (+item[config.totalKey] || 0), 0);

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <h3 style={{ margin:0 }}>{config.title}</h3>
          <div className="small" style={{ marginTop:4 }}>Click an item to open details, update values, or delete it.</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div className="small">{config.totalLabel}</div>
          <div style={{ fontWeight:600, color:'var(--navy)', fontSize:16 }}>{fmtMoney(total)}</div>
        </div>
      </div>

      <div className="toolbar">
        <button className="primary" onClick={onAdd}>+ Add</button>
      </div>

      {items.length === 0 ? (
        <div className="empty">{config.emptyText}</div>
      ) : (
        <div className="grid">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              className="card"
              onClick={() => onSelect(index)}
              style={{ textAlign:'left', cursor:'pointer', display:'block', width:'100%' }}
            >
              <div style={{ marginBottom:10 }}>
                <h3 style={{ margin:0 }}>{config.getName(item)}</h3>
                <div className="small" style={{ marginTop:4 }}>{config.getSubtitle(item)}</div>
              </div>

              <div className="grid">
                {config.summaryFields.map((field) => (
                  <KPI key={field.key} label={field.label} value={formatSummaryValue(item, field)} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FinanceField = ({ field, value, onChange }) => {
  if (field.type === 'select') {
    return (
      <label>
        <div className="small">{field.label}</div>
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  return (
    <label>
      <div className="small">{field.label}</div>
      <input type={field.type || 'text'} step={field.step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
};

const FinanceSectionDetail = ({ config, item, onBack, onUpdate, onDelete }) => {
  const totalValue = +item[config.totalKey] || 0;
  const numberFields = config.fields.filter((field) => field.type === 'number' && field.key !== config.totalKey).slice(0, 3);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div>
          <button className="ghost" onClick={onBack} style={{ marginBottom:12 }}>← Back to finance tab</button>
          <h2 style={{ margin:0 }}>{config.getName(item)}</h2>
          <div className="small" style={{ marginTop:4 }}>{config.title} details page</div>
        </div>
        <button className="ghost" onClick={onDelete} style={{ color:'var(--red)', borderColor:'var(--red)' }}>Delete</button>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ marginTop:0 }}>{config.title} details</h3>
        <div className="row">
          {config.fields.map((field) => (
            <FinanceField
              key={field.key}
              field={field}
              value={item[field.key]}
              onChange={(value) => onUpdate(field.key, field.type === 'number' ? toNumber(value) : value)}
            />
          ))}
        </div>
      </div>

      <div className="grid">
        <KPI label={config.totalLabel} value={fmtMoney(totalValue)} />
        {numberFields.map((field) => (
          <KPI key={field.key} label={field.label} value={fmtMoney(+item[field.key] || 0)} />
        ))}
      </div>
    </div>
  );
};

export const Finances = ({finances, setFinances}) => {
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);

  const updateItem = (sectionKey, index, key, value) => {
    const next = [...(finances[sectionKey] || [])];
    next[index] = { ...next[index], [key]: value };
    setFinances({ ...finances, [sectionKey]: next });
  };

  const addItem = (sectionKey) => {
    const next = [...(finances[sectionKey] || []), SECTION_CONFIG[sectionKey].create()];
    setFinances({ ...finances, [sectionKey]: next });
    setSelectedSection(sectionKey);
    setSelectedIndex(next.length - 1);
  };

  const deleteItem = (sectionKey, index) => {
    if (!window.confirm(`Delete this item from ${SECTION_CONFIG[sectionKey].title}?`)) return;
    const next = [...(finances[sectionKey] || [])];
    next.splice(index, 1);
    setFinances({ ...finances, [sectionKey]: next });
    setSelectedSection('');
    setSelectedIndex(null);
  };

  const sumS = (finances.savings||[]).reduce((s,x)=>s+(+x.balance||0),0);
  const sumI = (finances.investments||[]).reduce((s,x)=>s+(+x.value||0),0);
  const sumR = (finances.retirement||[]).reduce((s,x)=>s+(+x.balance||0),0);
  const sumM = (finances.metals||[]).reduce((s,x)=>s+(+x.value||0),0);
  const total = sumS + sumI + sumR + sumM;

  const selectedConfig = selectedSection ? SECTION_CONFIG[selectedSection] : null;
  const selectedItem = selectedSection && selectedIndex !== null ? finances[selectedSection]?.[selectedIndex] : null;

  if (selectedConfig && selectedItem) {
    return (
      <FinanceSectionDetail
        config={selectedConfig}
        item={selectedItem}
        onBack={() => {
          setSelectedSection('');
          setSelectedIndex(null);
        }}
        onUpdate={(key, value) => updateItem(selectedSection, selectedIndex, key, value)}
        onDelete={() => deleteItem(selectedSection, selectedIndex)}
      />
    );
  }

  return (
    <div>
      <h2>Personal Finances</h2>
      <div className="grid">
        <KPI label="Cash & Savings" value={fmtMoney(sumS)} />
        <KPI label="Investments" value={fmtMoney(sumI)} />
        <KPI label="Retirement" value={fmtMoney(sumR)} />
        <KPI label="Precious Metals" value={fmtMoney(sumM)} />
        <KPI label="Total liquid + retire" value={fmtMoney(total)} sub="Excludes real estate" />
      </div>

      <FinanceSectionList
        config={SECTION_CONFIG.savings}
        items={finances.savings||[]}
        onAdd={() => addItem('savings')}
        onSelect={(index) => {
          setSelectedSection('savings');
          setSelectedIndex(index);
        }}
      />

      <FinanceSectionList
        config={SECTION_CONFIG.investments}
        items={finances.investments||[]}
        onAdd={() => addItem('investments')}
        onSelect={(index) => {
          setSelectedSection('investments');
          setSelectedIndex(index);
        }}
      />

      <FinanceSectionList
        config={SECTION_CONFIG.retirement}
        items={finances.retirement||[]}
        onAdd={() => addItem('retirement')}
        onSelect={(index) => {
          setSelectedSection('retirement');
          setSelectedIndex(index);
        }}
      />

      <FinanceSectionList
        config={SECTION_CONFIG.metals}
        items={finances.metals||[]}
        onAdd={() => addItem('metals')}
        onSelect={(index) => {
          setSelectedSection('metals');
          setSelectedIndex(index);
        }}
      />
    </div>
  );
};

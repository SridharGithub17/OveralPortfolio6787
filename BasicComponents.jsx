import React from 'react';

export const Header = () => (
  <header>
    <h1>Portfolio Hub</h1>
    <p>Real estate · personal finances · net worth</p>
  </header>
);

export const TABS = [
  {id:'overview',  label:'Overview',  icon:'⌂'},
  {id:'properties',label:'Real Estate',icon:'🏠'},
  {id:'maint',     label:'Maint',     icon:'🔧'},
  {id:'expenses',  label:'Expenses',  icon:'💳'},
  {id:'refi',      label:'Refi',      icon:'📉'},
  {id:'ohio',      label:'Ohio',      icon:'🌎'},
  {id:'finances',  label:'Finances',  icon:'💼'},
  {id:'networth',  label:'Net Worth', icon:'📊'},
  {id:'settings',  label:'Settings',  icon:'⚙'}
];

export const SideNav = ({tab, setTab}) => (
  <nav className="side">
    {TABS.map(t => (
      <button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.label}</button>
    ))}
  </nav>
);

export const BottomNav = ({tab, setTab}) => (
  <nav className="bottom">
    {TABS.map(t => (
      <button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}>
        <span className="icon">{t.icon}</span>{t.label}
      </button>
    ))}
  </nav>
);

export const Field = ({label, value, onChange, type='text', step, options, style}) => (
  <div style={style}>
    <label>{label}</label>
    {options
      ? <select value={value||''} onChange={e=>onChange(e.target.value)}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      : <input type={type} step={step} value={value??''} onChange={e=>onChange(e.target.value)} />}
  </div>
);

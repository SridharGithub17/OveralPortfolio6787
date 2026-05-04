import React, { useState, useEffect } from 'react';

export const SettingsTab = ({settings, setSettings, exportData, importData, exportXLSX, importXLSX, loadSamples, resetAll, mode, onLock, onEnableEncryption, onChangePassword}) => {
  const [s, setS] = useState(settings);
  useEffect(()=>setS(settings),[settings]);
  const updT = (k,v) => setS({...s, netWorthTargets:{...s.netWorthTargets, [k]:+v}});

  const fields = [
    {k:'marketRate30',l:'Current 30-yr mortgage rate',pct:true},
    {k:'marketRate15',l:'Current 15-yr mortgage rate',pct:true},
    {k:'refiCostPct', l:'Refi closing cost (% of loan)',pct:true},
    {k:'targetCap',   l:'Target cap rate (Ohio)',pct:true},
    {k:'targetCoC',   l:'Target cash-on-cash',pct:true},
    {k:'minEquityPct',l:'Min equity for refi',pct:true},
    {k:'refiThreshold',l:'Refi savings threshold ($/mo)',pct:false},
    {k:'vacancyPct',  l:'Vacancy assumption',pct:true},
    {k:'mgmtPct',     l:'Property mgmt fee',pct:true}
  ];

  const targetSum = Object.values(s.netWorthTargets).reduce((a,b)=>a+b,0);

  return (
    <div>
      <h2>Settings</h2>
      <div className="card">
        <h3>Core assumptions</h3>
        {fields.map(f => (
          <div key={f.k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--line)',gap:10}}>
            <div style={{flex:1}}>{f.l} {f.pct && <span className="small">({(s[f.k]*100).toFixed(2)}%)</span>}</div>
            <input type="number" step={f.pct?'0.0001':'1'} value={s[f.k]} onChange={e=>setS({...s, [f.k]:+e.target.value})} style={{width:120,textAlign:'right'}} />
          </div>
        ))}
        <div style={{marginTop:12}}><button className="primary" onClick={()=>setSettings(s)}>Save settings</button></div>
      </div>

      <div className="card">
        <h3>Net worth allocation targets</h3>
        <p className="small" style={{marginTop:0}}>Should sum to 100%. Currently: <b style={{color:Math.abs(targetSum-1)<0.001?'var(--green)':'var(--red)'}}>{(targetSum*100).toFixed(0)}%</b></p>
        {Object.entries(s.netWorthTargets).map(([k,v]) => (
          <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--line)',gap:10}}>
            <div style={{flex:1,textTransform:'capitalize'}}>{k.replace(/([A-Z])/g,' $1').toLowerCase()} <span className="small">({(v*100).toFixed(0)}%)</span></div>
            <input type="number" step="0.01" value={v} onChange={e=>updT(k, e.target.value)} style={{width:120,textAlign:'right'}} />
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Sync with Excel (the backend)</h3>
        <p className="small" style={{marginTop:0}}>
          The Excel file is your source of truth across devices. Drop it in OneDrive/iCloud, then import here on each device.
        </p>
        <div className="toolbar">
          <button className="primary" onClick={exportXLSX}>Export to Excel</button>
          <button className="ghost" onClick={()=>document.getElementById('imp-xlsx').click()}>Import from Excel</button>
          <input id="imp-xlsx" type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={importXLSX} />
        </div>
        <h3>Quick JSON backup</h3>
        <div className="toolbar">
          <button className="ghost" onClick={exportData}>Export JSON</button>
          <button className="ghost" onClick={()=>document.getElementById('imp-json').click()}>Import JSON</button>
          <input id="imp-json" type="file" accept=".json" style={{display:'none'}} onChange={importData} />
        </div>
      </div>

      <div className="card">
        <h3>Mortgage rate context · May 3, 2026</h3>
        <table>
          <tbody>
            <tr><td>30-yr fixed refi (Bankrate avg)</td><td className="num"><b>6.68%</b></td></tr>
            <tr><td>30-yr fixed refi (Zillow)</td><td className="num">6.62%</td></tr>
            <tr><td>April 2026 low (Apr 18)</td><td className="num">6.02%</td></tr>
            <tr><td>Q2 2026 forecast (MBA / Fannie Mae)</td><td className="num">6.30%</td></tr>
            <tr><td>15-yr fixed refi (approx)</td><td className="num">5.95%</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Security</h3>
        {mode === 'unlocked' && (
          <div>
            <p className="small" style={{marginTop:0}}>
              <span className="pill pill-green">Encrypted</span> Your data is protected with AES-256.
              You'll need your password each time you open this page on this device.
            </p>
            <div className="toolbar">
              <button className="primary" onClick={onLock}>Lock now</button>
              <button className="ghost" onClick={onChangePassword}>Change password</button>
            </div>
          </div>
        )}
        {mode === 'plain' && (
          <div>
            <p className="small" style={{marginTop:0}}>
              <span className="pill pill-amber">Not protected</span> Data is stored in the SQLite backend without encryption.
              Anyone with access to this device can read it.
            </p>
            <div className="toolbar">
              <button className="primary" onClick={onEnableEncryption}>Enable password protection</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Utilities</h3>
        <div className="toolbar">
          <button className="ghost" onClick={loadSamples}>Load sample data</button>
          <button className="ghost" onClick={resetAll} style={{color:'var(--red)',borderColor:'var(--red)'}}>Reset all data</button>
        </div>
      </div>
    </div>
  );
};

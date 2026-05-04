import React from 'react';
import { fmtMoney, todayISO, maintStatus } from './calculations.js';
import { KPI } from './KPI.jsx';

export const Maint = ({maint, setMaint, props}) => {
  const update = (i,k,v) => { const n=[...maint]; n[i]={...n[i],[k]:v}; setMaint(n); };
  const add = () => setMaint([...maint, {property:'',item:'',lastDate:todayISO(),lifespan:10,cost:0}]);
  const del = i => { const n=[...maint]; n.splice(i,1); setMaint(n); };
  const propNames = props.map(p=>p.nickname||p.address).filter(Boolean);

  const overdueCount = maint.filter(m=>maintStatus(m).label==='Overdue').length;
  const dueSoonCount = maint.filter(m=>maintStatus(m).label==='Due 60d').length;
  const totalCost = maint.filter(m=>maintStatus(m).label!=='OK' && maintStatus(m).label!=='—').reduce((s,m)=>s+(+m.cost||0),0);

  return (
    <div>
      <h2>Maintenance Tracker</h2>
      <div className="grid">
        <KPI label="Overdue" value={overdueCount} valueColor={overdueCount?'var(--red)':null} />
        <KPI label="Due 60 days" value={dueSoonCount} valueColor={dueSoonCount?'var(--amber)':null} />
        <KPI label="Upcoming cost" value={fmtMoney(totalCost)} />
      </div>
      <div className="toolbar"><button className="primary" onClick={add}>+ Add item</button></div>
      {maint.length === 0
        ? <div className="card empty">No maintenance items yet.</div>
        : <div className="card" style={{padding:8}}>
            <table className="responsive">
              <thead><tr>
                <th>Property</th><th>Item</th><th>Last</th><th>Life</th>
                <th>Next</th><th>Status</th><th>Cost</th><th></th>
              </tr></thead>
              <tbody>{maint.map((m,i)=>{
                const st = maintStatus(m);
                return (
                  <tr key={i}>
                    <td data-l="Property"><input list="prop-opts" value={m.property||''} onChange={e=>update(i,'property',e.target.value)} /></td>
                    <td data-l="Item"><input value={m.item||''} onChange={e=>update(i,'item',e.target.value)} /></td>
                    <td data-l="Last"><input type="date" value={m.lastDate||''} onChange={e=>update(i,'lastDate',e.target.value)} /></td>
                    <td data-l="Life (yr)"><input type="number" value={m.lifespan||''} onChange={e=>update(i,'lifespan',e.target.value)} /></td>
                    <td data-l="Next due">{st.nextDue||'—'}</td>
                    <td data-l="Status"><span className={`pill ${st.cls}`}>{st.label}</span></td>
                    <td data-l="Cost" className="num"><input type="number" value={m.cost||''} onChange={e=>update(i,'cost',e.target.value)} /></td>
                    <td><button className="danger-link" onClick={()=>del(i)}>×</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
            <datalist id="prop-opts">{propNames.map(p=>(<option key={p} value={p}/>))}</datalist>
          </div>}
    </div>
  );
};

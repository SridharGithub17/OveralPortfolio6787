import React from 'react';
import { fmtMoney, fmtPct, fmtPct1, calcProperty, maintStatus } from './calculations.js';
import { KPI } from './KPI.jsx';

export const Overview = ({props, maint, finances, settings, setTab}) => {
  const computed = props.map(p=>({...p, calc:calcProperty(p,settings)}));
  const totalValue = props.reduce((s,p)=>s+(+p.value||0),0);
  const totalMort = props.reduce((s,p)=>s+(+p.mortgage||0),0);
  const totalEquity = totalValue - totalMort;
  const annualNOI = computed.reduce((s,p)=>s+p.calc.annualNOI,0);
  const monthlyCF = computed.reduce((s,p)=>s+p.calc.netCF,0);
  const portCap = totalValue > 0 ? annualNOI/totalValue : 0;
  const refiCount = computed.filter(p=>p.calc.refiDecision==='REFI NOW').length;
  const overdueMaint = maint.filter(m=>maintStatus(m).label==='Overdue').length;
  
  const finTotal = (finances.savings||[]).reduce((s,x)=>s+(+x.balance||0),0)
    + (finances.investments||[]).reduce((s,x)=>s+(+x.value||0),0)
    + (finances.retirement||[]).reduce((s,x)=>s+(+x.balance||0),0)
    + (finances.metals||[]).reduce((s,x)=>s+(+x.value||0),0);
  const netWorth = totalEquity + finTotal;
  const investmentCategories = [
    { name: 'Real Estate', value: totalEquity, color: '#1F3A5F' },
    { name: 'Savings', value: (finances.savings || []).reduce((s,x)=>s+(+x.balance||0),0), color: '#2E7D8F' },
    { name: 'Investments', value: (finances.investments || []).reduce((s,x)=>s+(+x.value||0),0), color: '#5BA4B8' },
    { name: 'Retirement', value: (finances.retirement || []).reduce((s,x)=>s+(+x.balance||0),0), color: '#C9A227' },
    { name: 'Metals', value: (finances.metals || []).reduce((s,x)=>s+(+x.value||0),0), color: '#8B6914' },
  ].filter(category => category.value > 0);
  const totalInvestment = investmentCategories.reduce((sum, category) => sum + category.value, 0);

  const alerts = [];
  maint.forEach(m => {
    const st = maintStatus(m);
    if(st.label === 'Overdue') alerts.push({pill:'pill-red',label:'Overdue',text:`${m.property||'—'} · ${m.item} (was due ${st.nextDue})`});
    else if(st.label === 'Due 60d') alerts.push({pill:'pill-amber',label:'Due soon',text:`${m.property||'—'} · ${m.item} (${st.nextDue})`});
  });
  computed.forEach(p => {
    if(p.calc.refiDecision === 'REFI NOW')
      alerts.push({pill:'pill-green',label:'Refi Now',text:`${p.nickname||p.address} · save ${fmtMoney(p.calc.moSavings)}/mo, break-even ${p.calc.breakEven.toFixed(0)} mo`});
    if(p.calc.netCF < 0)
      alerts.push({pill:'pill-red',label:'Neg cash flow',text:`${p.nickname||p.address} · ${fmtMoney(p.calc.netCF)}/mo`});
  });

  return (
    <div>
      <h2>Overview</h2>
      <div className="grid">
        <KPI label="Net Worth" value={fmtMoney(netWorth)} sub="Real estate equity + liquid" />
        <KPI label="Real Estate" value={fmtMoney(totalEquity)} sub={`${props.length} props · ${fmtPct1(totalValue?1-totalMort/totalValue:0)} equity`} />
        <KPI label="Liquid + Retire" value={fmtMoney(finTotal)} sub="See Finances tab" />
        <KPI label="Mo Cash Flow" value={fmtMoney(monthlyCF)} sub={`Annual NOI ${fmtMoney(annualNOI)}`} valueColor={monthlyCF<0?'var(--red)':null} />
        <KPI label="Portfolio Cap" value={fmtPct(portCap)} />
        <KPI label="Refi Opps" value={refiCount} sub={refiCount?'See Refi tab':'No action'} />
        <KPI label="Maint Overdue" value={overdueMaint} sub={overdueMaint?'Address ASAP':'All clear'} />
      </div>

      <div className="card">
        <h3>Investment Allocation</h3>
        {totalInvestment === 0 ? (
          <div className="empty">Add real estate or finance balances to see the investment chart.</div>
        ) : (
          <>
            <div className="net-bar" style={{ marginBottom: 16 }}>
              {investmentCategories.map((category) => (
                <div
                  key={category.name}
                  style={{
                    background: category.color,
                    flex: category.value,
                    minWidth: category.value / totalInvestment > 0.06 ? 'auto' : '0'
                  }}
                  title={`${category.name}: ${fmtMoney(category.value)} (${fmtPct1(category.value / totalInvestment)})`}
                >
                  {category.value / totalInvestment > 0.08 ? fmtPct1(category.value / totalInvestment) : ''}
                </div>
              ))}
            </div>
            {investmentCategories.map((category) => (
              <div className="alloc-row" key={category.name}>
                <span className="swatch" style={{ background: category.color }}></span>
                <div className="name">{category.name}</div>
                <div className="val">{fmtMoney(category.value)}</div>
                <div className="pct">{fmtPct1(category.value / totalInvestment)}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card">
        <h3>What needs your attention</h3>
        {alerts.length === 0
          ? <div className="empty">All clear — nothing demands attention right now.</div>
          : <div className="alerts-list">{alerts.map((a,i)=>(
              <div key={i}><span className={`pill ${a.pill}`}>{a.label}</span>{a.text}</div>
            ))}</div>}
      </div>

      <div className="card">
        <h3>Properties at a glance</h3>
        {props.length === 0
          ? <div className="empty">Add a property to see your portfolio here.</div>
          : computed.map((p,i)=>(
              <div className="property-row" key={i} onClick={()=>setTab('properties')}>
                <div className="info">
                  <div className="name">{p.nickname||p.address||'—'}</div>
                  <div className="meta">{[p.city,p.state].filter(Boolean).join(', ')} · LTV {fmtPct1(p.calc.ltv)}</div>
                </div>
                <div className="stat">
                  <div className="v" style={{color:p.calc.netCF<0?'var(--red)':'var(--green)'}}>{fmtMoney(p.calc.netCF)}/mo</div>
                  <div className="small">{fmtMoney(p.calc.equity)} equity</div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

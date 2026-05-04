import React from 'react';
import { fmtMoney, fmtPct1, calcProperty } from './calculations.js';
import { KPI } from './KPI.jsx';

export const NetWorth = ({props, finances, settings}) => {
  const computed = props.map(p=>({...p, calc:calcProperty(p,settings)}));
  const reEquity = computed.reduce((s,p)=>s+p.calc.equity,0);
  const reValue = computed.reduce((s,p)=>s+p.calc.value,0);
  const reMort = computed.reduce((s,p)=>s+p.calc.mort,0);
  const annualCF = computed.reduce((s,p)=>s+p.calc.netCF,0)*12;
  const sumS = (finances.savings||[]).reduce((s,x)=>s+(+x.balance||0),0);
  const sumI = (finances.investments||[]).reduce((s,x)=>s+(+x.value||0),0);
  const sumR = (finances.retirement||[]).reduce((s,x)=>s+(+x.balance||0),0);
  const sumM = (finances.metals||[]).reduce((s,x)=>s+(+x.value||0),0);

  const totalAssets = reValue + sumS + sumI + sumR + sumM;
  const totalLiabilities = reMort;
  const netWorth = totalAssets - totalLiabilities;
  const liquid = sumS + sumI + sumM;

  const allocations = [
    {name:'Real Estate equity', value:reEquity, color:'#1F3A5F', target:settings.netWorthTargets.realEstate},
    {name:'Equities (stocks/funds)', value:sumI, color:'#2E7D8F', target:settings.netWorthTargets.equities},
    {name:'Cash & Savings', value:sumS, color:'#5BA4B8', target:settings.netWorthTargets.cash},
    {name:'Retirement', value:sumR, color:'#C9A227', target:settings.netWorthTargets.retirement},
    {name:'Precious Metals', value:sumM, color:'#8B6914', target:settings.netWorthTargets.metals}
  ];
  const allocTotal = allocations.reduce((s,a)=>s+a.value,0);

  return (
    <div>
      <h2>Net Worth</h2>
      <div className="grid">
        <KPI label="Net Worth" value={fmtMoney(netWorth)} />
        <KPI label="Total Assets" value={fmtMoney(totalAssets)} />
        <KPI label="Total Liabilities" value={fmtMoney(totalLiabilities)} valueColor="var(--red)" />
        <KPI label="Liquid Assets" value={fmtMoney(liquid)} sub={`${allocTotal?(liquid/allocTotal*100).toFixed(0):0}% of allocation`} />
        <KPI label="Real Estate Cash Flow" value={fmtMoney(annualCF)} sub="Annual, net of all expenses" />
      </div>

      <div className="card">
        <h3>Allocation</h3>
        {allocTotal > 0 && (
          <div className="net-bar">
            {allocations.filter(a=>a.value>0).map((a,i)=>(
              <div key={i} style={{background:a.color, flex:a.value, minWidth:a.value/allocTotal>0.06?'auto':'0'}}>
                {a.value/allocTotal>0.08 ? (a.value/allocTotal*100).toFixed(0)+'%' : ''}
              </div>
            ))}
          </div>
        )}
        {allocations.map(a => (
          <div className="alloc-row" key={a.name}>
            <span className="swatch" style={{background:a.color}}></span>
            <div className="name">{a.name}</div>
            <div className="val">{fmtMoney(a.value)}</div>
            <div className="pct">{allocTotal?(a.value/allocTotal*100).toFixed(1):'0.0'}%</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Allocation vs target</h3>
        <p className="small" style={{marginTop:0}}>Targets are set on the Settings tab. Variances tell you what's over/under-weight.</p>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Bucket</th><th>Actual %</th><th>Actual $</th><th>Target %</th><th>Target $</th><th>Variance</th><th>Action</th></tr></thead>
          <tbody>{allocations.map(a => {
             const actual = allocTotal?a.value/allocTotal:0;
             const targetValue = allocTotal * a.target;
             const valueVariance = a.value - targetValue;
             const variance = actual - a.target;
             const action = Math.abs(variance) < 0.02 ? 'On target' :
               variance > 0 ? 'Overweight — trim' : 'Underweight — add';
             const cls = Math.abs(variance) < 0.02 ? 'pill-green' :
               variance > 0 ? 'pill-amber' : 'pill-amber';
             return (
               <tr key={a.name}>
                 <td data-l="Bucket">{a.name}</td>
                 <td data-l="Actual %" className="num">{fmtPct1(actual)}</td>
                 <td data-l="Actual $" className="num">{fmtMoney(a.value)}</td>
                 <td data-l="Target %" className="num">{fmtPct1(a.target)}</td>
                 <td data-l="Target $" className="num">{fmtMoney(targetValue)}</td>
                 <td data-l="Variance" className="num">
                   <div style={{color:variance<0?'var(--red)':variance>0?'var(--amber)':'var(--green)'}}>{variance>=0?'+':''}{(variance*100).toFixed(1)}%</div>
                   <div className="small" style={{color:valueVariance<0?'var(--red)':valueVariance>0?'var(--amber)':'var(--green)'}}>{valueVariance>=0?'+':''}{fmtMoney(valueVariance)}</div>
                  </td>
                 <td data-l="Action"><span className={`pill ${cls}`}>{action}</span></td>
                </tr>
              );
            })}</tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <h3>Balance sheet</h3>
        <table>
          <tbody>
            <tr><td colSpan="2" style={{background:'#FAFBFD',fontWeight:600,color:'var(--navy)'}}>ASSETS</td></tr>
            <tr><td>Real estate (market value)</td><td className="num">{fmtMoney(reValue)}</td></tr>
            <tr><td>Cash & savings</td><td className="num">{fmtMoney(sumS)}</td></tr>
            <tr><td>Investments (taxable)</td><td className="num">{fmtMoney(sumI)}</td></tr>
            <tr><td>Retirement accounts</td><td className="num">{fmtMoney(sumR)}</td></tr>
            <tr><td>Precious metals</td><td className="num">{fmtMoney(sumM)}</td></tr>
            <tr><td><b>Total assets</b></td><td className="num"><b>{fmtMoney(totalAssets)}</b></td></tr>
            <tr><td colSpan="2" style={{background:'#FAFBFD',fontWeight:600,color:'var(--navy)'}}>LIABILITIES</td></tr>
            <tr><td>Mortgage debt</td><td className="num">{fmtMoney(reMort)}</td></tr>
            <tr><td><b>Total liabilities</b></td><td className="num"><b>{fmtMoney(totalLiabilities)}</b></td></tr>
            <tr><td colSpan="2" style={{background:'#FAFBFD',fontWeight:600,color:'var(--navy)'}}>NET WORTH</td></tr>
            <tr><td><b>Net worth</b></td><td className="num" style={{fontWeight:700,color:'var(--navy)',fontSize:16}}>{fmtMoney(netWorth)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

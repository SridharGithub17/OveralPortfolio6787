import React from 'react';
import { fmtMoney, fmtPct, calcOhio } from './calculations.js';
import { KPI } from './KPI.jsx';
import { Field } from './BasicComponents.jsx';

const OHIO_MARKETS = [
  {city:'Cincinnati', median:279000, yieldPct:'8.5%', trend:'Strong demand', cap:'7-9%',
    thesis:'RentCafe #1 hottest rental market into 2026; 81% YoY apartment demand jump. Multifamily play.'},
  {city:'Columbus', median:285000, yieldPct:'9.0%', trend:'+5-7%', cap:'8-10%',
    thesis:'$20B Intel semiconductor project drives jobs, talent, housing demand. Balanced yield + low vacancy.'},
  {city:'Cleveland', median:150000, yieldPct:'11.3%', trend:'Stable', cap:'10-13%',
    thesis:'Highest rent-to-yield ratio in the state. Best cash flow city. Watch neighborhood-level risk.'},
  {city:'Toledo', median:150000, yieldPct:'9.5%', trend:'+13.1% forecast', cap:'9-12%',
    thesis:'Projected to lead Ohio in price growth. Affordability + demand. Underpriced market.'},
  {city:'Dayton', median:133000, yieldPct:'10.5%', trend:'Stable', cap:'9-12%',
    thesis:'"Cash Flow Capital" — most affordable Ohio entry. Strong 1% rule territory.'}
];
const STATUSES = ['Watching','Touring','Offer','Won','Lost'];

export const Ohio = ({ohio, setOhio, settings}) => {
  const update = (i,k,v) => { const n=[...ohio]; n[i]={...n[i],[k]:v}; setOhio(n); };
  const add = () => setOhio([...ohio, {status:'Watching',address:'',city:'Cleveland',price:0,rent:0,dpct:0.25,term:30,rate:settings.marketRate30}]);
  const del = i => { const n=[...ohio]; n.splice(i,1); setOhio(n); };

  return (
    <div>
      <h2>Ohio Pipeline</h2>
      <div className="card">
        <h3>Top Ohio markets · May 2026</h3>
        {OHIO_MARKETS.map(m=>(
          <div className="city-card" key={m.city}>
            <div className="name">{m.city}</div>
            <div className="stats">
              <span>Median <b>{fmtMoney(m.median)}</b></span>
              <span>Yield <b>{m.yieldPct}</b></span>
              <span>Cap <b>{m.cap}</b></span>
              <span>Trend <b>{m.trend}</b></span>
            </div>
            <div className="small">{m.thesis}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Deal evaluation framework</h3>
        <ul className="checklist">
          <li><b>1% rule:</b> Monthly rent ≥ 1% of purchase price.</li>
          <li><b>Cap rate:</b> NOI ÷ price. Target 8%+ in Ohio.</li>
          <li><b>Cash-on-cash:</b> Annual CF ÷ cash invested. Target 10%+.</li>
          <li><b>GRM:</b> Price ÷ annual rent. 6-9 is solid.</li>
          <li><b>Reserves:</b> 3-6 mo mortgage + 1% of value/yr for capex.</li>
        </ul>
      </div>

      <div className="toolbar">
        <button className="primary" onClick={add}>+ Add prospect</button>
        <span className="small">Score = 40·(cap÷target) + 40·(CoC÷target) + 20·(rent÷price÷1%).</span>
      </div>

      {ohio.length === 0
        ? <div className="card empty">No prospects yet.</div>
        : ohio.map((o,i)=>{
            const c = calcOhio(o, settings);
            const scoreColor = c.score>=85?'var(--green)':c.score>=70?'var(--amber)':'var(--red)';
            const scoreBg = c.score>=85?'var(--green-bg)':c.score>=70?'var(--amber-bg)':'var(--red-bg)';
            return (
              <details key={i}>
                <summary>
                  <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <span className={`pill ${o.status==='Won'?'pill-green':o.status==='Offer'?'pill-amber':o.status==='Lost'?'pill-red':'pill-gray'}`}>{o.status}</span>{' '}
                    {o.address||'(unnamed)'} · {o.city}
                  </span>
                  <span className="badge-score" style={{background:scoreBg,color:scoreColor}}>{c.score}</span>
                </summary>
                <div>
                  <div className="row cols-3">
                    <Field label="Status" value={o.status} onChange={v=>update(i,'status',v)} options={STATUSES} />
                    <Field label="Address" value={o.address} onChange={v=>update(i,'address',v)} />
                    <Field label="City" value={o.city} onChange={v=>update(i,'city',v)} />
                  </div>
                  <div className="row cols-3">
                    <Field label="Price ($)" type="number" value={o.price} onChange={v=>update(i,'price',v)} />
                    <Field label="Rent (mo)" type="number" value={o.rent} onChange={v=>update(i,'rent',v)} />
                    <Field label="Annual tax" type="number" value={o.tax} onChange={v=>update(i,'tax',v)} />
                  </div>
                  <div className="row cols-3">
                    <Field label="Annual ins" type="number" value={o.ins} onChange={v=>update(i,'ins',v)} />
                    <Field label="Mgmt+repairs/yr" type="number" value={o.opex} onChange={v=>update(i,'opex',v)} />
                    <Field label="Down %" type="number" step="0.01" value={o.dpct} onChange={v=>update(i,'dpct',v)} />
                  </div>
                  <div className="row cols-3">
                    <Field label="Loan rate" type="number" step="0.0001" value={o.rate} onChange={v=>update(i,'rate',v)} />
                    <Field label="Term (yr)" type="number" value={o.term} onChange={v=>update(i,'term',v)} />
                    <Field label="Notes" value={o.notes} onChange={v=>update(i,'notes',v)} />
                  </div>
                  <div className="grid">
                    <KPI label="1% Rule" value={(c.onePct*100).toFixed(2)+'%'} />
                    <KPI label="Cap Rate" value={fmtPct(c.capRate)} />
                    <KPI label="Cash-on-Cash" value={fmtPct(c.coc)} />
                    <KPI label="Annual CF" value={fmtMoney(c.annualCF)} valueColor={c.annualCF<0?'var(--red)':null} />
                    <KPI label="Down cash" value={fmtMoney(c.downCash)} />
                    <KPI label="Mo P&I" value={fmtMoney(c.monthlyPI)} />
                  </div>
                  <div style={{textAlign:'right',marginTop:8}}>
                    <button className="ghost" onClick={()=>del(i)} style={{color:'var(--red)',borderColor:'var(--red)'}}>Delete</button>
                  </div>
                </div>
              </details>
            );
          })}
    </div>
  );
};

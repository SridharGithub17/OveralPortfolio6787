import React from 'react';
import { fmtMoney, fmtPct, calcProperty, refiPill } from './calculations.js';

export const Refi = ({props, settings}) => (
  <div>
    <h2>Refinance Analyzer</h2>
    <div className="card small">
      Uses Settings (current 30-yr rate <b>{fmtPct(settings.marketRate30)}</b>, closing cost <b>{fmtPct(settings.refiCostPct)}</b>, threshold <b>{fmtMoney(settings.refiThreshold)}/mo</b>).{' '}
      <span className="pill pill-green">REFI NOW</span> meaningful drop + break-even ≤24 mo ·{' '}
      <span className="pill pill-amber">Refi if staying long</span> savings exist but slow ·{' '}
      <span className="pill pill-red">Skip</span> no benefit.
    </div>
    {props.length === 0
      ? <div className="card empty">Add properties to analyze refi options.</div>
      : <div className="card" style={{padding:8}}>
          <table className="responsive">
            <thead><tr>
              <th>Property</th><th>Balance</th><th>Curr</th><th>Curr P&I</th>
              <th>Mkt</th><th>New P&I</th><th>Save/mo</th><th>Closing</th><th>BE (mo)</th><th>Decision</th>
            </tr></thead>
            <tbody>{props.map((p,i)=>{
              const c = calcProperty(p,settings);
              return (
                <tr key={i}>
                  <td data-l="Property">{p.nickname||p.address||'—'}</td>
                  <td data-l="Balance" className="num">{fmtMoney(c.mort)}</td>
                  <td data-l="Curr rate" className="num">{fmtPct(+p.rate||0)}</td>
                  <td data-l="Curr P&I" className="num">{fmtMoney(+p.pi||0)}</td>
                  <td data-l="Mkt rate" className="num">{fmtPct(settings.marketRate30)}</td>
                  <td data-l="New P&I" className="num">{fmtMoney(c.newPI)}</td>
                  <td data-l="Save/mo" className="num" style={{color:c.moSavings>0?'var(--green)':'var(--red)'}}>{fmtMoney(c.moSavings)}</td>
                  <td data-l="Closing" className="num">{fmtMoney(c.closingCost)}</td>
                  <td data-l="Break-even" className="num">{c.breakEven?c.breakEven.toFixed(1):'—'}</td>
                  <td data-l="Decision"><span className={`pill ${refiPill(c.refiDecision)}`}>{c.refiDecision}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>}
  </div>
);

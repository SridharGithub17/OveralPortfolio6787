import React from 'react';

export const KPI = ({label, value, sub, valueColor}) => (
  <div className="kpi">
    <div className="label">{label}</div>
    <div className="value" style={valueColor?{color:valueColor}:null}>{value}</div>
    {sub && <div className="sub">{sub}</div>}
  </div>
);

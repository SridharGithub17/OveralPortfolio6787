import React, { useMemo, useState } from 'react';
import { fmtMoney, fmtPct, fmtPct1, calcProperty, refiPill } from './calculations.js';
import { KPI } from './KPI.jsx';
import { Field } from './BasicComponents.jsx';

const createProperty = () => ({
  nickname: 'New Property',
  address: '',
  city: '',
  state: 'OH',
  type: '',
  value: 0,
  mortgage: 0,
  rate: 0.06,
  yrsLeft: 30,
  pi: 0,
  taxIns: 0,
  hoa: 0,
  rent: 0,
  opex: 0,
});

const getPropertyTitle = (property) => property.nickname || property.address || 'New property';

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const PropertyList = ({ props, settings, onSelect, onAdd }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>My Properties</h2>
          <div className="small" style={{ marginTop: 4 }}>Select a property to open its detail page.</div>
        </div>
        <button className="primary" onClick={onAdd}>+ Add property</button>
      </div>

      {props.length === 0 ? (
        <div className="card empty">No properties yet. Tap + Add property.</div>
      ) : (
        <div className="grid">
          {props.map((property, index) => {
            const metrics = calcProperty(property, settings);

            return (
              <button
                key={index}
                type="button"
                className="card"
                onClick={() => onSelect(index)}
                style={{ textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{getPropertyTitle(property)}</h3>
                    <div className="small" style={{ marginTop: 4 }}>
                      {[property.address, property.city, property.state].filter(Boolean).join(', ') || 'No address added yet'}
                    </div>
                  </div>
                  <span className={`pill ${refiPill(metrics.refiDecision)}`}>{metrics.refiDecision}</span>
                </div>

                <div className="grid">
                  <KPI label="Equity" value={fmtMoney(metrics.equity)} sub={`LTV ${fmtPct1(metrics.ltv)}`} />
                  <KPI label="Monthly Cash Flow" value={fmtMoney(metrics.netCF)} valueColor={metrics.netCF < 0 ? 'var(--red)' : 'var(--green)'} />
                  <KPI label="Annual NOI" value={fmtMoney(metrics.annualNOI)} />
                  <KPI label="Cap Rate" value={fmtPct(metrics.capRate)} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PropertyDetail = ({ property, index, settings, onBack, onChange, onDelete }) => {
  const metrics = useMemo(() => calcProperty(property, settings), [property, settings]);

  const setField = (key, value, type = 'text') => {
    const nextValue = type === 'number' ? toNumber(value) : value;
    onChange(index, key, nextValue);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <button className="ghost" onClick={onBack} style={{ marginBottom: 12 }}>← Back to properties</button>
          <h2 style={{ margin: 0 }}>{getPropertyTitle(property)}</h2>
          <div className="small" style={{ marginTop: 4 }}>Property details page</div>
        </div>
        <button className="ghost" onClick={() => onDelete(index)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>Delete</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Property information</h3>
        <div className="row">
          <Field label="Nickname" value={property.nickname} onChange={(value) => setField('nickname', value)} />
          <Field label="Address" value={property.address} onChange={(value) => setField('address', value)} />
          <Field label="City" value={property.city} onChange={(value) => setField('city', value)} />
          <Field label="State" value={property.state} onChange={(value) => setField('state', value)} />
          <Field label="Type" value={property.type} onChange={(value) => setField('type', value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Loan and value</h3>
        <div className="row">
          <Field label="Current value ($)" type="number" value={property.value} onChange={(value) => setField('value', value, 'number')} />
          <Field label="Mortgage balance ($)" type="number" value={property.mortgage} onChange={(value) => setField('mortgage', value, 'number')} />
          <Field label="Loan rate (e.g. 0.0625)" type="number" step="0.0001" value={property.rate} onChange={(value) => setField('rate', value, 'number')} />
          <Field label="Yrs remaining" type="number" value={property.yrsLeft} onChange={(value) => setField('yrsLeft', value, 'number')} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Monthly income and expenses</h3>
        <div className="row">
          <Field label="Monthly P&I" type="number" value={property.pi} onChange={(value) => setField('pi', value, 'number')} />
          <Field label="Tax + Ins (mo)" type="number" value={property.taxIns} onChange={(value) => setField('taxIns', value, 'number')} />
          <Field label="HOA (mo)" type="number" value={property.hoa} onChange={(value) => setField('hoa', value, 'number')} />
          <Field label="Rent (mo)" type="number" value={property.rent} onChange={(value) => setField('rent', value, 'number')} />
          <Field label="Op exp avg (mo)" type="number" value={property.opex} onChange={(value) => setField('opex', value, 'number')} />
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <KPI label="Equity" value={fmtMoney(metrics.equity)} sub={`LTV ${fmtPct1(metrics.ltv)}`} />
        <KPI label="Mo CF" value={fmtMoney(metrics.netCF)} valueColor={metrics.netCF < 0 ? 'var(--red)' : 'var(--green)'} />
        <KPI label="Annual NOI" value={fmtMoney(metrics.annualNOI)} />
        <KPI label="Cap Rate" value={fmtPct(metrics.capRate)} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Refinance snapshot</h3>
        <div className="small">
          Refi: <span className={`pill ${refiPill(metrics.refiDecision)}`}>{metrics.refiDecision}</span>
          {metrics.moSavings > 0 && ` · Save ${fmtMoney(metrics.moSavings)}/mo`}
        </div>
      </div>
    </div>
  );
};

export const Properties = ({ props, setProps, settings }) => {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const update = (index, key, value) => {
    const next = [...props];
    next[index] = { ...next[index], [key]: value };
    setProps(next);
  };

  const add = () => {
    const next = [...props, createProperty()];
    setProps(next);
    setSelectedIndex(next.length - 1);
  };

  const del = (index) => {
    if (window.confirm('Delete this property?')) {
      const next = [...props];
      next.splice(index, 1);
      setProps(next);
      setSelectedIndex(null);
    }
  };

  if (selectedIndex !== null && props[selectedIndex]) {
    return (
      <PropertyDetail
        property={props[selectedIndex]}
        index={selectedIndex}
        settings={settings}
        onBack={() => setSelectedIndex(null)}
        onChange={update}
        onDelete={del}
      />
    );
  }

  return <PropertyList props={props} settings={settings} onSelect={setSelectedIndex} onAdd={add} />;
};

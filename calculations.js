export const fmtMoney = n => (n==null||isNaN(n)) ? '—' : (n<0?'($'+Math.abs(Math.round(n)).toLocaleString()+')':'$'+Math.round(n).toLocaleString());
export const fmtPct = n => (n==null||isNaN(n)) ? '—' : (n*100).toFixed(2)+'%';
export const fmtPct1 = n => (n==null||isNaN(n)) ? '—' : (n*100).toFixed(1)+'%';
export const todayISO = () => new Date().toISOString().slice(0,10);
export const daysBetween = (a,b) => Math.round((new Date(a)-new Date(b))/86400000);
export const pmt = (rate, nper, pv) => rate===0 ? -pv/nper : -(pv*rate)/(1-Math.pow(1+rate,-nper));

export const calcProperty = (p, settings) => {
  const value = +p.value || 0, mort = +p.mortgage || 0;
  const equity = value - mort;
  const ltv = value > 0 ? mort/value : 0;
  const rent = +p.rent || 0;
  const eff = rent * (1 - settings.vacancyPct);
  const mgmt = rent * settings.mgmtPct;
  const pi = +p.pi || 0, taxIns = +p.taxIns || 0, hoa = +p.hoa || 0, opex = +p.opex || 0;
  const netCF = eff - pi - taxIns - hoa - opex - mgmt;
  const annualNOI = (eff - taxIns - hoa - opex - mgmt) * 12;
  const capRate = value > 0 ? annualNOI/value : 0;
  const currRate = +p.rate || 0;
  const newTerm = +p.newTerm || 30;
  const newPI = mort > 0 ? -pmt(settings.marketRate30/12, newTerm*12, mort) : 0;
  const moSavings = pi - newPI;
  const closingCost = mort * settings.refiCostPct;
  const breakEven = moSavings > 0 ? closingCost/moSavings : null;
  let refiDecision;
  if(currRate - settings.marketRate30 < 0.005) refiDecision = 'Skip - rate already low';
  else if(moSavings <= 0) refiDecision = 'Skip - no savings';
  else if(moSavings >= settings.refiThreshold && breakEven <= 24) refiDecision = 'REFI NOW';
  else if(moSavings >= settings.refiThreshold) refiDecision = 'Refi if staying long';
  else refiDecision = 'Below threshold';
  return { value, mort, equity, ltv, eff, mgmt, netCF, annualNOI, capRate,
    newPI, moSavings, closingCost, breakEven, refiDecision };
};

export const calcOhio = (o, settings) => {
  const price = +o.price || 0, rent = +o.rent || 0;
  const tax = +o.tax || 0, ins = +o.ins || 0, opex = +o.opex || 0;
  const dpct = +o.dpct || 0.25;
  const rate = +o.rate || settings.marketRate30;
  const term = +o.term || 30;
  const grm = rent > 0 ? price/(rent*12) : null;
  const onePct = price > 0 ? rent/price : 0;
  const noi = rent*12*(1 - settings.vacancyPct) - tax - ins - opex;
  const capRate = price > 0 ? noi/price : 0;
  const downCash = price * dpct;
  const loan = price - downCash;
  const monthlyPI = loan > 0 ? -pmt(rate/12, term*12, loan) : 0;
  const annualCF = noi - monthlyPI*12;
  const coc = downCash > 0 ? annualCF/downCash : 0;
  const score = Math.round(
    Math.min(40, Math.max(0, capRate/settings.targetCap*40)) +
    Math.min(40, Math.max(0, coc/settings.targetCoC*40)) +
    Math.min(20, Math.max(0, onePct/0.01*20))
  );
  return { grm, onePct, noi, capRate, downCash, loan, monthlyPI, annualCF, coc, score };
};

export const maintStatus = item => {
  if(!item.lastDate || !item.lifespan) return {label:'—', cls:'pill-gray', nextDue:null};
  const next = new Date(item.lastDate);
  next.setFullYear(next.getFullYear() + (+item.lifespan));
  const days = daysBetween(next, new Date());
  const nextDue = next.toISOString().slice(0,10);
  if(days < 0) return {label:'Overdue', cls:'pill-red', nextDue};
  if(days <= 60) return {label:'Due 60d', cls:'pill-amber', nextDue};
  return {label:'OK', cls:'pill-green', nextDue};
};

export const refiPill = d => d==='REFI NOW'?'pill-green' : d==='Refi if staying long'?'pill-amber' :
  d==='Skip - rate already low'?'pill-gray' : 'pill-red';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Storage & crypto
import { KEYS, DEFAULT_SETTINGS, DEFAULT_FINANCES, load, save, VAULT_KEY, MODE_KEY, collectExistingPlain, wipePlainKeys, deriveKey, encryptObj, decryptObj, saveVault, unlockVault, createVault } from './storage.js';
import { fmtMoney, fmtPct, calcProperty } from './calculations.js';

// Components
import { Header, TABS, SideNav, BottomNav, Field } from './BasicComponents.jsx';
import { KPI } from './KPI.jsx';
import { Overview } from './Overview.jsx';
import { Properties } from './Properties.jsx';
import { Maint } from './Maint.jsx';
import { Expenses } from './Expenses.jsx';
import { Refi } from './Refi.jsx';
import { Ohio } from './Ohio.jsx';
import { Finances } from './Finances.jsx';
import { NetWorth } from './NetWorth.jsx';
import { SettingsTab } from './SettingsTab.jsx';
import { LockScreen } from './LockScreen.jsx';

export default function App(){
  const [mode, setMode] = useState('loading'); // loading | setup | locked | unlocked | plain
  const [cryptoKey, setCryptoKey] = useState(null);
  const [salt, setSalt] = useState(null);
  const [unlockErr, setUnlockErr] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  const [tab, setTab] = useState('overview');
  const [props, setProps] = useState([]);
  const [maint, setMaint] = useState([]);
  const [exp, setExp] = useState([]);
  const [ohio, setOhio] = useState([]);
  const [finances, setFinances] = useState(DEFAULT_FINANCES);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState('saved');

  // First-time mode determination
  useEffect(() => {
    const hasVault = !!localStorage.getItem(VAULT_KEY);
    const lockMode = localStorage.getItem(MODE_KEY);
    if(hasVault){ setMode('locked'); return; }
    if(lockMode === 'plain'){
      const d = collectExistingPlain();
      setProps(d.props||[]); setMaint(d.maint||[]); setExp(d.exp||[]); setOhio(d.ohio||[]);
      setFinances({...DEFAULT_FINANCES, ...(d.finances||{})});
      setSettings({...DEFAULT_SETTINGS, ...(d.settings||{}), netWorthTargets:{...DEFAULT_SETTINGS.netWorthTargets, ...((d.settings||{}).netWorthTargets||{})}});
      setMode('plain'); return;
    }
    setMode('setup');
  }, []);

  // Detect changes → mark unsaved
  useEffect(() => {
    if(mode !== 'plain' && mode !== 'unlocked') return;
    setSaveStatus('unsaved');
  }, [props, maint, exp, ohio, finances, settings]);

  // Debounced auto-save
  useEffect(() => {
    if(saveStatus !== 'unsaved') return;
    const t = setTimeout(() => { doSave(); }, 1200);
    return () => clearTimeout(t);
  }, [saveStatus, props, maint, exp, ohio, finances, settings, mode, cryptoKey, salt]);

  const doSave = async () => {
    if(mode === 'plain'){
      try {
        setSaveStatus('saving');
        save(KEYS.props, props); save(KEYS.maint, maint); save(KEYS.exp, exp);
        save(KEYS.ohio, ohio); save(KEYS.finances, finances); save(KEYS.settings, settings);
        setSaveStatus('saved');
      } catch(e){ setSaveStatus('error'); }
    } else if(mode === 'unlocked' && cryptoKey && salt){
      try {
        setSaveStatus('saving');
        await saveVault(cryptoKey, salt, {props, maint, exp, ohio, finances, settings});
        setSaveStatus('saved');
      } catch(e){ console.error('vault save failed', e); setSaveStatus('error'); }
    }
  };

  // Lock handlers
  const handleUnlock = async (password) => {
    setUnlockErr(''); setUnlockBusy(true);
    try {
      const r = await unlockVault(password);
      const d = r.data || {};
      setProps(d.props||[]); setMaint(d.maint||[]); setExp(d.exp||[]); setOhio(d.ohio||[]);
      setFinances({...DEFAULT_FINANCES, ...(d.finances||{})});
      setSettings({...DEFAULT_SETTINGS, ...(d.settings||{}), netWorthTargets:{...DEFAULT_SETTINGS.netWorthTargets, ...((d.settings||{}).netWorthTargets||{})}});
      setCryptoKey(r.key); setSalt(r.salt);
      setMode('unlocked'); setTab('overview');
    } catch(e){ setUnlockErr('Wrong password — try again.'); }
    finally { setUnlockBusy(false); }
  };

  const handleSetup = async (password) => {
    setUnlockBusy(true);
    try {
      const existing = collectExistingPlain();
      const data = {
        props: existing.props||[], maint: existing.maint||[], exp: existing.exp||[],
        ohio: existing.ohio||[], finances: {...DEFAULT_FINANCES, ...(existing.finances||{})},
        settings: {...DEFAULT_SETTINGS, ...(existing.settings||{}), netWorthTargets:{...DEFAULT_SETTINGS.netWorthTargets, ...((existing.settings||{}).netWorthTargets||{})}}
      };
      const {key, salt: newSalt} = await createVault(password, data);
      wipePlainKeys();
      setCryptoKey(key); setSalt(newSalt);
      localStorage.setItem(MODE_KEY, 'encrypted');
      setProps(data.props); setMaint(data.maint); setExp(data.exp); setOhio(data.ohio);
      setFinances(data.finances); setSettings(data.settings);
      setMode('unlocked'); setTab('overview');
    } catch(e){ setUnlockErr('Setup failed: '+e.message); }
    finally { setUnlockBusy(false); }
  };

  const handleSkip = () => {
    localStorage.setItem(MODE_KEY, 'plain');
    const d = collectExistingPlain();
    setProps(d.props||[]); setMaint(d.maint||[]); setExp(d.exp||[]); setOhio(d.ohio||[]);
    setFinances({...DEFAULT_FINANCES, ...(d.finances||{})});
    setSettings({...DEFAULT_SETTINGS, ...(d.settings||{}), netWorthTargets:{...DEFAULT_SETTINGS.netWorthTargets, ...((d.settings||{}).netWorthTargets||{})}});
    setMode('plain'); setTab('overview');
  };

  const handleReset = () => {
    if(window.confirm('Erase all data and start over? This cannot be undone.')){
      localStorage.clear();
      setProps([]); setMaint([]); setExp([]); setOhio([]);
      setFinances(DEFAULT_FINANCES); setSettings(DEFAULT_SETTINGS);
      setCryptoKey(null); setSalt(null);
      setMode('setup');
    }
  };

  // Excel/JSON export/import
  const exportData = () => {
    const blob = new Blob([JSON.stringify({props, maint, exp, ohio, finances, settings}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'portfolio-backup.json';
    a.click(); URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setProps(data.props||[]); setMaint(data.maint||[]); setExp(data.exp||[]); setOhio(data.ohio||[]);
        setFinances(data.finances||DEFAULT_FINANCES); setSettings(data.settings||DEFAULT_SETTINGS);
      } catch(e){ alert('Failed to import: '+e.message); }
    };
    reader.readAsText(file);
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(props), 'Properties');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maint), 'Maintenance');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exp), 'Expenses');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ohio), 'Ohio');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.savings||[]), 'Savings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.investments||[]), 'Investments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.retirement||[]), 'Retirement');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.metals||[]), 'Metals');
    XLSX.writeFile(wb, 'portfolio-export.xlsx');
  };

  const importXLSX = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, {type:'array'});
        const newProps = XLSX.utils.sheet_to_json(wb.Sheets['Properties']||[]) || [];
        const newMaint = XLSX.utils.sheet_to_json(wb.Sheets['Maintenance']||[]) || [];
        const newExp = XLSX.utils.sheet_to_json(wb.Sheets['Expenses']||[]) || [];
        const newOhio = XLSX.utils.sheet_to_json(wb.Sheets['Ohio']||[]) || [];
        const newSavings = XLSX.utils.sheet_to_json(wb.Sheets['Savings']||[]) || [];
        const newInv = XLSX.utils.sheet_to_json(wb.Sheets['Investments']||[]) || [];
        const newRet = XLSX.utils.sheet_to_json(wb.Sheets['Retirement']||[]) || [];
        const newMet = XLSX.utils.sheet_to_json(wb.Sheets['Metals']||[]) || [];
        setProps(newProps); setMaint(newMaint); setExp(newExp); setOhio(newOhio);
        setFinances({savings: newSavings, investments: newInv, retirement: newRet, metals: newMet});
      } catch(e){ alert('Failed to import Excel: '+e.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSamples = () => {
    if(window.confirm('Load sample data? This will overwrite current data.')){
      setProps([
        {nickname:'Rental 1', address:'123 Oak St', city:'Cleveland', state:'OH', type:'Duplex', value:180000, mortgage:135000, rate:0.045, yrsLeft:25, pi:680, taxIns:200, hoa:0, rent:1200, opex:150}
      ]);
      setMaint([]);
      setExp([]);
      setOhio([]);
      setFinances({savings:[{institution:'Chase',type:'Checking',balance:50000,apy:0.04}], investments:[], retirement:[], metals:[]});
    }
  };

  const resetAll = () => {
    if(window.confirm('Reset all data? This cannot be undone.')){
      localStorage.clear();
      setProps([]); setMaint([]); setExp([]); setOhio([]);
      setFinances(DEFAULT_FINANCES); setSettings(DEFAULT_SETTINGS);
      setCryptoKey(null); setSalt(null);
      setMode('setup');
    }
  };

  // Render based on mode
  if(mode === 'loading') return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>;
  if(mode === 'setup' || mode === 'locked')
    return <LockScreen mode={mode} onUnlock={handleUnlock} onSetup={handleSetup} onSkip={handleSkip} onReset={handleReset} error={unlockErr} busy={unlockBusy} />;

  // Main app
  const renderTab = () => {
    switch(tab){
      case 'overview': return <Overview props={props} maint={maint} finances={finances} settings={settings} setTab={setTab} />;
      case 'properties': return <Properties props={props} setProps={setProps} settings={settings} />;
      case 'maint': return <Maint maint={maint} setMaint={setMaint} props={props} />;
      case 'expenses': return <Expenses exp={exp} setExp={setExp} props={props} />;
      case 'refi': return <Refi props={props} settings={settings} />;
      case 'ohio': return <Ohio ohio={ohio} setOhio={setOhio} settings={settings} />;
      case 'finances': return <Finances finances={finances} setFinances={setFinances} />;
      case 'networth': return <NetWorth props={props} finances={finances} settings={settings} />;
      case 'settings': return <SettingsTab settings={settings} setSettings={setSettings} exportData={exportData} importData={importData} exportXLSX={exportXLSX} importXLSX={importXLSX} loadSamples={loadSamples} resetAll={resetAll} mode={mode} onLock={()=>{}} onEnableEncryption={()=>{}} onChangePassword={()=>{}} />;
      default: return null;
    }
  };

  return (
    <div id="root-inner" style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
      <Header />
      <div className="layout">
        <SideNav tab={tab} setTab={setTab} />
        <main>
          {saveStatus === 'saving' && <div style={{position:'fixed',top:10,right:10,fontSize:12,color:'#666'}}>Saving…</div>}
          {saveStatus === 'error' && <div style={{position:'fixed',top:10,right:10,fontSize:12,color:'red'}}>Save failed</div>}
          {renderTab()}
        </main>
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

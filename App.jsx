import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

import {
  DEFAULT_SETTINGS,
  DEFAULT_FINANCES,
  fetchState,
  fetchBaselaneExpenses,
  backupDatabase,
  importBaselaneCsv,
  persistState,
  resetState,
  DEFAULT_STATE,
  normalizeState,
  mergeSettings,
  migrateLegacyBrowserDataIfNeeded,
  saveVault,
  unlockVault,
  createVault,
} from './storage.js';
import { Header, SideNav, BottomNav } from './BasicComponents.jsx';
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

export default function App() {
  const [mode, setMode] = useState('loading');
  const [authMode, setAuthMode] = useState('login');
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
  const [backendState, setBackendState] = useState(DEFAULT_STATE);
  const [baselaneExpenses, setBaselaneExpenses] = useState([]);
  const [baselaneReport, setBaselaneReport] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const migration = await migrateLegacyBrowserDataIfNeeded();
        const state = migration.state || await fetchState();
        setBackendState(state);

        if (state.mode === 'encrypted' && state.vault) {
          setAuthMode('login');
          setMode('locked');
          return;
        }

        setProps(state.props || []);
        setMaint(state.maint || []);
        setExp(state.exp || []);
        setOhio(state.ohio || []);
        setFinances({ ...DEFAULT_FINANCES, ...(state.finances || {}) });
        setSettings(mergeSettings(state.settings));
        const baselaneData = await fetchBaselaneExpenses();
        setBaselaneExpenses(baselaneData.records || []);
        setBaselaneReport(baselaneData.report || null);
        setAuthMode('signup');
        setMode('plain');
      } catch (e) {
        console.error('Failed to load backend state', e);
        setUnlockErr('Failed to connect to SQLite backend. Start the backend server.');
        setMode('setup');
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (mode !== 'plain' && mode !== 'unlocked') return;
    setSaveStatus('unsaved');
  }, [props, maint, exp, ohio, finances, settings, mode]);

  useEffect(() => {
    if (saveStatus !== 'unsaved') return;
    const t = setTimeout(() => {
      void doSave();
    }, 1200);
    return () => clearTimeout(t);
  }, [saveStatus, props, maint, exp, ohio, finances, settings, mode, cryptoKey, salt]);

  const doSave = async () => {
    if (mode === 'plain') {
      try {
        setSaveStatus('saving');
        const nextState = await persistState({
          ...backendState,
          mode: 'plain',
          vault: null,
          props,
          maint,
          exp,
          ohio,
          finances,
          settings,
        });
        setBackendState(nextState);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
      return;
    }

    if (mode === 'unlocked' && cryptoKey && salt) {
      try {
        setSaveStatus('saving');
        const nextState = await saveVault(cryptoKey, salt, { props, maint, exp, ohio, finances, settings }, backendState);
        setBackendState(nextState);
        setSaveStatus('saved');
      } catch (e) {
        console.error('vault save failed', e);
        setSaveStatus('error');
      }
    }
  };

  const handleUnlock = async (password, username) => {
    setAuthMode('login');
    setUnlockErr('');
    setUnlockBusy(true);
    try {
      const state = await fetchState();
      setBackendState(state);
      const r = await unlockVault(password, state);
      const d = r?.data || {};
      setProps(d.props || []);
      setMaint(d.maint || []);
      setExp(d.exp || []);
      setOhio(d.ohio || []);
      setFinances({ ...DEFAULT_FINANCES, ...(d.finances || {}) });
      setSettings(mergeSettings(d.settings));
      setCryptoKey(r.key);
      setSalt(r.salt);
      setMode('unlocked');
      setTab('overview');
    } catch {
      setUnlockErr('Wrong password — try again.');
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleSetup = async (password, username) => {
    setAuthMode('signup');
    setUnlockErr('');
    setUnlockBusy(true);
    try {
      const existing = normalizeState(await fetchState());
      setBackendState(existing);
      const data = {
        props: existing.props || [],
        maint: existing.maint || [],
        exp: existing.exp || [],
        ohio: existing.ohio || [],
        finances: { ...DEFAULT_FINANCES, ...(existing.finances || {}) },
        settings: mergeSettings(existing.settings),
      };

      const { key, salt: newSalt } = await createVault(password, data, existing);
      setCryptoKey(key);
      setSalt(newSalt);
      setProps(data.props);
      setMaint(data.maint);
      setExp(data.exp);
      setOhio(data.ohio);
      setFinances(data.finances);
      setSettings(data.settings);
        setMode('unlocked');
        setTab('overview');
      } catch (e) {
      setUnlockErr(`Setup failed: ${e.message}`);
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleSkip = () => {
    setAuthMode('signup');
    const d = backendState;
    setProps(d.props || []);
    setMaint(d.maint || []);
    setExp(d.exp || []);
    setOhio(d.ohio || []);
    setFinances({ ...DEFAULT_FINANCES, ...(d.finances || {}) });
    setSettings(mergeSettings(d.settings));
    setMode('plain');
    setTab('overview');
  };

  const handleReset = () => {
    if (window.confirm('Erase all data and start over? This cannot be undone.')) {
      void resetState().then((state) => {
        setBackendState(state);
        setProps([]);
        setMaint([]);
        setExp([]);
        setOhio([]);
        setFinances(DEFAULT_FINANCES);
        setSettings(DEFAULT_SETTINGS);
        setCryptoKey(null);
        setSalt(null);
        setMode('plain');
      }).catch(() => {
        setUnlockErr('Reset failed.');
      });
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ props, maint, exp, ohio, finances, settings }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setProps(data.props || []);
        setMaint(data.maint || []);
        setExp(data.exp || []);
        setOhio(data.ohio || []);
        setFinances({ ...DEFAULT_FINANCES, ...(data.finances || {}) });
        setSettings(mergeSettings(data.settings));
      } catch (err) {
        alert(`Failed to import: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportXLSX = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(props), 'Properties');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maint), 'Maintenance');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exp), 'Expenses');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ohio), 'Ohio');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.savings || []), 'Savings');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.investments || []), 'Investments');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.retirement || []), 'Retirement');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finances.metals || []), 'Metals');
    XLSX.writeFile(wb, 'portfolio-export.xlsx');
  };

  const importXLSX = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const readSheet = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name] || {});
        setProps(readSheet('Properties'));
        setMaint(readSheet('Maintenance'));
        setExp(readSheet('Expenses'));
        setOhio(readSheet('Ohio'));
        setFinances({
          savings: readSheet('Savings'),
          investments: readSheet('Investments'),
          retirement: readSheet('Retirement'),
          metals: readSheet('Metals'),
        });
      } catch (err) {
        alert(`Failed to import Excel: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleBackupDatabase = async () => backupDatabase();

  const loadSamples = () => {
    if (window.confirm('Load sample data? This will overwrite current data.')) {
      setProps([
        {
          nickname: 'Rental 1',
          address: '123 Oak St',
          city: 'Cleveland',
          state: 'OH',
          type: 'Duplex',
          value: 180000,
          mortgage: 135000,
          rate: 0.045,
          yrsLeft: 25,
          pi: 680,
          taxIns: 200,
          hoa: 0,
          rent: 1200,
          opex: 150,
        },
      ]);
      setMaint([]);
      setExp([]);
      setOhio([]);
      setFinances({
        savings: [{ institution: 'Chase', type: 'Checking', balance: 50000, apy: 0.04 }],
        investments: [],
        retirement: [],
        metals: [],
      });
    }
  };

  const resetAll = () => {
    if (window.confirm('Reset all data? This cannot be undone.')) {
      void resetState().then((state) => {
        setBackendState(state);
        setProps([]);
        setMaint([]);
        setExp([]);
        setOhio([]);
        setFinances(DEFAULT_FINANCES);
        setSettings(DEFAULT_SETTINGS);
        setCryptoKey(null);
        setSalt(null);
        setMode('plain');
      }).catch(() => {
        setUnlockErr('Reset failed.');
      });
    }
  };

  const handleBaselaneImport = async ({ fileName, content, importMode }) => {
    const result = await importBaselaneCsv({ fileName, content, importMode });
    setBaselaneExpenses(result.records || []);
    setBaselaneReport(result.report || null);
    setExp((prev) => {
      const importedExpenses = (result.records || []).map((record) => ({
        date: record.date,
        property: record.property,
        category: record.category || 'Other',
        vendor: record.merchant,
        description: record.description || record.notes,
        amount: Number(record.amount || 0),
      }));

      if (importMode === 'append') {
        return [...prev, ...importedExpenses];
      }

      return importedExpenses;
    });
    return result;
  };

  const lockNow = () => {
    setCryptoKey(null);
    setSalt(null);
    setUnlockErr('');
    setAuthMode('login');
    setMode('locked');
    setTab('overview');
  };

  const enableEncryption = async () => {
    const password = window.prompt('Create a password to encrypt your portfolio data:');
    if (!password) return;

    setUnlockErr('');
    setUnlockBusy(true);
    try {
      const data = { props, maint, exp, ohio, finances, settings };
      const { key, salt: newSalt } = await createVault(password, data, backendState);
      setCryptoKey(key);
      setSalt(newSalt);
      setMode('unlocked');
      setBackendState(await fetchState());
    } catch (err) {
      setUnlockErr(`Encryption setup failed: ${err.message}`);
    } finally {
      setUnlockBusy(false);
    }
  };

  const changePassword = async () => {
    const password = window.prompt('Enter a new password for your encrypted vault:');
    if (!password) return;

    setUnlockErr('');
    setUnlockBusy(true);
    try {
      const data = { props, maint, exp, ohio, finances, settings };
      const { key, salt: newSalt } = await createVault(password, data, backendState);
      setCryptoKey(key);
      setSalt(newSalt);
      setMode('unlocked');
      setSaveStatus('saved');
      setBackendState(await fetchState());
    } catch (err) {
      setUnlockErr(`Password change failed: ${err.message}`);
    } finally {
      setUnlockBusy(false);
    }
  };

  if (mode === 'loading') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>;
  }

  if (mode === 'setup' || mode === 'locked') {
    return (
      <LockScreen
        mode={mode}
        authMode={authMode}
        onUnlock={handleUnlock}
        onSetup={handleSetup}
        onSkip={handleSkip}
        onReset={handleReset}
        error={unlockErr}
        busy={unlockBusy}
      />
    );
  }

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return <Overview props={props} maint={maint} finances={finances} settings={settings} setTab={setTab} />;
      case 'properties':
        return <Properties props={props} setProps={setProps} settings={settings} />;
      case 'maint':
        return <Maint maint={maint} setMaint={setMaint} props={props} />;
      case 'expenses':
        return (
          <Expenses
            exp={exp}
            setExp={setExp}
            props={props}
            baselaneExpenses={baselaneExpenses}
            baselaneReport={baselaneReport}
            onImportBaselaneCsv={handleBaselaneImport}
          />
        );
      case 'refi':
        return <Refi props={props} settings={settings} />;
      case 'ohio':
        return <Ohio ohio={ohio} setOhio={setOhio} settings={settings} />;
      case 'finances':
        return <Finances finances={finances} setFinances={setFinances} />;
      case 'networth':
        return <NetWorth props={props} finances={finances} settings={settings} />;
      case 'settings':
        return (
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            exportData={exportData}
            importData={importData}
            exportXLSX={exportXLSX}
            importXLSX={importXLSX}
            onBackupDatabase={handleBackupDatabase}
            loadSamples={loadSamples}
            resetAll={resetAll}
            mode={mode}
            onLock={lockNow}
            onEnableEncryption={enableEncryption}
            onChangePassword={changePassword}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div id="root-inner" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onSignOut={lockNow} showSignOut={mode === 'unlocked'} />
      <div className="layout">
        <SideNav tab={tab} setTab={setTab} />
        <main>
          {unlockErr && <div style={{ marginBottom: 12, color: 'var(--red)' }}>{unlockErr}</div>}
          {saveStatus === 'saving' && <div style={{ position: 'fixed', top: 10, right: 10, fontSize: 12, color: '#666' }}>Saving…</div>}
          {saveStatus === 'error' && <div style={{ position: 'fixed', top: 10, right: 10, fontSize: 12, color: 'red' }}>Save failed</div>}
          {renderTab()}
        </main>
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

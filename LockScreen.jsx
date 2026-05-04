import React, { useState } from 'react';

const lockStyle = {
  wrap:{minHeight:'100vh',background:'linear-gradient(135deg,#1F3A5F,#2E7D8F)',
    display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',
    paddingTop:'calc(20px + env(safe-area-inset-top, 0px))',
    paddingBottom:'calc(20px + env(safe-area-inset-bottom, 0px))'},
  card:{background:'#fff',borderRadius:14,padding:'28px 22px',width:'100%',maxWidth:380,
    boxShadow:'0 10px 30px rgba(0,0,0,.25)'},
  icon:{fontSize:36,textAlign:'center',marginBottom:8},
  title:{margin:'0 0 4px',color:'#1F3A5F',fontSize:22,textAlign:'center',fontWeight:600},
  sub:{margin:'0 0 22px',color:'#5C6B7A',fontSize:13,textAlign:'center'},
  group:{marginBottom:14},
  err:{background:'#FCE8E6',color:'#C5221F',padding:'8px 12px',borderRadius:7,
    fontSize:12,marginBottom:12,textAlign:'center'},
  btn:{width:'100%',padding:'12px',border:0,borderRadius:8,fontSize:14,fontWeight:600,
    cursor:'pointer',background:'#1F3A5F',color:'#fff',marginTop:6},
  btnGhost:{width:'100%',padding:'10px',background:'transparent',color:'#1F3A5F',
    border:'1px solid #1F3A5F',borderRadius:8,fontSize:13,cursor:'pointer',marginTop:8,fontWeight:500},
  link:{display:'block',textAlign:'center',color:'#5C6B7A',fontSize:11,marginTop:14,
    background:'none',border:0,cursor:'pointer',width:'100%'}
};

export const LockScreen = ({mode, onUnlock, onSetup, onSkip, onReset, error, busy}) => {
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [view, setView] = useState(mode === 'setup' ? 'choose' : 'unlock');

  const submit = e => {
    e && e.preventDefault();
    if(busy) return;
    if(view === 'unlock'){ onUnlock(pwd); }
    else if(view === 'create'){
      if(pwd.length < 6){ alert('Password must be at least 6 characters.'); return; }
      if(pwd !== pwd2){ alert('Passwords do not match.'); return; }
      onSetup(pwd);
    }
  };

  return (
    <div style={lockStyle.wrap}>
      <div style={lockStyle.card}>
        <div style={lockStyle.icon}>🔒</div>
        <h1 style={lockStyle.title}>Portfolio Hub</h1>

        {view === 'choose' && (
          <div>
            <p style={lockStyle.sub}>Protect your data with a password.<br/>Your numbers stay encrypted in this browser.</p>
            <button style={lockStyle.btn} onClick={()=>setView('create')}>Set up a password</button>
            <button style={lockStyle.btnGhost} onClick={onSkip}>Skip — use without protection</button>
            <p style={{...lockStyle.sub,marginTop:18,fontSize:11}}>
              Strong: password derives an AES-256 key (PBKDF2, 200k iter). Data is encrypted at rest.
              If you forget the password, data is unrecoverable.
            </p>
          </div>
        )}

        {view === 'create' && (
          <form onSubmit={submit}>
            <p style={lockStyle.sub}>Choose a password (6+ characters). Write it down somewhere safe — there's no recovery.</p>
            {error && <div style={lockStyle.err}>{error}</div>}
            <div style={lockStyle.group}>
              <label style={{fontSize:11,color:'#5C6B7A',display:'block',marginBottom:4}}>Password</label>
              <input type="password" autoFocus value={pwd} onChange={e=>setPwd(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <div style={lockStyle.group}>
              <label style={{fontSize:11,color:'#5C6B7A',display:'block',marginBottom:4}}>Confirm password</label>
              <input type="password" value={pwd2} onChange={e=>setPwd2(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <button style={lockStyle.btn} type="submit" disabled={busy}>{busy?'Encrypting…':'Set password & continue'}</button>
            <button style={lockStyle.btnGhost} type="button" onClick={()=>setView('choose')}>Back</button>
          </form>
        )}

        {view === 'unlock' && (
          <form onSubmit={submit}>
            <p style={lockStyle.sub}>Enter your password to unlock</p>
            {error && <div style={lockStyle.err}>{error}</div>}
            <div style={lockStyle.group}>
              <input type="password" autoFocus value={pwd} onChange={e=>setPwd(e.target.value)}
                placeholder="Password"
                style={{width:'100%',padding:'12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <button style={lockStyle.btn} type="submit" disabled={busy||!pwd}>{busy?'Unlocking…':'Unlock'}</button>
            <button style={lockStyle.link} type="button" onClick={onReset}>Forgot password — start over (erases all data)</button>
          </form>
        )}
      </div>
    </div>
  );
};

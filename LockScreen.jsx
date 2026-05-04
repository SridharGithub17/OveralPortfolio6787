import React, { useEffect, useState } from 'react';

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

export const LockScreen = ({mode, onUnlock, onSetup, onSkip, onReset, error, busy, authMode = 'login'}) => {
  const [username, setUsername] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const getInitialView = () => {
    if (mode === 'setup') {
      return authMode === 'signup' ? 'create' : 'choose';
    }
    return 'unlock';
  };
  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    setView(getInitialView());
  }, [mode, authMode]);

  const submit = e => {
    e && e.preventDefault();
    if(busy) return;
    if(view === 'unlock'){
      if(!username.trim()){ alert('Username is required.'); return; }
      onUnlock(pwd, username.trim());
    }
    else if(view === 'create'){
      if(!username.trim()){ alert('Username is required.'); return; }
      if(pwd.length < 6){ alert('Password must be at least 6 characters.'); return; }
      if(pwd !== pwd2){ alert('Passwords do not match.'); return; }
      onSetup(pwd, username.trim());
    }
  };

  return (
    <div style={lockStyle.wrap}>
      <div style={lockStyle.card}>
        <div style={lockStyle.icon}>🔒</div>
        <h1 style={lockStyle.title}>Portfolio Hub</h1>

        {view === 'choose' && (
          <div>
            <p style={lockStyle.sub}>Use the same shared portfolio data for everyone. New users can sign up, and existing users can log in with the portfolio password.</p>
            <button style={lockStyle.btn} onClick={()=>setView('unlock')}>Log in</button>
            <button style={lockStyle.btnGhost} onClick={()=>setView('create')}>Sign up</button>
            <button style={lockStyle.btnGhost} type="button" onClick={onSkip}>Continue without login</button>
            <p style={{...lockStyle.sub,marginTop:18,fontSize:11}}>
              Sign up creates the shared portfolio password. Logging in or signing up does not create separate datasets — everyone connects to the same backend data store.
            </p>
          </div>
        )}

        {view === 'create' && (
          <form onSubmit={submit}>
            <p style={lockStyle.sub}>Create the shared portfolio password (6+ characters). Everyone who logs in with this password will see the same backend data.</p>
            {error && <div style={lockStyle.err}>{error}</div>}
            <div style={lockStyle.group}>
              <label style={{fontSize:11,color:'#5C6B7A',display:'block',marginBottom:4}}>User name</label>
              <input type="text" autoFocus value={username} onChange={e=>setUsername(e.target.value)}
                placeholder="Enter user name"
                style={{width:'100%',padding:'10px 12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <div style={lockStyle.group}>
              <label style={{fontSize:11,color:'#5C6B7A',display:'block',marginBottom:4}}>Password</label>
              <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <div style={lockStyle.group}>
              <label style={{fontSize:11,color:'#5C6B7A',display:'block',marginBottom:4}}>Confirm password</label>
              <input type="password" value={pwd2} onChange={e=>setPwd2(e.target.value)}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <button style={lockStyle.btn} type="submit" disabled={busy}>{busy?'Saving…':'Sign up & continue'}</button>
            <button style={lockStyle.btnGhost} type="button" onClick={()=>setView('choose')}>Back</button>
          </form>
        )}

        {view === 'unlock' && (
          <form onSubmit={submit}>
            <p style={lockStyle.sub}>Enter the shared portfolio password to log in and see the same data.</p>
            {error && <div style={lockStyle.err}>{error}</div>}
            <div style={lockStyle.group}>
              <input type="text" autoFocus value={username} onChange={e=>setUsername(e.target.value)}
                placeholder="User name"
                style={{width:'100%',padding:'12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15, marginBottom: 10}} />
              <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
                placeholder="Password"
                style={{width:'100%',padding:'12px',border:'1px solid #E1E7EE',borderRadius:7,fontSize:15}} />
            </div>
            <button style={lockStyle.btn} type="submit" disabled={busy||!pwd}>{busy?'Logging in…':'Log in'}</button>
            <button style={lockStyle.btnGhost} type="button" onClick={()=>setView('create')}>First-time user? Sign up</button>
            <button style={lockStyle.link} type="button" onClick={onReset}>Forgot password — start over (erases all data)</button>
          </form>
        )}
      </div>
    </div>
  );
};

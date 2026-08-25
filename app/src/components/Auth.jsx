import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import * as storage from '../utils/storage';

export default function Auth() {
  const { login, register } = useApp();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const users = storage.getUsers();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    const success = login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    setError('');
    if (!name || !username || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const success = register(name, username, password);
    if (!success) {
      setError('Username already exists');
    }
  };

  return (
    <div className="page fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB', color: '#1A1A1A', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 30, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <img src="/logo.png" alt="CaloBit Logo" style={{ width: 70, height: 70, objectFit: 'contain', margin: '0 auto 20px', display: 'block', borderRadius: 16 }} />
        
        {isSignUp ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#1A1A1A', textAlign: 'center' }}>Create Profile</h2>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>Add a new profile so your friends can track separately!</p>
            
            <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Your Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. John Doe" 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} 
                  placeholder="e.g. johndoe" 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Choose password" 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Confirm Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Confirm password" 
                />
              </div>
              
              {error && <p style={{ color: '#EF4444', fontSize: 12, margin: 0 }}>⚠️ {error}</p>}
              
              <button type="submit" className="btn-primary" style={{ fontWeight: 700, padding: 12, borderRadius: 10 }}>Create & Sign In</button>
            </form>
            
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 20, textAlign: 'center' }}>
              Already have a profile?{' '}
              <button onClick={() => { setIsSignUp(false); setError(''); }} style={{ background: 'none', border: 'none', color: '#88a31e', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Sign In
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#1A1A1A', textAlign: 'center' }}>Welcome to CaloBit</h2>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>Sign in to your private profile to continue.</p>
            
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16 }}>
              {users.length > 0 && (
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '12px 16px', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Quick Switch Profiles</p>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {users.map(u => (
                      <button 
                        key={u.username}
                        type="button"
                        onClick={() => setUsername(u.username)}
                        style={{ 
                          background: username === u.username ? '#C6F135' : '#fff',
                          color: '#1A1A1A',
                          border: username === u.username ? 'none' : '1px solid #E5E7EB',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        👤 {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} 
                  placeholder="Enter username" 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#6B7280', fontSize: 12 }}>Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Enter password" 
                />
              </div>
              
              {error && <p style={{ color: '#EF4444', fontSize: 12, margin: 0 }}>⚠️ {error}</p>}
              
              <button type="submit" className="btn-primary" style={{ fontWeight: 700, padding: 12, borderRadius: 10 }}>Sign In</button>
            </form>
            
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 20, textAlign: 'center' }}>
              New user?{' '}
              <button onClick={() => { setIsSignUp(true); setError(''); }} style={{ background: 'none', border: 'none', color: '#88a31e', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Create Profile
              </button>
            </p>
          </>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 24, textAlign: 'center' }}>
        🔒 All profiles & data are securely stored locally on this phone.
      </p>
    </div>
  );
}

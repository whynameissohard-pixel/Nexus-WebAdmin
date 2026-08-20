import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      
      // Note: AuthContext handles checking if they are admin.
      // We assume if they get past login without getting logged out, they are admin.
      // But we can just navigate to '/' and the ProtectedRoute will handle the rest.
      navigate('/');
    } catch (err) {
      if (err.message.includes('auth/invalid-credential')) {
        setError('Invalid email or password.');
      } else {
        setError('Failed to log in. Please try again or check your admin permissions.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-panel glass-panel">
        <div className="login-header">
          <ShieldAlert className="logo-icon text-neon" size={48} />
          <h1 className="glitch-text text-cyan" data-text="NEXUS">NEXUS</h1>
          <p className="subtitle">RESTRICTED COMMAND CENTER</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>SYS_IDENT (Email)</label>
            <input 
              type="email" 
              className="cyber-input" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nexus.campus"
            />
          </div>
          <div className="input-group">
            <label>ACCESS_CODE (Password)</label>
            <input 
              type="password" 
              className="cyber-input" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button disabled={loading} type="submit" className="btn-neon login-btn">
            {loading ? <Lock className="spin-icon" size={20} /> : <LogIn size={20} />}
            <span>{loading ? 'AUTHENTICATING...' : 'AUTHORIZE ACCESS'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

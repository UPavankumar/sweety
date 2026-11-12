import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DropletIcon, AlertCircleIcon, ActivityIcon } from './Icons';

export default function AuthCard() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    }
  };

  const handleFillDemo = () => {
    setIsRegister(false);
    setEmail('demo@sweety.com');
    setPassword('Password123!');
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="auth-hero-badge">
            <DropletIcon size={14} />
            <span>Glucose Tracking System</span>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            {isRegister ? 'Patient Registration' : 'Patient Sign In'}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Daily blood glucose monitoring for diabetes management
          </p>
        </div>

        {/* Quick Reviewer Demo Card */}
        <div className="demo-fill-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Reviewer Access
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Pre-seeded Demo</span>
          </div>
          <button
            type="button"
            className="btn-action btn-neutral-action"
            style={{ width: '100%', height: '32px', fontSize: '0.775rem' }}
            onClick={handleFillDemo}
          >
            <ActivityIcon size={14} />
            <span>Fill Demo Credentials (demo@sweety.com)</span>
          </button>
        </div>

        {error && (
          <div className="clinical-alert-banner" role="alert">
            <AlertCircleIcon size={16} className="clinical-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isRegister && (
            <div className="input-block">
              <label className="input-label" htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                className="text-input"
                placeholder="Jane Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="input-block">
            <label className="input-label" htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              className="text-input"
              placeholder="patient@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-block">
            <label className="input-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="text-input"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-action btn-primary-action"
            style={{ width: '100%', marginTop: '6px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : isRegister ? 'Complete Registration' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {isRegister ? (
            <span>
              Already registered?{' '}
              <a
                href="#login"
                style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(false);
                  setError('');
                }}
              >
                Sign In
              </a>
            </span>
          ) : (
            <span>
              New patient?{' '}
              <a
                href="#register"
                style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(true);
                  setError('');
                }}
              >
                Create Account
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

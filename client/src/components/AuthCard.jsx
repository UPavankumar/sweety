import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DropletIcon, AlertCircleIcon, ActivityIcon, CheckIcon, BarChartIcon, ClipboardIcon, ArrowUpIcon } from './Icons';

export default function AuthCard() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register, loading, sessionNotice } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
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

  const switchMode = (toRegister) => (e) => {
    e.preventDefault();
    setIsRegister(toRegister);
    setError('');
  };

  const handleFillDemo = () => {
    setIsRegister(false);
    setEmail('demo@sweety.com');
    setPassword('Password123!');
    setError('');
  };

  return (
    <div className="auth-page">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-hero-brand">
          <div className="sidebar-logo-icon"><DropletIcon size={18} /></div>
          <span>Sweety</span>
        </div>
        <div className="auth-hero-copy">
          <h2>Know your numbers, every day.</h2>
          <p>A simple log for blood glucose — four readings a day, clear daily and monthly reports.</p>
          <ul className="auth-hero-points">
            <li><span><ClipboardIcon size={15} /></span>Log fasting and after-meal readings in seconds</li>
            <li><span><CheckIcon size={15} /></span>See at a glance what's in your target range</li>
            <li><span><BarChartIcon size={15} /></span>Highest, lowest and average for any day or month</li>
          </ul>
        </div>
        <div className="auth-hero-sample">
          <div className="sample-row"><span>Fasting</span><strong>92</strong><em className="status-badge status-normal status-badge-sm"><CheckIcon size={11} />In range</em></div>
          <div className="sample-row"><span>Lunch</span><strong>124</strong><em className="status-badge status-normal status-badge-sm"><CheckIcon size={11} />In range</em></div>
          <div className="sample-row"><span>Dinner</span><strong>162</strong><em className="status-badge status-elevated status-badge-sm"><ArrowUpIcon size={11} />Elevated</em></div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-panel">
          <div className="auth-mobile-brand">
            <div className="sidebar-logo-icon"><DropletIcon size={18} /></div>
            <span>Sweety</span>
          </div>
          <h1 className="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-subtitle">
            {isRegister ? 'Start tracking your blood glucose in under a minute.' : 'Sign in to log and review your readings.'}
          </p>

          {sessionNotice && !error && (
            <div className="info-callout" role="status" style={{ marginBottom: 16 }}>{sessionNotice}</div>
          )}

          {error && (
            <div className="clinical-alert-banner" role="alert">
              <AlertCircleIcon size={16} className="clinical-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="intake-form">
            {isRegister && (
              <div className="input-block">
                <label className="input-label" htmlFor="auth-name">Full name</label>
                <input id="auth-name" type="text" className="text-input" placeholder="Jane Doe" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="input-block">
              <label className="input-label" htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" className="text-input" placeholder="you@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="input-block">
              <label className="input-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                className="text-input"
                placeholder={isRegister ? 'At least 6 characters' : '••••••••'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-action btn-primary-action btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? (
              <span>Already have an account? <a href="#login" onClick={switchMode(false)}>Sign in</a></span>
            ) : (
              <span>New to Sweety? <a href="#register" onClick={switchMode(true)}>Create an account</a></span>
            )}
          </div>

          {!isRegister && (
            <div className="demo-fill-card">
              <div>
                <div className="demo-title">Just looking around?</div>
                <div className="demo-sub">Use the pre-filled demo account.</div>
              </div>
              <button type="button" className="btn-action btn-neutral-action btn-sm" onClick={handleFillDemo}>
                <ActivityIcon size={14} />
                <span>Fill Demo Credentials</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

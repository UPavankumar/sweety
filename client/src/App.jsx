import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import Sidebar from './components/Sidebar';
import AuthCard from './components/AuthCard';
import LogReadingView from './components/views/LogReadingView';
import LedgerView from './components/views/LedgerView';
import ReportsView from './components/views/ReportsView';
import AccountView from './components/views/AccountView';
import SettingsView from './components/views/SettingsView';

export default function App() {
  const { isAuthenticated, user } = useAuth();

  // Navigation State: 'log-reading' | 'ledger' | 'reports' | 'account' | 'settings'
  const [activeView, setActiveView] = useState('log-reading');

  // Full (unfiltered) reading history: drives counts, today's overview and slot availability
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  // False until the first fetch settles, so views don't show "all slots free" before data arrives
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [editingReading, setEditingReading] = useState(null);
  // Bumped after every mutation so views with their own queries refetch
  const [dataVersion, setDataVersion] = useState(0);

  const fetchReadings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await api.getReadings();
      setReadings(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Failed to load readings.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // Reset per-user UI state on sign-out / account switch
  useEffect(() => {
    if (!isAuthenticated) {
      setReadings([]);
      setLoaded(false);
      setFilterDate('');
      setEditingReading(null);
      setActiveView('log-reading');
      setLoadError('');
    }
  }, [isAuthenticated, user?.id]);

  const handleMutation = () => {
    setDataVersion((v) => v + 1);
    fetchReadings();
  };

  const navigate = (view) => {
    if (view !== 'log-reading') setEditingReading(null);
    setActiveView(view);
    window.scrollTo({ top: 0 });
  };

  if (!isAuthenticated) {
    return <AuthCard />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} setActiveView={navigate} readingCount={readings.length} />

      <main className="app-main">
        {loadError && (
          <div className="view-container">
            <div className="clinical-alert-banner" role="alert">
              <span style={{ flex: 1 }}>{loadError}</span>
              <button type="button" className="btn-action btn-neutral-action btn-sm" onClick={fetchReadings}>
                Retry
              </button>
            </div>
          </div>
        )}

        {activeView === 'log-reading' && (
          <LogReadingView
            readings={readings}
            ready={loaded}
            editingReading={editingReading}
            onCancelEdit={() => setEditingReading(null)}
            onReadingSaved={() => {
              setEditingReading(null);
              handleMutation();
            }}
            onViewLedger={() => navigate('ledger')}
          />
        )}

        {activeView === 'ledger' && (
          <LedgerView
            allReadings={readings}
            loading={loading}
            dataVersion={dataVersion}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            onEditReading={(reading) => {
              setEditingReading(reading);
              setActiveView('log-reading');
              window.scrollTo({ top: 0 });
            }}
            onReadingDeleted={handleMutation}
            onGoToLogReading={() => navigate('log-reading')}
          />
        )}

        {activeView === 'reports' && <ReportsView dataVersion={dataVersion} />}

        {activeView === 'account' && <AccountView readings={readings} />}

        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

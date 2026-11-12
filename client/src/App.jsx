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
  const { isAuthenticated } = useAuth();
  
  // Navigation State: 'log-reading' | 'ledger' | 'reports' | 'account' | 'settings'
  const [activeView, setActiveView] = useState('log-reading');

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [editingReading, setEditingReading] = useState(null);

  const fetchReadings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await api.getReadings(filterDate);
      setReadings(data);
    } catch (err) {
      console.error('Failed to fetch readings:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, filterDate]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  if (!isAuthenticated) {
    return <AuthCard />;
  }

  return (
    <div className="app-shell">
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        readingCount={readings.length}
      />

      {/* Main Clinical Workspace */}
      <main className="app-main">
        {activeView === 'log-reading' && (
          <LogReadingView
            editingReading={editingReading}
            onCancelEdit={() => setEditingReading(null)}
            onReadingSaved={() => {
              setEditingReading(null);
              fetchReadings();
            }}
            onViewLedger={() => setActiveView('ledger')}
          />
        )}

        {activeView === 'ledger' && (
          <LedgerView
            readings={readings}
            loading={loading}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            onEditReading={(reading) => {
              setEditingReading(reading);
              setActiveView('log-reading');
            }}
            onReadingDeleted={fetchReadings}
            onGoToLogReading={() => {
              setEditingReading(null);
              setActiveView('log-reading');
            }}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView />
        )}

        {activeView === 'account' && (
          <AccountView totalReadings={readings.length} />
        )}

        {activeView === 'settings' && (
          <SettingsView />
        )}
      </main>
    </div>
  );
}

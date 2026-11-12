import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { BarChartIcon, AlertCircleIcon, DropletIcon } from '../Icons';

export default function ReportsView() {
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReport(reportType, selectedDate);
      setReport(data);
    } catch (err) {
      console.error('Report fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate]);

  return (
    <div className="view-container">
      <div className="section-meta">
        <h1>Clinical Reports</h1>
        <p>Analytics: High, low, and average blood glucose trends.</p>
      </div>

      {/* Report Controls */}
      <div className="surface-card">
        <div className="intake-grid" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <div className="input-block">
            <label className="input-label">Report Type</label>
            <select className="select-input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="daily">Daily View</option>
              <option value="month-to-date">Month-to-Date</option>
              <option value="monthly">Monthly (Previous Month)</option>
            </select>
          </div>
          <div className="input-block">
            <label className="input-label">Reference Date</label>
            <input type="date" className="text-input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <button className="btn-action btn-primary-action" onClick={fetchReport}>Update Report</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>Calculating metrics...</div>
      ) : report && !report.isEmpty ? (
        <>
          <div className="clinical-stats-grid">
            <div className="clinical-stat-card">
              <span className="stat-header-label">Count</span>
              <div className="stat-numeric-value">{report.stats.count}</div>
            </div>
            <div className="clinical-stat-card">
              <span className="stat-header-label">Highest</span>
              <div className="stat-numeric-value" style={{ color: 'var(--status-high)' }}>{report.stats.highest}<span className="stat-numeric-unit">mg/dL</span></div>
            </div>
            <div className="clinical-stat-card">
              <span className="stat-header-label">Lowest</span>
              <div className="stat-numeric-value" style={{ color: 'var(--status-low)' }}>{report.stats.lowest}<span className="stat-numeric-unit">mg/dL</span></div>
            </div>
            <div className="clinical-stat-card">
              <span className="stat-header-label">Average</span>
              <div className="stat-numeric-value">{report.stats.average}<span className="stat-numeric-unit">mg/dL</span></div>
            </div>
          </div>
        </>
      ) : (
        <div className="surface-card ledger-empty">
          <div className="ledger-empty-icon"><BarChartIcon size={20} /></div>
          <div className="ledger-empty-title">No data available</div>
          <p className="ledger-empty-desc">No readings found for {selectedDate}. Adjust filters.</p>
        </div>
      )}
    </div>
  );
}

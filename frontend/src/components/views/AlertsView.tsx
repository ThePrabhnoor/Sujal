import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Calendar,
  Layers,
  Filter,
  Check,
  ShieldAlert,
  Info
} from 'lucide-react';
import { AlertItem, MonthlyArchive } from '../../types';

interface AlertsViewProps {
  alerts: AlertItem[];
  archives: MonthlyArchive[];
  onUpdateAlertStatus: (alertId: string, status: 'acknowledged' | 'resolved') => void;
  nodeId: string;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  archives,
  onUpdateAlertStatus,
  nodeId,
}) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const openCount = alerts.filter(a => a.status === 'open').length;
  const highCount = alerts.filter(a => a.severity === 'high' && a.status === 'open').length;
  const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header and Summary Stats */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-100">Operational Alerts & Monthly Archives</h2>
        </div>
        <p className="text-xs text-slate-400">
          Rule-based operational excursion alerts and permanent monthly CSV telemetry exports for node {nodeId}.
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-5">
          <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4">
            <span className="text-xs text-slate-400">Open Alerts</span>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1 flex items-baseline gap-2">
              {openCount}
              {openCount > 0 && (
                <span className="text-xs font-semibold text-red-400 animate-pulse">Needs Review</span>
              )}
            </div>
          </div>

          <div className="bg-[#121927] border border-red-500/30 rounded-xl p-4">
            <span className="text-xs text-red-400 font-semibold">High Severity</span>
            <div className="text-2xl font-bold font-mono text-red-300 mt-1">
              {highCount}
            </div>
          </div>

          <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4">
            <span className="text-xs text-slate-400">Acknowledged</span>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
              {acknowledgedCount}
            </div>
          </div>

          <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4">
            <span className="text-xs text-slate-400">Resolved</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {resolvedCount}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Active Operational Alerts */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1b263a]">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Alerts Management Queue
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#0a0e18] p-1 rounded-lg border border-[#1f2b3f] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'open' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setFilter('acknowledged')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'acknowledged' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acknowledged ({acknowledgedCount})
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'resolved' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Alerts Cards List */}
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isHigh = alert.severity === 'high';
            const isOpen = alert.status === 'open';

            return (
              <div
                key={alert._id}
                className={`p-4 rounded-xl border transition-all ${
                  isOpen
                    ? isHigh
                      ? 'bg-red-950/20 border-red-500/40'
                      : 'bg-[#121927] border-amber-500/40'
                    : 'bg-[#0f1523] border-[#1c273c] opacity-85'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono border ${
                          isHigh
                            ? 'bg-red-950 text-red-300 border-red-700'
                            : 'bg-amber-950 text-amber-300 border-amber-700'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-400">
                        {alert.code}
                      </span>
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{alert.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                      {alert.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                      <span>Node: <strong className="text-slate-300 font-mono">{alert.node_id}</strong></span>
                      {alert.run_id && <span>Run: <strong className="text-slate-300 font-mono">{alert.run_id}</strong></span>}
                      {alert.phase && <span>Phase: <strong className="text-slate-300 uppercase font-mono">{alert.phase}</strong></span>}
                      <span className="text-amber-400/80 italic text-[10px]">
                        (Operational alert only; not a water safety determination)
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {alert.status === 'open' && (
                      <button
                        onClick={() => onUpdateAlertStatus(alert._id, 'acknowledged')}
                        className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => onUpdateAlertStatus(alert._id, 'resolved')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors"
                      >
                        Resolve
                      </button>
                    )}

                    {alert.status === 'resolved' && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800">
                        <Check className="w-3.5 h-3.5" />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAlerts.length === 0 && (
            <div className="p-8 text-center bg-[#101625] rounded-xl border border-slate-800 text-slate-400">
              No alerts found under this status.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Permanent Monthly Archives */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Permanent Monthly Telemetry Archives (CSV)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Dynamically queried from saved MongoDB telemetry records. No reliance on temporary server files.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0b101c] border-b border-[#1f2b3f] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="py-2.5 px-4">Month</th>
                <th className="py-2.5 px-4">Stored Packets</th>
                <th className="py-2.5 px-4">First Timestamp</th>
                <th className="py-2.5 px-4">Last Timestamp</th>
                <th className="py-2.5 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182335]">
              {archives.map((arch) => (
                <tr key={arch.month} className="hover:bg-[#162033] text-slate-300">
                  <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                    {arch.month}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {arch.count.toLocaleString()} packets
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {new Date(arch.first_timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {new Date(arch.last_timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={arch.download_url}
                      download={`sujal-${nodeId}-${arch.month}.csv`}
                      onClick={(e) => {
                        // Demo notification if in mock mode
                        if (!arch.download_url.startsWith('http')) {
                          alert(`Downloading generated telemetry CSV for ${arch.month}`);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{arch.month}.csv</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

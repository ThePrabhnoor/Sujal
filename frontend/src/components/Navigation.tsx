import React from 'react';
import {
  LayoutDashboard,
  Map,
  Archive,
  Bell,
  RefreshCw,
  Power,
  Wifi,
  Database,
  GitBranch,
  Clock,
  Terminal,
  Activity,
  Sparkles
} from 'lucide-react';
import { SystemLogEntry } from '../types';

export type ViewType = 'dashboard' | 'maps' | 'logs-archive' | 'alerts' | 'gemini-insights';

interface NavigationProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  openAlertsCount: number;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onRefreshReadings: () => void;
  isBackendConnected: boolean;
  isNodeOnline?: boolean;
  activeBranch: string;
  lastIngestTimeFormatted: string;
  systemLogs: SystemLogEntry[];
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  openAlertsCount,
  isStreaming,
  onToggleStreaming,
  onRefreshReadings,
  isBackendConnected,
  isNodeOnline = true,
  activeBranch,
  lastIngestTimeFormatted,
  systemLogs,
}) => {
  const navItems: { id: ViewType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'maps', label: 'Maps', icon: Map },
    { id: 'logs-archive', label: 'Logs and Archive', icon: Archive },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: openAlertsCount },
    { id: 'gemini-insights', label: 'Gemini Insights', icon: Sparkles },
  ];

  return (
    <aside className="w-72 bg-[#0c1633] border-r border-[#1e355e] flex flex-col justify-between select-none z-30 shrink-0 h-screen shadow-2xl">
      {/* Top: Brand Header & Navigation Buttons */}
      <div className="flex flex-col">
        {/* Brand Header with SuJal Logo (No 'Pro' badge) */}
        <div className="h-20 px-5 border-b border-[#1b3158] flex items-center gap-3.5 bg-gradient-to-r from-[#101f46] to-[#0c1633]">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 p-2 flex items-center justify-center shadow-lg shadow-cyan-500/30 border border-cyan-300/40">
            <img
              src="/sujal_monochrome_symbol_white.svg"
              alt="SuJal Symbol"
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-white bg-clip-text text-transparent">
              SuJal
            </div>
            <p className="text-[11px] text-cyan-300/80 font-medium tracking-tight">
              Water Quality & Telemetry
            </p>
          </div>
        </div>

        {/* The 4 Requested Navigation Buttons */}
        <nav className="p-3.5 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 via-sky-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-300/40 font-bold scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-[#15274d] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-cyan-400 group-hover:text-cyan-300'
                    }`}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white text-blue-700 shadow'
                        : 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1.5 bg-cyan-300 rounded-r shadow-glow" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom of Left Nav: System Logs & Telemetry Status */}
      <div className="p-3.5 border-t border-[#1b3158] bg-[#091126] space-y-3 flex flex-col justify-end">
        {/* Header Title */}
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-cyan-400 px-1">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            System Status
          </span>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
            isNodeOnline
              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
              : 'text-rose-400 bg-rose-950/60 border-rose-800/60'
          }`}>
            {isNodeOnline ? 'v1.4 Live' : 'OFFLINE'}
          </span>
        </div>

        {/* Integration Status Cards */}
        <div className="space-y-1.5 text-xs font-mono">
          {/* ESP32 Integration */}
          <div className="bg-[#111f3f] p-2.5 rounded-lg border border-[#203a68] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isNodeOnline ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
              ) : (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
              <span className="text-slate-200 text-[11px] font-sans font-semibold">ESP32 Telemetry</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isNodeOnline
                ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800'
                : 'text-rose-300 bg-rose-950/80 border-rose-800'
            }`}>
              {isNodeOnline ? 'INGESTING' : 'OFFLINE'}
            </span>
          </div>

          {/* Backend Connection */}
          <div className="bg-[#111f3f] p-2.5 rounded-lg border border-[#203a68] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-200 text-[11px] font-sans font-semibold">Backend DB</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isBackendConnected
                ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800'
                : 'text-amber-300 bg-amber-950/80 border-amber-800'
            }`}>
              {isBackendConnected ? 'ATLAS CONNECTED' : 'LOCAL ENGINE'}
            </span>
          </div>

          {/* Branch State */}
          <div className="bg-[#111f3f] p-2.5 rounded-lg border border-[#203a68] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-200 text-[11px] font-sans font-semibold">Branch State</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isNodeOnline && activeBranch
                ? 'text-cyan-300 bg-cyan-950/80 border-cyan-800'
                : 'text-slate-400 bg-slate-900/80 border-slate-700'
            }`}>
              {isNodeOnline && activeBranch ? `Branch ${activeBranch} Active` : 'Branch state not reported'}
            </span>
          </div>

          {/* Last Ingest Timer */}
          <div className="bg-[#111f3f] p-2.5 rounded-lg border border-[#203a68] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300 text-[11px] font-sans">Last Ingest</span>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
              isNodeOnline
                ? 'text-amber-300 bg-amber-950/60 border-amber-800/80'
                : 'text-slate-400 bg-slate-900/60 border-slate-700/80'
            }`}>
              {isNodeOnline ? lastIngestTimeFormatted : 'No Packets'}
            </span>
          </div>
        </div>

        {/* Live System Control Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Refresh readings button */}
          <button
            onClick={onRefreshReadings}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#15274d] hover:bg-[#1d3568] text-slate-200 text-[11px] font-semibold border border-[#254278] transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Refresh</span>
          </button>

          {/* Auto refresh toggle (ON / OFF) */}
          <button
            onClick={onToggleStreaming}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold border transition-colors shadow-sm ${
              isStreaming
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 hover:bg-emerald-900/90 shadow-emerald-900/30'
                : 'bg-[#15274d] text-slate-400 border-[#254278] hover:bg-[#1d3568]'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${isStreaming ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>{isStreaming ? 'Auto ON' : 'Auto OFF'}</span>
          </button>
        </div>

        {/* Mini Live System Log Output Feed */}
        <div className="bg-[#070d1e] p-2.5 rounded-lg border border-[#172b4f] max-h-24 overflow-y-auto space-y-1 text-[10px] font-mono leading-tight">
          {systemLogs.slice(-4).map((log) => (
            <div key={log.id} className="flex items-start gap-1.5 text-slate-400">
              <span className="text-cyan-500 shrink-0">[{log.timestamp}]</span>
              <span className={`truncate ${
                log.type === 'alert' ? 'text-rose-400' :
                log.type === 'success' ? 'text-emerald-300' :
                log.type === 'warn' ? 'text-amber-300' : 'text-slate-300'
              }`}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

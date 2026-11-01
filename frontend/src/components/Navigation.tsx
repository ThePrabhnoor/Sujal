import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  GitBranch,
  Table,
  Bell,
  Sliders,
  Activity,
  Droplets,
  Wifi,
  Radio,
  Cpu
} from 'lucide-react';

export type ViewType = 'overview' | 'map' | 'schematic' | 'history' | 'alerts' | 'diagnostics' | 'settings';

interface NavigationProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  openAlertsCount: number;
  isLive: boolean;
  activeBranch: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  openAlertsCount,
  isLive,
  activeBranch,
}) => {
  const navItems: { id: ViewType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Map & Nodes', icon: MapPin },
    { id: 'schematic', label: 'Flow Schematic', icon: GitBranch },
    { id: 'history', label: 'Telemetry Logs', icon: Table },
    { id: 'alerts', label: 'Alerts & Archives', icon: Bell, badge: openAlertsCount },
    { id: 'diagnostics', label: 'Run Analytics', icon: Activity },
    { id: 'settings', label: 'Thresholds & Profile', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-[#1a2436] flex flex-col justify-between select-none z-30 shrink-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-5 border-b border-[#1a2436] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Droplets className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-sky-300 via-cyan-200 to-white bg-clip-text text-transparent">
                SuJal
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Water Quality & Telemetry</p>
          </div>
        </div>

        {/* Live Network Pill */}
        <div className="px-4 py-3 border-b border-[#162030] bg-[#0a0f18]/60">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-mono text-[11px]">ESP32 Ingestion</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/50">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>{isLive ? '30s PING' : 'READY'}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="text-slate-400">Active Path:</span>
            <span className="font-mono font-semibold text-cyan-400 bg-cyan-950/70 border border-cyan-800/50 px-2 py-0.5 rounded text-[10px]">
              Branch {activeBranch}
            </span>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600/90 to-blue-600/80 text-white shadow-md shadow-sky-600/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151e30]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white text-sky-700' : 'bg-red-500/90 text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-300 rounded-r" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Station Card */}
      <div className="p-4 border-t border-[#1a2436] bg-[#090e18]/80 space-y-3">
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Node SJ-001
            </span>
            <span className="text-emerald-400 font-bold">ONLINE</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            Locality Checkpoint 1
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5 flex items-center justify-between">
            <span>Pair ID:</span>
            <span className="font-mono text-slate-300">Auto-Alternating</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400" />
            SuJal Core v1.4
          </span>
          <span className="font-mono">Oct 2026</span>
        </div>
      </div>
    </aside>
  );
};


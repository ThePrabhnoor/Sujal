import React from 'react';
import {
  ChevronDown,
  RefreshCw,
  Zap,
  Repeat,
  MapPin,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { NodeProfile } from '../types';

interface HeaderProps {
  nodes: NodeProfile[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onManualCycleNode: () => void;
  onSyncGsmLocation: () => void;
  isGsmSyncing: boolean;
  gsmLocationText: string;
  onSimulatePacket: () => void;
  onRefresh: () => void;
  lastTimestamp?: string;
  activeBranch: string;
  isBackendConnected: boolean;
  filterCloggedPercent: number;
}

export const Header: React.FC<HeaderProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onManualCycleNode,
  onSyncGsmLocation,
  isGsmSyncing,
  gsmLocationText,
  onSimulatePacket,
  onRefresh,
  lastTimestamp,
  activeBranch,
  isBackendConnected,
  filterCloggedPercent,
}) => {
  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0];

  const getClogBadgeColor = (val: number) => {
    if (val < 40) return 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80';
    if (val < 75) return 'text-amber-300 bg-amber-950/80 border-amber-700/80';
    return 'text-rose-300 bg-rose-950/80 border-rose-700/80 animate-pulse';
  };

  return (
    <header className="h-20 px-6 bg-[#0c1633]/95 backdrop-blur-md border-b border-[#1b3158] flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-md">
      {/* Top Left: Node Switcher & Manual Switch Button */}
      <div className="flex items-center gap-3">
        {/* Node Dropdown */}
        <div className="relative">
          <select
            value={selectedNodeId}
            onChange={(e) => onSelectNode(e.target.value)}
            className="appearance-none bg-[#122248] hover:bg-[#182c5a] text-white font-bold text-sm pl-4 pr-10 py-2.5 rounded-xl border border-[#274880] focus:outline-none focus:border-cyan-400 cursor-pointer shadow-lg transition-all"
          >
            {nodes.map((n) => (
              <option key={n.node_id} value={n.node_id} className="bg-[#0c1633] text-white font-medium">
                {n.node_id} — {n.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Manual Switch Node Button */}
        <button
          onClick={onManualCycleNode}
          title="Switch to next station"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14264f] hover:bg-[#1c366e] text-cyan-300 hover:text-white border border-[#25467e] text-xs font-semibold shadow-md transition-all active:scale-95"
        >
          <Repeat className="w-3.5 h-3.5 text-cyan-400" />
          <span>Switch Node</span>
        </button>

        {/* Filter Clogged Metric Badge */}
        <div className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold shadow-sm ${getClogBadgeColor(filterCloggedPercent)}`}>
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Clogged: {filterCloggedPercent}%</span>
        </div>
      </div>

      {/* Top Center/Right: Device Location (Laptop GSM/GPS) & Telemetry Controls */}
      <div className="flex items-center gap-3">
        {/* Device Location (Laptop GSM) Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111f3f] border border-[#203a68] text-xs">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-cyan-300/80 uppercase font-bold tracking-wider">Device Location (GSM)</span>
            <span className="text-[11px] font-mono text-slate-200 truncate max-w-[220px]">
              {gsmLocationText}
            </span>
          </div>
          <button
            onClick={onSyncGsmLocation}
            disabled={isGsmSyncing}
            className="ml-1 p-1 hover:bg-[#1c3569] rounded text-cyan-400 hover:text-cyan-200"
            title="Sync live GPS/GSM coordinates from laptop"
          >
            <Compass className={`w-3.5 h-3.5 ${isGsmSyncing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Ingest Simulated ESP32 Packet */}
        <button
          onClick={onSimulatePacket}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span className="hidden md:inline">Simulate Packet</span>
        </button>

        {/* Quick Refresh */}
        <button
          onClick={onRefresh}
          title="Refresh All Telemetry"
          className="p-2.5 rounded-xl bg-[#122248] hover:bg-[#1a3163] text-slate-200 border border-[#274880] transition-colors shadow"
        >
          <RefreshCw className="w-4 h-4 text-cyan-400 hover:text-white" />
        </button>
      </div>
    </header>
  );
};

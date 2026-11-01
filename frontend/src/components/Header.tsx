import React from 'react';
import {
  ChevronDown,
  RefreshCw,
  Zap,
  Activity,
  Play,
  Pause,
  Download,
  AlertCircle
} from 'lucide-react';
import { NodeProfile } from '../types';

interface HeaderProps {
  nodes: NodeProfile[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  onSimulatePacket: () => void;
  onRefresh: () => void;
  lastTimestamp?: string;
  activeBranch: string;
  isBackendConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  isStreaming,
  onToggleStreaming,
  onSimulatePacket,
  onRefresh,
  lastTimestamp,
  activeBranch,
  isBackendConnected,
}) => {
  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0];

  return (
    <header className="h-16 px-6 bg-[#0d131f]/95 backdrop-blur-md border-b border-[#1a2436] flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left: Node Selector & Station Info */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <select
            value={selectedNodeId}
            onChange={(e) => onSelectNode(e.target.value)}
            className="appearance-none bg-[#141b2a] hover:bg-[#1a2336] text-slate-100 font-bold text-sm pl-3.5 pr-9 py-1.5 rounded-lg border border-[#22314a] focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner transition-colors"
          >
            {nodes.map((n) => (
              <option key={n.node_id} value={n.node_id} className="bg-slate-900 text-slate-200">
                {n.node_id} — {n.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE TELEMETRY
          </span>

          <span className="px-2.5 py-1 rounded-md bg-sky-950/60 text-sky-400 border border-sky-800/50 font-mono font-medium">
            Branch {activeBranch} Valve Active
          </span>

          {!isBackendConnected && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-950/50 text-amber-300 border border-amber-800/40">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Demo Engine
            </span>
          )}
        </div>
      </div>

      {/* Right: Actions and Live Controls */}
      <div className="flex items-center gap-2.5">
        {lastTimestamp && (
          <div className="hidden lg:flex flex-col text-right pr-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Last Ingest</span>
            <span className="text-xs font-mono text-slate-300">
              {new Date(lastTimestamp).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Ingestion Simulator Button */}
        <button
          onClick={onSimulatePacket}
          title="Send simulated ESP32 packet"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Simulate Packet</span>
        </button>

        {/* Live Stream Auto Toggle */}
        <button
          onClick={onToggleStreaming}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isStreaming
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/80'
              : 'bg-[#141b2a] text-slate-300 border-[#22314a] hover:bg-[#1a2336]'
          }`}
        >
          {isStreaming ? (
            <>
              <Pause className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Live Stream ON</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Stream 3s</span>
            </>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          title="Refresh Data"
          className="p-2 rounded-lg bg-[#141b2a] hover:bg-[#1a2336] text-slate-300 border border-[#22314a] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>
      </div>
    </header>
  );
};


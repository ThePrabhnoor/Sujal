import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Compass,
  Navigation as NavIcon,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Maximize2,
  Minimize2,
  Droplets,
  Activity,
  Gauge
} from 'lucide-react';
import { NodeProfile, TelemetryReading } from '../../types';
import { Sparkline } from '../charts/Sparkline';

interface MapViewProps {
  nodes: NodeProfile[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  latestReading: TelemetryReading | null;
  readings: TelemetryReading[];
}

export const MapView: React.FC<MapViewProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  latestReading,
  readings,
}) => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'warning'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0];

  const filteredNodes = nodes.filter(n => {
    if (filter === 'verified') return n.location.verified;
    if (filter === 'warning') return n.node_id === 'SJ-001';
    return true;
  });

  const phHistory = readings.map(r => r.measurements.ph);
  const turbHistory = readings.map(r => r.measurements.turbidity_ntu);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-[#090d16] select-none">
      {/* SVG Stylized Dark Vector Map Canvas */}
      <div className="absolute inset-0 z-0">
        <svg
          viewBox="0 0 1200 800"
          className="w-full h-full object-cover transition-transform duration-300"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#141d2d" strokeWidth="0.8" />
            </pattern>
            {/* Water River Gradients */}
            <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#0369a1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#075985" stopOpacity="0.4" />
            </linearGradient>
            {/* Radar Sweep Gradient */}
            <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="#0a0e18" />
          <rect width="100%" height="100%" fill="url(#mapGrid)" />

          {/* Contour Lines & Topological Shapes */}
          <path
            d="M 100 200 Q 300 150 500 280 T 900 220 T 1150 350"
            fill="none"
            stroke="#162236"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <path
            d="M 50 450 Q 350 400 650 520 T 1100 480"
            fill="none"
            stroke="#162236"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />

          {/* Simulated River / Waterway (Yamuna River Canal Feeder) */}
          <path
            d="M 200 0 C 350 150, 250 350, 450 500 S 700 700, 850 800"
            fill="none"
            stroke="url(#riverGradient)"
            strokeWidth="32"
            strokeLinecap="round"
          />
          <path
            d="M 200 0 C 350 150, 250 350, 450 500 S 700 700, 850 800"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="10 15"
            className="flow-line"
          />

          {/* Road Network Lines */}
          <path d="M 0 320 L 1200 320" stroke="#1a2538" strokeWidth="2" />
          <path d="M 450 0 L 450 800" stroke="#1a2538" strokeWidth="2" />
          <path d="M 150 700 L 950 100" stroke="#1f2c42" strokeWidth="1.5" strokeDasharray="4 2" />
          <path d="M 750 0 L 750 800" stroke="#151f30" strokeWidth="1" />

          {/* District Boundary Polygons */}
          <polygon
            points="300,180 520,240 600,420 380,480 260,350"
            fill="#0f172a"
            fillOpacity="0.4"
            stroke="#1e293b"
            strokeWidth="1"
          />
          <polygon
            points="650,220 950,180 1050,450 800,520 620,380"
            fill="#0f172a"
            fillOpacity="0.4"
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Node Coordinates Mapping */}
          {/* Node 1: SJ-001 at (460, 310) */}
          {/* Node 2: SJ-002 at (380, 180) */}
          {/* Node 3: SJ-003 at (760, 420) */}
          {filteredNodes.map((node, i) => {
            const coords = [
              { x: 460, y: 310 },
              { x: 340, y: 190 },
              { x: 740, y: 440 },
            ][i % 3];

            const isSelected = node.node_id === selectedNodeId;

            return (
              <g
                key={node.node_id}
                className="cursor-pointer"
                onClick={() => onSelectNode(node.node_id)}
              >
                {/* Radar pulse around active node */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isSelected ? 48 : 24}
                  fill="url(#radarSweep)"
                  className="animate-pulse"
                />
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isSelected ? 18 : 12}
                  fill={isSelected ? '#0284c7' : '#0f172a'}
                  stroke={isSelected ? '#38bdf8' : '#334155'}
                  strokeWidth="2.5"
                />
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="4"
                  fill={isSelected ? '#ffffff' : '#38bdf8'}
                />

                {/* Node Label on Map */}
                <rect
                  x={coords.x + 18}
                  y={coords.y - 14}
                  width="110"
                  height="26"
                  rx="6"
                  fill="#0d1424"
                  stroke={isSelected ? '#38bdf8' : '#1e293b'}
                  strokeWidth="1.2"
                />
                <text
                  x={coords.x + 28}
                  y={coords.y + 3}
                  className="fill-slate-200 text-[11px] font-mono font-bold"
                >
                  {node.node_id}
                </text>
                <circle
                  cx={coords.x + 114}
                  cy={coords.y - 1}
                  r="3.5"
                  fill={node.location.verified ? '#10b981' : '#f59e0b'}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Node Inspector Card (Left overlay) */}
      <div
        className="absolute top-6 left-6 w-96 max-w-[calc(100vw-3rem)] z-10 bg-[#0d1422]/95 backdrop-blur-xl border border-[#202d42] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Node Card Header */}
        <div className="p-4 border-b border-[#1b263a] bg-gradient-to-r from-sky-950/40 to-transparent flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {selectedNode.node_id}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  selectedNode.location.verified
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border-amber-800'
                }`}
              >
                {selectedNode.location.verified ? 'LOCATION VERIFIED' : 'PENDING SURVEY'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100 mt-1.5">{selectedNode.name}</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{selectedNode.address || 'Surveyed coordinates'}</span>
            </p>
          </div>
        </div>

        {/* GPS Coordinates Section */}
        <div className="px-4 py-2.5 bg-[#090e18] border-b border-[#1b263a] flex items-center justify-between text-xs font-mono">
          <div className="text-slate-400">
            LAT: <span className="text-slate-200">{selectedNode.location.latitude.toFixed(4)}° N</span>
          </div>
          <div className="text-slate-400">
            LON: <span className="text-slate-200">{selectedNode.location.longitude.toFixed(4)}° E</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded">
            {selectedNode.location.source}
          </span>
        </div>

        {/* Live Telemetry Preview in Card */}
        {latestReading && (
          <div className="p-4 space-y-3">
            <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
              <span>Live Sensor Values</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#121927] border border-[#1f2b3f] rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>pH Value</span>
                  <Activity className="w-3 h-3 text-cyan-400" />
                </div>
                <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                  {latestReading.measurements.ph.toFixed(2)}
                </div>
                <div className="mt-1">
                  <Sparkline data={phHistory} color="#0ea5e9" width={70} height={20} />
                </div>
              </div>

              <div className="bg-[#121927] border border-[#1f2b3f] rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Turbidity</span>
                  <Droplets className="w-3 h-3 text-sky-400" />
                </div>
                <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                  {latestReading.measurements.turbidity_ntu.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">NTU</span>
                </div>
                <div className="mt-1">
                  <Sparkline data={turbHistory} color="#38bdf8" width={70} height={20} />
                </div>
              </div>

              <div className="bg-[#121927] border border-[#1f2b3f] rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">Temperature</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-1">
                  {latestReading.measurements.temperature_c.toFixed(1)} °C
                </div>
              </div>

              <div className="bg-[#121927] border border-[#1f2b3f] rounded-lg p-2.5">
                <div className="text-[10px] text-slate-400">Branch Flow</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-1">
                  {latestReading.measurements.flow_lpm.branch_a.toFixed(2)} LPM
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1b263a] flex items-center justify-between text-xs text-slate-400">
              <span>Sequence Phase:</span>
              <span className="font-mono font-bold text-sky-300 uppercase">
                {latestReading.phase} ({latestReading.run_id})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top Right Floating Controls */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <div className="bg-[#0d1422]/90 backdrop-blur-md border border-[#202d42] rounded-xl p-1 flex items-center gap-1 shadow-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Nodes ({nodes.length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'verified' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Verified Only
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="bg-[#0d1422]/90 backdrop-blur-md border border-[#202d42] rounded-xl p-1 flex items-center shadow-xl">
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 font-bold"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.8))}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 font-bold"
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
};

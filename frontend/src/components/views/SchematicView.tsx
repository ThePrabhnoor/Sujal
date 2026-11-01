import React from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Gauge,
  Sliders,
  Droplets,
  Activity,
  AlertCircle
} from 'lucide-react';
import { TelemetryReading } from '../../types';
import { formatReadingValue } from '../../services/api';

interface SchematicViewProps {
  latestReading: TelemetryReading | null;
}

export const SchematicView: React.FC<SchematicViewProps> = ({ latestReading }) => {
  const activeBranch = latestReading?.active_branch === 'A' || latestReading?.active_branch === 'B'
    ? latestReading.active_branch
    : null;

  const measurements = latestReading?.measurements || {
    ph: Number.NaN,
    turbidity_ntu: Number.NaN,
    temperature_c: Number.NaN,
    mq5_adc: Number.NaN,
    mq5_digital: Number.NaN,
    flow_lpm: { inlet: Number.NaN, branch_a: Number.NaN, branch_b: Number.NaN }
  };

  const isBranchAActive = activeBranch === 'A';
  const isBranchBActive = activeBranch === 'B';

  const flowA = isBranchAActive ? measurements.flow_lpm.branch_a : Number.NaN;
  const flowB = isBranchBActive ? measurements.flow_lpm.branch_b : Number.NaN;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Control Bar */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">Plumbing & Solenoid Schematic</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              DUAL-BRANCH
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Read-only view. Branch and valve state are taken from the latest ESP32 packet; this dashboard does not actuate valves.
          </p>
        </div>

        <div className="text-xs text-slate-400">Reported branch: {activeBranch || 'not reported'}</div>
      </div>

      {/* Interactive Animated SVG Piping Schematic */}
      <div className="bg-[#0f1523] border border-[#1e2a3e] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow Effects in Background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 1000 420" className="w-full min-w-[750px] h-auto select-none">
            <defs>
              <linearGradient id="tankGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
              </linearGradient>

              <linearGradient id="filterBedGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>

            {/* BASE STATIC PIPES (Gray/Navy) */}
            {/* Inlet pipe to splitter */}
            <path d="M 120 210 L 260 210" stroke="#1f2c42" strokeWidth="16" strokeLinecap="round" />
            
            {/* Splitter to Branch A (Top) */}
            <path d="M 260 210 L 310 110 L 680 110 L 740 210" fill="none" stroke="#1f2c42" strokeWidth="16" strokeLinejoin="round" />

            {/* Splitter to Branch B (Bottom) */}
            <path d="M 260 210 L 310 310 L 680 310 L 740 210" fill="none" stroke="#1f2c42" strokeWidth="16" strokeLinejoin="round" />

            {/* Outlet pipe from merge to Outlet Tank */}
            <path d="M 740 210 L 880 210" stroke="#1f2c42" strokeWidth="16" strokeLinecap="round" />

            {/* ANIMATED WATER FLOW PATHS */}
            {/* Main Inlet Flow */}
            <path
              d="M 120 210 L 260 210"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="6"
              className="flow-line"
            />

            {/* Branch A Flow (Active when Valve A Open) */}
            {isBranchAActive && (
              <path
                d="M 260 210 L 310 110 L 680 110 L 740 210"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="6"
                className="flow-line"
              />
            )}

            {/* Branch B Flow (Active when Valve B Open) */}
            {isBranchBActive && (
              <path
                d="M 260 210 L 310 310 L 680 310 L 740 210"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="6"
                className="flow-line"
              />
            )}

            {/* Main Outlet Flow */}
            <path
              d="M 740 210 L 880 210"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="6"
              className="flow-line"
            />

            {/* INLET RESERVOIR / TANK */}
            <g transform="translate(40, 150)">
              <rect width="80" height="120" rx="8" fill="url(#tankGrad)" stroke="#38bdf8" strokeWidth="2" />
              <rect x="4" y="40" width="72" height="76" rx="4" fill="url(#waterGrad)" />
              <text x="40" y="30" textAnchor="middle" className="fill-slate-300 font-bold text-[11px]">INLET TANK</text>
              <text x="40" y="70" textAnchor="middle" className="fill-white font-mono font-bold text-[13px]">Raw Inflow</text>
              <text x="40" y="90" textAnchor="middle" className="fill-sky-200 font-mono text-[10px]">~9.4 NTU</text>
            </g>

            {/* INLET FLOW SENSOR */}
            <g transform="translate(160, 160)">
              <rect width="70" height="40" rx="6" fill="#141c2c" stroke="#334155" strokeWidth="1.5" />
              <text x="35" y="16" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">FLOW INLET</text>
              <text x="35" y="31" textAnchor="middle" className="fill-emerald-400 font-mono font-bold text-[12px]">
                {formatReadingValue(measurements.flow_lpm.inlet, 1)} LPM
              </text>
            </g>

            {/* SOLENOID VALVE A (Top Branch) */}
            <g transform="translate(340, 70)">
              <rect
                width="90"
                height="80"
                rx="8"
                fill="#141c2c"
                stroke={isBranchAActive ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                className={isBranchAActive ? 'glow-emerald' : ''}
              />
              <text x="45" y="22" textAnchor="middle" className="fill-slate-300 font-bold text-[11px]">
                VALVE A
              </text>
              <circle cx="45" cy="45" r="14" fill={isBranchAActive ? '#10b981' : '#ef4444'} />
              <text x="45" y="49" textAnchor="middle" className="fill-white font-bold text-[10px] font-mono">
                {isBranchAActive ? 'ON' : 'OFF'}
              </text>
              <text x="45" y="72" textAnchor="middle" className="fill-slate-400 text-[9px]">
                Solenoid 12V
              </text>
            </g>

            {/* FILTER BED A (Top Branch) */}
            <g transform="translate(470, 75)">
              <rect width="160" height="70" rx="8" fill="url(#filterBedGrad)" stroke={isBranchAActive ? '#38bdf8' : '#334155'} strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" className="fill-slate-200 font-bold text-[11px]">
                FILTER BED A (Active)
              </text>
              <text x="80" y="44" textAnchor="middle" className="fill-cyan-400 font-mono text-[12px]">
                {formatReadingValue(flowA, 1)} LPM
              </text>
              <text x="80" y="60" textAnchor="middle" className="fill-slate-400 text-[9px]">
                Activated Carbon + Sand
              </text>
            </g>

            {/* SOLENOID VALVE B (Bottom Branch) */}
            <g transform="translate(340, 270)">
              <rect
                width="90"
                height="80"
                rx="8"
                fill="#141c2c"
                stroke={isBranchBActive ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                className={isBranchBActive ? 'glow-emerald' : ''}
              />
              <text x="45" y="22" textAnchor="middle" className="fill-slate-300 font-bold text-[11px]">
                VALVE B
              </text>
              <circle cx="45" cy="45" r="14" fill={isBranchBActive ? '#10b981' : '#ef4444'} />
              <text x="45" y="49" textAnchor="middle" className="fill-white font-bold text-[10px] font-mono">
                {isBranchBActive ? 'ON' : 'OFF'}
              </text>
              <text x="45" y="72" textAnchor="middle" className="fill-slate-400 text-[9px]">
                Solenoid 12V
              </text>
            </g>

            {/* FILTER BED B (Bottom Branch) */}
            <g transform="translate(470, 275)">
              <rect width="160" height="70" rx="8" fill="url(#filterBedGrad)" stroke={isBranchBActive ? '#38bdf8' : '#334155'} strokeWidth="1.5" />
              <text x="80" y="24" textAnchor="middle" className="fill-slate-200 font-bold text-[11px]">
                FILTER BED B (Standby)
              </text>
              <text x="80" y="44" textAnchor="middle" className="fill-cyan-400 font-mono text-[12px]">
                {formatReadingValue(flowB, 1)} LPM
              </text>
              <text x="80" y="60" textAnchor="middle" className="fill-slate-400 text-[9px]">
                Dual-Stage Ceramic Bed
              </text>
            </g>

            {/* OUTLET RESERVOIR & SENSORS */}
            <g transform="translate(860, 150)">
              <rect width="100" height="120" rx="8" fill="url(#tankGrad)" stroke="#10b981" strokeWidth="2" />
              <rect x="4" y="30" width="92" height="86" rx="4" fill="url(#waterGrad)" />
              <text x="50" y="24" textAnchor="middle" className="fill-slate-200 font-bold text-[11px]">
                OUTLET TANK
              </text>
              <text x="50" y="55" textAnchor="middle" className="fill-white font-mono font-bold text-[13px]">
                {formatReadingValue(measurements.turbidity_ntu)} NTU
              </text>
              <text x="50" y="75" textAnchor="middle" className="fill-emerald-300 font-mono text-[11px]">
                pH {formatReadingValue(measurements.ph)}
              </text>
              <text x="50" y="95" textAnchor="middle" className="fill-amber-300 font-mono text-[10px]">
                {formatReadingValue(measurements.temperature_c, 1)} °C
              </text>
            </g>
          </svg>
        </div>

        {/* Legend beneath the schematic */}
        <div className="mt-4 pt-4 border-t border-[#1e2a3e] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-sky-400 rounded" />
              <span>Fluid Line Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-slate-700 rounded" />
              <span>Fluid Line Idle</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Valve Open</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Valve Closed</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-cyan-400">
            Valve positions are reported by the ESP32; no remote control is available here.
          </div>
        </div>
      </div>

      {/* Hydraulic Performance & Actuation Logs */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Branch Switching Telemetry & Health Checks
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0b101c] p-3.5 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Pressure Differential</div>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">1.18 bar</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Nominal across filter bed</div>
          </div>

          <div className="bg-[#0b101c] p-3.5 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Active Filtration Run</div>
            <div className="text-lg font-bold font-mono text-cyan-400 mt-1">{latestReading?.run_id || '—'}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Alternating inlet/outlet cycle</div>
          </div>

          <div className="bg-[#0b101c] p-3.5 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Headspace Gas Reading</div>
            <div className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatReadingValue(measurements.mq5_adc, 0)} ADC
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Uncalibrated environmental monitor</div>
          </div>
        </div>
      </div>
    </div>
  );
};


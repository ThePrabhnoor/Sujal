import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Layers,
  ArrowRight,
  TrendingDown,
  Cpu,
  Send,
  CheckCircle2,
  AlertCircle,
  Radio,
  Clock,
  Gauge,
  Sliders
} from 'lucide-react';
import { RunComparison, CompletenessMetrics } from '../../types';
import { formatReadingValue } from '../../services/api';

interface DiagnosticsViewProps {
  comparison: RunComparison | null;
  completeness: CompletenessMetrics | null;
  nodeId: string;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  comparison,
  completeness,
  nodeId,
}) => {
  const inlet = comparison?.comparisons || {};
  const paired = comparison?.status === 'paired';

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-100">Run Comparison & Telemetry Diagnostics</h2>
        </div>
        <p className="text-xs text-slate-400">
          Inlet vs Outlet automated pair analysis and packet completeness health monitoring for node {nodeId}.
        </p>
      </div>

      {/* SECTION 1: Automated Run Pair Analysis */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Auto-Assigned Pair Sequence
            </span>
            <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
              Run Identifier: {comparison?.run_id || 'Waiting for a pair'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded border font-bold font-mono ${paired ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
              {paired ? 'PAIR MATCHED' : 'WAITING FOR PAIR'}
            </span>
            <span className="text-xs text-slate-400">Status: {comparison?.status || 'No comparison'}</span>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Inlet Sample Card */}
          <div className="bg-[#0b101c] border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                1. INLET INTAKE SAMPLE
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Pair T1</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Turbidity:</span>
                <span className="text-amber-300 font-bold">
                  {formatReadingValue(inlet.turbidity_ntu?.inlet)} NTU
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">pH Level:</span>
                <span className="text-slate-200">
                  {formatReadingValue(inlet.ph?.inlet)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Temperature:</span>
                <span className="text-slate-200">
                  {formatReadingValue(inlet.temperature_c?.inlet, 1)} °C
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Event Key:</span>
                <span className="text-slate-400 text-[10px] truncate max-w-[150px]">
                  {comparison?.received?.inlet ? 'Received' : 'Not received'}
                </span>
              </div>
            </div>
          </div>

          {/* Delta Calculation Card */}
          <div className="bg-gradient-to-b from-[#142033] to-[#0c1524] border border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between text-center relative overflow-hidden">
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Differential Calculation
            </div>

            <div className="my-3 space-y-2">
              <div className="text-4xl font-extrabold font-mono text-emerald-400 flex items-center justify-center gap-1">
                <TrendingDown className="w-7 h-7" />
                {comparison?.turbidity_reduction_pct == null ? '—' : `${comparison.turbidity_reduction_pct}%`}
              </div>
              <div className="text-xs text-slate-300 font-semibold">
                Turbidity Reduction Percentage
              </div>
              <div className="text-xs font-mono text-cyan-300/80">
                Δ NTU: {formatReadingValue(inlet.turbidity_ntu?.change)}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800 italic">
              Numeric changes only; not a safety assessment.
            </div>
          </div>

          {/* Outlet Sample Card */}
          <div className="bg-[#0b101c] border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                2. OUTLET FILTERED SAMPLE
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Pair T2</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Turbidity:</span>
                <span className="text-cyan-300 font-bold">
                  {formatReadingValue(inlet.turbidity_ntu?.outlet)} NTU
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">pH Level:</span>
                <span className="text-slate-200">
                  {formatReadingValue(inlet.ph?.outlet)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Temperature:</span>
                <span className="text-slate-200">
                  {formatReadingValue(inlet.temperature_c?.outlet, 1)} °C
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Event Key:</span>
                <span className="text-slate-400 text-[10px] truncate max-w-[150px]">
                  {comparison?.received?.outlet ? 'Received' : 'Not received'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Telemetry Cadence & Completeness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Packet Arrival Cadence & Health</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Expected Telemetry Cadence:</span>
              <span className="font-mono font-bold text-slate-200">
                {completeness?.expected_interval_seconds ?? 'Not configured'}{completeness?.expected_interval_seconds ? ' seconds' : ''}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Age of Latest Packet:</span>
              <span className="font-mono font-bold text-cyan-400">
                {completeness?.latest_packet_age_seconds == null ? '—' : `${Math.round(completeness.latest_packet_age_seconds)} seconds since last packet`}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Packet Completeness Ratio:</span>
              <span className="font-mono font-bold text-emerald-400">
                {completeness?.completeness_percent == null ? 'Not configured' : `${completeness.completeness_percent}% (${completeness.status})`}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-400">Packet Counts:</span>
              <span className="font-mono text-slate-300">
                {completeness ? `${completeness.received_packets} received / ${completeness.expected_packets} expected; ${completeness.duplicate_or_burst_packets} burst/duplicate` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ESP32 owns ingestion in real mode; the browser does not invent readings. */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-100">Reading source</h3>
          <p className="text-xs text-slate-400 mt-2">
            Values on this page come from saved backend readings. To add a reading, send it from the ESP32; browser-side simulated packets are disabled in live mode.
          </p>
        </div>
      </div>
    </div>
  );
};


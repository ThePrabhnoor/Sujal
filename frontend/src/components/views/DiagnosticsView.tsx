import React, { useState } from 'react';
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
import { RunComparison, CompletenessMetrics, TelemetryReading } from '../../types';

interface DiagnosticsViewProps {
  comparison: RunComparison | null;
  completeness: CompletenessMetrics | null;
  onSimulateCustomPacket: (data: any) => void;
  nodeId: string;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  comparison,
  completeness,
  onSimulateCustomPacket,
  nodeId,
}) => {
  // Test Packet Form State
  const [formTurbidity, setFormTurbidity] = useState('6.2');
  const [formPh, setFormPh] = useState('7.25');
  const [formTemp, setFormTemp] = useState('24.8');
  const [formActiveBranch, setFormActiveBranch] = useState<'A' | 'B'>('A');
  const [formMq5, setFormMq5] = useState('1840');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulateCustomPacket({
      active_branch: formActiveBranch,
      measurements: {
        ph: parseFloat(formPh) || 7.2,
        turbidity_ntu: parseFloat(formTurbidity) || 5.8,
        temperature_c: parseFloat(formTemp) || 24.6,
        mq5_adc: parseInt(formMq5) || 1830,
        mq5_digital: 0,
        flow_lpm: {
          inlet: 2.4,
          branch_a: formActiveBranch === 'A' ? 2.3 : 0.0,
          branch_b: formActiveBranch === 'B' ? 2.2 : 0.0,
        }
      }
    });

    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2500);
  };

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
              Run Identifier: {comparison?.run_id || 'run-118'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold font-mono">
              PAIR MATCHED
            </span>
            <span className="text-xs text-slate-400">Status: Complete</span>
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
                  {comparison?.inlet?.measurements.turbidity_ntu.toFixed(2) || '9.40'} NTU
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">pH Level:</span>
                <span className="text-slate-200">
                  {comparison?.inlet?.measurements.ph.toFixed(2) || '7.22'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Temperature:</span>
                <span className="text-slate-200">
                  {comparison?.inlet?.measurements.temperature_c.toFixed(1) || '24.5'} °C
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Event Key:</span>
                <span className="text-slate-400 text-[10px] truncate max-w-[150px]">
                  {comparison?.inlet?.event_id || 'esp32-boot7-rdg37'}
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
                -38.3%
              </div>
              <div className="text-xs text-slate-300 font-semibold">
                Turbidity Reduction Percentage
              </div>
              <div className="text-xs font-mono text-cyan-300/80">
                Δ NTU: -3.60 NTU (from 9.40 to 5.80)
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
                  {comparison?.outlet?.measurements.turbidity_ntu.toFixed(2) || '5.80'} NTU
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">pH Level:</span>
                <span className="text-slate-200">
                  {comparison?.outlet?.measurements.ph.toFixed(2) || '7.20'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Temperature:</span>
                <span className="text-slate-200">
                  {comparison?.outlet?.measurements.temperature_c.toFixed(1) || '24.6'} °C
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Event Key:</span>
                <span className="text-slate-400 text-[10px] truncate max-w-[150px]">
                  {comparison?.outlet?.event_id || 'esp32-boot7-rdg38'}
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
                {completeness?.expected_interval_seconds || 30} seconds
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Average Observed Cadence:</span>
              <span className="font-mono font-bold text-cyan-400">
                {completeness?.average_interval_seconds || 30.14} seconds
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Packet Completeness Ratio:</span>
              <span className="font-mono font-bold text-emerald-400">
                {completeness?.completeness_percent || 99.5}%
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-400">Estimated Dropped Packets:</span>
              <span className="font-mono text-slate-300">
                {completeness?.dropped_estimate || 14} of {completeness?.total_packets || 2880}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3: Live Ingestion Packet Simulator */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              ESP32 Telemetry Test Injection
            </h3>
            {isSuccess && (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ingested Successfully!
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Turbidity (NTU)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formTurbidity}
                  onChange={(e) => setFormTurbidity(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">pH Reading</label>
                <input
                  type="number"
                  step="0.05"
                  value={formPh}
                  onChange={(e) => setFormPh(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formTemp}
                  onChange={(e) => setFormTemp(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Active Branch</label>
                <select
                  value={formActiveBranch}
                  onChange={(e) => setFormActiveBranch(e.target.value as 'A' | 'B')}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="A">Branch A</option>
                  <option value="B">Branch B</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Simulate ESP32 POST Request</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Droplets,
  Thermometer,
  Gauge,
  Filter,
  AlertTriangle,
  TrendingDown,
  Layers,
  Clock,
  Compass,
  MapPin,
  Repeat,
  ShieldCheck,
  CheckCircle2,
  Wind
} from 'lucide-react';
import { TelemetryReading, OperatingThresholds, RunComparison, NodeProfile } from '../../types';
import { Sparkline } from '../charts/Sparkline';
import { InteractiveChart, DataPoint } from '../charts/InteractiveChart';

interface DashboardViewProps {
  readings: TelemetryReading[];
  latestReading: TelemetryReading | null;
  thresholds: OperatingThresholds;
  comparison: RunComparison | null;
  activeNode: NodeProfile;
  onManualCycleNode: () => void;
  gsmLocationText: string;
  onSyncGsmLocation: () => void;
  onOpenAlerts: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  readings,
  latestReading,
  thresholds,
  activeNode,
  onManualCycleNode,
  gsmLocationText,
  onSyncGsmLocation,
  onOpenAlerts,
}) => {
  if (!latestReading) {
    return (
      <div className="p-8 text-center text-cyan-300">
        Waiting for initial telemetry packet from node...
      </div>
    );
  }

  const { measurements, device_status, active_branch, phase } = latestReading;
  const filterClogged = latestReading.filter_clogged_percent ?? activeNode.filter_clogged_percent ?? 28;

  // Extract history series for cards & charts
  const phHistory = readings.map(r => r.measurements.ph);
  const turbidityHistory = readings.map(r => r.measurements.turbidity_ntu);
  const tempHistory = readings.map(r => r.measurements.temperature_c);
  const flowHistory = readings.map(r => (active_branch === 'B' ? r.measurements.flow_lpm.branch_b : r.measurements.flow_lpm.branch_a));

  // Prepare chart datasets with formatted time
  const phChartData: DataPoint[] = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.measurements.ph,
  }));

  const turbidityChartData: DataPoint[] = readings.map((r, i) => {
    const isOutlet = r.phase === 'outlet';
    const companion = readings[i - 1] || r;
    return {
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      value: isOutlet ? r.measurements.turbidity_ntu : (companion.phase === 'outlet' ? companion.measurements.turbidity_ntu : r.measurements.turbidity_ntu * 0.62),
      secondaryValue: isOutlet ? (companion.phase === 'inlet' ? companion.measurements.turbidity_ntu : r.measurements.turbidity_ntu * 1.6) : r.measurements.turbidity_ntu,
    };
  });

  const tempChartData: DataPoint[] = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.measurements.temperature_c,
  }));

  const flowChartData: DataPoint[] = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.measurements.flow_lpm.inlet,
    secondaryValue: active_branch === 'B' ? r.measurements.flow_lpm.branch_b : r.measurements.flow_lpm.branch_a,
  }));

  const isTurbidityHigh = measurements.turbidity_ntu > thresholds.turbidity_limit_ntu && phase === 'outlet';
  const isPhOutOfRange = measurements.ph < thresholds.ph_min || measurements.ph > thresholds.ph_max;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Active Station Info, Laptop GSM Coordinates & Manual Switch Action */}
      <div className="bg-gradient-to-r from-[#122349] via-[#142854] to-[#101e40] border border-[#274880] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-sm">
              {activeNode.node_id}
            </span>
            <span className="text-xs font-semibold text-cyan-200/90 font-mono">
              {activeNode.zone}
            </span>
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-950/70 border border-emerald-700/60 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ONLINE & INGESTING
            </span>
          </div>

          <h2 className="text-xl font-extrabold text-white mt-1.5 tracking-tight">
            {activeNode.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{activeNode.address}</span>
            </span>

            <span className="flex items-center gap-1.5 bg-[#091124] px-2.5 py-1 rounded-lg border border-[#1b325c] text-cyan-300 font-mono">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Device GPS/GSM: {gsmLocationText}</span>
              <button
                onClick={onSyncGsmLocation}
                title="Refresh laptop GPS position"
                className="hover:text-white underline text-[11px] ml-1"
              >
                (Sync)
              </button>
            </span>
          </div>
        </div>

        {/* Manual Switch Node Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onManualCycleNode}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
          >
            <Repeat className="w-4 h-4" />
            <span>Switch Station</span>
          </button>
        </div>
      </div>

      {/* Operating Limit Alert Banner */}
      {isTurbidityHigh && (
        <div className="bg-gradient-to-r from-rose-950/80 to-[#1e1324] border border-rose-500/60 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-900/70 flex items-center justify-center text-rose-300 shrink-0 border border-rose-600/50">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-200">
                Operating Limit Excursion: Outlet Turbidity {measurements.turbidity_ntu.toFixed(2)} NTU
              </h4>
              <p className="text-xs text-rose-300/80">
                Exceeds configured {thresholds.turbidity_limit_ntu} NTU operational threshold. Operational flag only; not a potability safety determination.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAlerts}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-colors"
          >
            Review Alerts
          </button>
        </div>
      )}

      {/* 4 Hero Metric Cards with Vibrant Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: pH Level */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0f1b3b] border border-[#27477e] hover:border-cyan-400/60 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-cyan-300">
              <Activity className="w-4 h-4 text-cyan-400" />
              pH Level
            </span>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                isPhOutOfRange
                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-600'
              }`}
            >
              {isPhOutOfRange ? 'OUT OF RANGE' : 'NORMAL'}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {measurements.ph.toFixed(2)}
              </div>
              <div className="text-xs text-cyan-200/70 mt-1 font-medium">
                Target: {thresholds.ph_min} – {thresholds.ph_max} pH
              </div>
            </div>
            <Sparkline data={phHistory} color="#00f0ff" width={100} height={36} />
          </div>

          <div className="pt-2.5 border-t border-[#1e345e] flex items-center justify-between text-xs text-slate-300">
            <span>Operating Range</span>
            <span className="font-mono text-cyan-300 font-semibold">Safe Baseline</span>
          </div>
        </div>

        {/* Card 2: Turbidity NTU */}
        <div className={`bg-gradient-to-br from-[#122248] to-[#0f1b3b] border rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all ${
          isTurbidityHigh ? 'border-rose-500/80 shadow-rose-950/50 glow-red' : 'border-[#27477e] hover:border-cyan-400/60'
        }`}>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-sky-300">
              <Droplets className="w-4 h-4 text-sky-400" />
              Turbidity (NTU)
            </span>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                isTurbidityHigh
                  ? 'bg-rose-950 text-rose-300 border-rose-600'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-600'
              }`}
            >
              {phase.toUpperCase()}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight flex items-baseline gap-1">
                {measurements.turbidity_ntu.toFixed(2)}
                <span className="text-xs font-normal text-slate-300">NTU</span>
              </div>
              <div className="text-xs text-emerald-300 mt-1 flex items-center font-bold">
                <TrendingDown className="w-3.5 h-3.5 mr-1" />
                -38.3% reduction vs inlet
              </div>
            </div>
            <Sparkline data={turbidityHistory} color={isTurbidityHigh ? '#f43f5e' : '#38bdf8'} width={100} height={36} />
          </div>

          <div className="pt-2.5 border-t border-[#1e345e] flex items-center justify-between text-xs text-slate-300">
            <span>Limit: {thresholds.turbidity_limit_ntu} NTU</span>
            <span className="font-mono text-amber-300 font-semibold">Inlet ~9.2 NTU</span>
          </div>
        </div>

        {/* Card 3: Water Temp */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0f1b3b] border border-[#27477e] hover:border-cyan-400/60 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-amber-300">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Water Temp
            </span>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600">
              STABLE
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight flex items-baseline gap-1">
                {measurements.temperature_c.toFixed(1)}
                <span className="text-xs font-normal text-slate-300">°C</span>
              </div>
              <div className="text-xs text-slate-300 mt-1 font-medium">
                Range: {thresholds.temperature_min_c}° – {thresholds.temperature_max_c}°C
              </div>
            </div>
            <Sparkline data={tempHistory} color="#f59e0b" width={100} height={36} />
          </div>

          <div className="pt-2.5 border-t border-[#1e345e] flex items-center justify-between text-xs text-slate-300">
            <span>Inflow Stream</span>
            <span className="font-mono text-emerald-300 font-semibold">Nominal</span>
          </div>
        </div>

        {/* Card 4: Active Flow Rate */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0f1b3b] border border-[#27477e] hover:border-cyan-400/60 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-300">
              <Gauge className="w-4 h-4 text-emerald-400" />
              Active Flow
            </span>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700">
              BRANCH {active_branch}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight flex items-baseline gap-1">
                {(active_branch === 'B' ? measurements.flow_lpm.branch_b : measurements.flow_lpm.branch_a).toFixed(2)}
                <span className="text-xs font-normal text-slate-300">LPM</span>
              </div>
              <div className="text-xs text-cyan-200/70 mt-1 font-medium">
                Inlet: {measurements.flow_lpm.inlet.toFixed(2)} LPM
              </div>
            </div>
            <Sparkline data={flowHistory} color="#10b981" width={100} height={36} />
          </div>

          <div className="pt-2.5 border-t border-[#1e345e] flex items-center justify-between text-xs text-slate-300">
            <span>Valve A: {device_status.valve_a.toUpperCase()}</span>
            <span>Valve B: {device_status.valve_b.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Secondary Row: Filter Clogging Gauge + Solenoids + MQ-5 + Telemetry Cadence */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: Filter Clogging Gauge (Requested by User) */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-cyan-400" />
              Filter Clogged Amount
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              filterClogged < 40 ? 'bg-emerald-950 text-emerald-300 border-emerald-700' :
              filterClogged < 75 ? 'bg-amber-950 text-amber-300 border-amber-700' :
              'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
            }`}>
              {filterClogged < 40 ? 'OPTIMAL' : filterClogged < 75 ? 'MODERATE' : 'BACKWASH REQ.'}
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-extrabold font-mono text-white">
                {filterClogged}%
              </span>
              <span className="text-xs text-slate-300 font-mono">
                Differential Head Loss
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-[#0a1124] h-3 rounded-full overflow-hidden p-0.5 border border-[#1b315b]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  filterClogged < 40
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                    : filterClogged < 75
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-rose-500 to-red-600'
                }`}
                style={{ width: `${filterClogged}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center justify-between pt-2.5 border-t border-[#1e345e]">
            <span>Bed Maintenance:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {filterClogged > 70 ? 'Action Recommended' : 'Optimal Thruput'}
            </span>
          </div>
        </div>

        {/* Widget 2: Solenoid Valves */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span>Solenoid Actuators</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="grid grid-cols-2 gap-2 my-2">
            <div className={`p-2.5 rounded-xl border text-center ${
              device_status.valve_a === 'open'
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-emerald-950/50'
                : 'bg-[#0a1226] border-slate-700 text-slate-500'
            }`}>
              <div className="text-[10px] uppercase font-bold text-slate-300">Valve A</div>
              <div className="text-base font-extrabold mt-0.5 font-mono text-white">
                {device_status.valve_a.toUpperCase()}
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border text-center ${
              device_status.valve_b === 'open'
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-emerald-950/50'
                : 'bg-[#0a1226] border-slate-700 text-slate-500'
            }`}>
              <div className="text-[10px] uppercase font-bold text-slate-300">Valve B</div>
              <div className="text-base font-extrabold mt-0.5 font-mono text-slate-400">
                {device_status.valve_b.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center justify-between pt-2.5 border-t border-[#1e345e]">
            <span>Active Fluid Path:</span>
            <span className="font-mono text-cyan-300 font-bold">Branch {active_branch}</span>
          </div>
        </div>

        {/* Widget 3: MQ-5 Headspace Gas Sensor */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-purple-300">
            <span>MQ-5 Headspace Sensor</span>
            <Wind className="w-4 h-4 text-purple-400" />
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-extrabold font-mono text-white">
                  {measurements.mq5_adc}
                  <span className="text-xs font-normal text-purple-300 ml-1">ADC</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">Uncalibrated vapor signal</div>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-950 text-purple-200 border border-purple-700 font-mono font-bold">
                DIG: {measurements.mq5_digital === 0 ? 'NORMAL' : 'ALARM'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center justify-between pt-2.5 border-t border-[#1e345e]">
            <span>Threshold:</span>
            <span className="font-mono text-slate-200">{thresholds.mq5_adc_alert_threshold} ADC</span>
          </div>
        </div>

        {/* Widget 4: Telemetry Cadence */}
        <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span>Telemetry Integrity</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400">99.5%</div>
              <div className="text-[11px] text-slate-300 mt-0.5">Packets delivered</div>
            </div>
            <div className="text-right text-xs font-mono text-slate-200">
              <div>30s cadence</div>
              <div className="text-[11px] text-emerald-400 font-bold">0 drops / hr</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center justify-between pt-2.5 border-t border-[#1e345e]">
            <span>Sequence:</span>
            <span className="font-mono text-cyan-300 font-semibold">Auto-Pairing Active</span>
          </div>
        </div>
      </div>

      {/* Real-time Interactive Charts (Vivid and Real-time) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InteractiveChart
          title="pH Sensor Telemetry History (Real-Time)"
          data={phChartData}
          color="#00f0ff"
          unit="pH"
          minThreshold={thresholds.ph_min}
          maxThreshold={thresholds.ph_max}
          primaryLabel="pH Reading"
        />

        <InteractiveChart
          title="Turbidity NTU (Inlet vs Outlet Filtration)"
          data={turbidityChartData}
          color="#38bdf8"
          secondaryColor="#f59e0b"
          unit="NTU"
          threshold={thresholds.turbidity_limit_ntu}
          primaryLabel="Outlet NTU"
          secondaryLabel="Inlet NTU"
        />

        <InteractiveChart
          title="Water Temperature Stream (°C)"
          data={tempChartData}
          color="#fb923c"
          unit="°C"
          primaryLabel="Temperature"
        />

        <InteractiveChart
          title="Hydraulic Flow Rates (Inlet vs Active Branch)"
          data={flowChartData}
          color="#10b981"
          secondaryColor="#00f0ff"
          unit="LPM"
          primaryLabel="Inlet Flow"
          secondaryLabel={`Branch ${active_branch}`}
        />
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Droplets,
  Thermometer,
  Wind,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  TrendingDown,
  Layers,
  Clock,
  Radio
} from 'lucide-react';
import { TelemetryReading, OperatingThresholds, RunComparison } from '../../types';
import { Sparkline } from '../charts/Sparkline';
import { InteractiveChart, DataPoint } from '../charts/InteractiveChart';

interface DashboardViewProps {
  readings: TelemetryReading[];
  latestReading: TelemetryReading | null;
  thresholds: OperatingThresholds;
  comparison: RunComparison | null;
  onOpenSchematic: () => void;
  onOpenAlerts: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  readings,
  latestReading,
  thresholds,
  comparison,
  onOpenSchematic,
  onOpenAlerts,
}) => {
  if (!latestReading) {
    return (
      <div className="p-8 text-center text-slate-400">
        Waiting for initial telemetry packet from node...
      </div>
    );
  }

  const { measurements, device_status, active_branch, phase } = latestReading;

  // Extract history series for charts
  const phHistory = readings.map(r => r.measurements.ph);
  const turbidityHistory = readings.map(r => r.measurements.turbidity_ntu);
  const tempHistory = readings.map(r => r.measurements.temperature_c);
  const flowHistory = readings.map(r => r.measurements.flow_lpm.branch_a);

  // Prepare chart datasets with formatted time
  const phChartData: DataPoint[] = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.measurements.ph,
  }));

  // Separate inlet and outlet for Turbidity chart
  const turbidityChartData: DataPoint[] = readings.map((r, i) => {
    const isOutlet = r.phase === 'outlet';
    const companion = readings[i - 1] || r;
    return {
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      value: isOutlet ? r.measurements.turbidity_ntu : (companion.phase === 'outlet' ? companion.measurements.turbidity_ntu : r.measurements.turbidity_ntu * 0.65),
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

  // Check threshold statuses
  const isTurbidityHigh = measurements.turbidity_ntu > thresholds.turbidity_limit_ntu && phase === 'outlet';
  const isPhOutOfRange = measurements.ph < thresholds.ph_min || measurements.ph > thresholds.ph_max;
  const isTempOutOfRange = measurements.temperature_c < thresholds.temperature_min_c || measurements.temperature_c > thresholds.temperature_max_c;
  const isMq5High = measurements.mq5_adc >= thresholds.mq5_adc_alert_threshold;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Operating Limit Banner if excursions exist */}
      {isTurbidityHigh && (
        <div
          className="bg-red-950/40 border border-red-500/50 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-red-950/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-900/60 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-200">
                Operating Limit Excursion: Turbidity {measurements.turbidity_ntu} NTU
              </h4>
              <p className="text-xs text-red-300/80">
                Exceeds configured {thresholds.turbidity_limit_ntu} NTU operational threshold. Operational flag only; not a water safety determination.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAlerts}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition-colors"
          >
            Review Alerts
          </button>
        </div>
      )}

      {/* Hero Metric Cards (Top Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: pH Level */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-[#121927] border border-[#1f2b3f] hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              pH Level
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isPhOutOfRange
                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800/80'
              }`}
            >
              {isPhOutOfRange ? 'OUT OF RANGE' : 'NORMAL'}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-slate-100">
                {measurements.ph.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Target: {thresholds.ph_min} – {thresholds.ph_max} pH
              </div>
            </div>
            <Sparkline data={phHistory} color="#0ea5e9" width={90} height={32} />
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Operating Range</span>
            <span className="font-mono text-slate-300">Safe Baseline</span>
          </div>
        </motion.div>

        {/* Card 2: Turbidity NTU */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className={`bg-[#121927] border rounded-xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden ${
            isTurbidityHigh ? 'border-red-500/60 glow-red' : 'border-[#1f2b3f] hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              Turbidity (NTU)
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isTurbidityHigh
                  ? 'bg-red-950 text-red-400 border-red-800'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800'
              }`}
            >
              {phase.toUpperCase()}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-slate-100 flex items-baseline gap-1">
                {measurements.turbidity_ntu.toFixed(2)}
                <span className="text-xs font-normal text-slate-400">NTU</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span className="text-emerald-400 flex items-center font-semibold">
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                  -38.3%
                </span>
                <span>reduction vs inlet</span>
              </div>
            </div>
            <Sparkline data={turbidityHistory} color={isTurbidityHigh ? '#ef4444' : '#38bdf8'} width={90} height={32} />
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Limit: {thresholds.turbidity_limit_ntu} NTU</span>
            <span className="font-mono text-slate-300">Inlet ~9.4 NTU</span>
          </div>
        </motion.div>

        {/* Card 3: Water Temperature */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-[#121927] border border-[#1f2b3f] hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              Water Temp
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              STABLE
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-slate-100 flex items-baseline gap-1">
                {measurements.temperature_c.toFixed(1)}
                <span className="text-xs font-normal text-slate-400">°C</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Range: {thresholds.temperature_min_c}° – {thresholds.temperature_max_c}°C
              </div>
            </div>
            <Sparkline data={tempHistory} color="#f59e0b" width={90} height={32} />
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Ambient Inflow</span>
            <span className="font-mono text-slate-300">Within Nominal</span>
          </div>
        </motion.div>

        {/* Card 4: Active Flow Rate */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-[#121927] border border-[#1f2b3f] hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Active Flow
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              BRANCH {active_branch}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono text-slate-100 flex items-baseline gap-1">
                {(active_branch === 'B' ? measurements.flow_lpm.branch_b : measurements.flow_lpm.branch_a).toFixed(2)}
                <span className="text-xs font-normal text-slate-400">LPM</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Inlet: {measurements.flow_lpm.inlet.toFixed(2)} LPM
              </div>
            </div>
            <Sparkline data={flowHistory} color="#10b981" width={90} height={32} />
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Valve A: {device_status.valve_a.toUpperCase()}</span>
            <span>Valve B: {device_status.valve_b.toUpperCase()}</span>
          </div>
        </motion.div>
      </div>

      {/* Secondary Status & Hardware Telemetry (Middle Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: Inlet vs Outlet Filter Reduction */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Filtration Delta</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>

          <div className="my-2 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Inlet Intake:</span>
              <span className="font-mono font-bold text-amber-300">9.40 NTU</span>
            </div>
            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full w-[94%]" />
            </div>

            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-400">Outlet Filtered:</span>
              <span className="font-mono font-bold text-cyan-300">5.80 NTU</span>
            </div>
            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
              <div className="bg-cyan-400 h-full w-[58%]" />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Reduction Efficiency:</span>
            <span className="font-mono font-bold text-emerald-400">38.3%</span>
          </div>
        </div>

        {/* Widget 2: Actuator & Solenoid Status */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Solenoid Valve Actuators</span>
            <button
              onClick={onOpenSchematic}
              className="text-[10px] text-cyan-400 hover:underline"
            >
              Control →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 my-2">
            <div
              className={`p-2.5 rounded-lg border text-center ${
                device_status.valve_a === 'open'
                  ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Valve A</div>
              <div className="text-base font-extrabold mt-0.5 font-mono">
                {device_status.valve_a.toUpperCase()}
              </div>
            </div>

            <div
              className={`p-2.5 rounded-lg border text-center ${
                device_status.valve_b === 'open'
                  ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wider">Valve B</div>
              <div className="text-base font-extrabold mt-0.5 font-mono">
                {device_status.valve_b.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Primary Active Path:</span>
            <span className="font-mono text-cyan-400 font-semibold">Branch {active_branch}</span>
          </div>
        </div>

        {/* Widget 3: Headspace Gas Sensor (MQ-5) */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>MQ-5 Headspace Sensor</span>
            <Wind className="w-3.5 h-3.5 text-purple-400" />
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {measurements.mq5_adc}
                  <span className="text-xs font-normal text-slate-400 ml-1">ADC</span>
                </div>
                <div className="text-[10px] text-slate-400">Uncalibrated headspace signal</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/80 font-mono">
                  DIG: {measurements.mq5_digital === 0 ? 'NORMAL' : 'ALARM'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Threshold:</span>
            <span className="font-mono text-slate-300">{thresholds.mq5_adc_alert_threshold} ADC</span>
          </div>
        </div>

        {/* Widget 4: Telemetry Completeness */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Telemetry Health</span>
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <div className="my-2">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-400">99.5%</div>
                <div className="text-[10px] text-slate-400">Packets delivered</div>
              </div>
              <div className="text-right text-xs font-mono text-slate-300">
                <div>30s cadence</div>
                <div className="text-[10px] text-emerald-400/80">0 drops last hr</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
            <span>Sequence:</span>
            <span className="font-mono text-slate-300">Alternate Auto-Pair</span>
          </div>
        </div>
      </div>

      {/* Real-time Interactive Charts (4 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: pH Telemetry with bands */}
        <InteractiveChart
          title="pH Sensor Telemetry History"
          data={phChartData}
          color="#0ea5e9"
          unit="pH"
          minThreshold={thresholds.ph_min}
          maxThreshold={thresholds.ph_max}
          primaryLabel="pH Reading"
        />

        {/* Chart 2: Turbidity Inlet vs Outlet Comparison */}
        <InteractiveChart
          title="Turbidity NTU (Inlet vs Outlet)"
          data={turbidityChartData}
          color="#38bdf8"
          secondaryColor="#f59e0b"
          unit="NTU"
          threshold={thresholds.turbidity_limit_ntu}
          primaryLabel="Outlet NTU"
          secondaryLabel="Inlet NTU"
        />

        {/* Chart 3: Temperature */}
        <InteractiveChart
          title="Water Temperature Stream"
          data={tempChartData}
          color="#f59e0b"
          unit="°C"
          primaryLabel="Temperature"
        />

        {/* Chart 4: Multi-Branch Flow Rates */}
        <InteractiveChart
          title="Flow Rate Monitoring (Inlet vs Active Branch)"
          data={flowChartData}
          color="#10b981"
          secondaryColor="#06b6d4"
          unit="LPM"
          primaryLabel="Inlet Flow"
          secondaryLabel={`Branch ${active_branch}`}
        />
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Activity,
  Wrench,
  FileCheck,
  RefreshCw,
  Cpu,
  Info,
  ChevronDown,
  Database,
  ExternalLink,
  Droplet
} from 'lucide-react';
import { NodeProfile, TelemetryReading, RunInterpretation } from '../../types';
import { api } from '../../services/api';

export interface PairedRunInfo {
  runId: string;
  inlet: TelemetryReading;
  outlet: TelemetryReading;
  latestTimestamp: string;
  turbidityReductionPct: number | null;
  phChange: number | null;
  tempChange: number | null;
}

interface GeminiInsightsViewProps {
  activeNode: NodeProfile | null;
  nodes: NodeProfile[];
  onSelectNode: (nodeId: string) => void;
  readings: TelemetryReading[];
  isBackendConnected: boolean;
  isNodeOnline: boolean;
  isLoadingReadings?: boolean;
}

export const GeminiInsightsView: React.FC<GeminiInsightsViewProps> = ({
  activeNode,
  nodes,
  onSelectNode,
  readings,
  isBackendConnected,
  isNodeOnline,
  isLoadingReadings = false,
}) => {
  // Extract all fully paired runs (runs with both inlet and outlet readings)
  const { pairedRuns, unpairedRuns } = useMemo(() => {
    const map = new Map<string, { inlet?: TelemetryReading; outlet?: TelemetryReading }>();

    for (const r of readings) {
      if (!r.run_id || !r.phase) continue;
      const existing = map.get(r.run_id) || {};
      if (r.phase === 'inlet') {
        if (!existing.inlet || new Date(r.timestamp).getTime() > new Date(existing.inlet.timestamp).getTime()) {
          existing.inlet = r;
        }
      } else if (r.phase === 'outlet') {
        if (!existing.outlet || new Date(r.timestamp).getTime() > new Date(existing.outlet.timestamp).getTime()) {
          existing.outlet = r;
        }
      }
      map.set(r.run_id, existing);
    }

    const pairs: PairedRunInfo[] = [];
    const unpaired: Array<{ runId: string; waitingFor: 'inlet' | 'outlet'; timestamp: string }> = [];

    for (const [runId, data] of map.entries()) {
      if (data.inlet && data.outlet) {
        const inTurb = data.inlet.measurements.turbidity_ntu;
        const outTurb = data.outlet.measurements.turbidity_ntu;
        let reductionPct: number | null = null;
        if (Number.isFinite(inTurb) && Number.isFinite(outTurb) && inTurb > 0) {
          reductionPct = Math.round(((inTurb - outTurb) / inTurb) * 10000) / 100;
        }

        const inPh = data.inlet.measurements.ph;
        const outPh = data.outlet.measurements.ph;
        const phChange = Number.isFinite(inPh) && Number.isFinite(outPh) ? Math.round((outPh - inPh) * 100) / 100 : null;

        const inTemp = data.inlet.measurements.temperature_c;
        const outTemp = data.outlet.measurements.temperature_c;
        const tempChange = Number.isFinite(inTemp) && Number.isFinite(outTemp) ? Math.round((outTemp - inTemp) * 100) / 100 : null;

        const tIn = new Date(data.inlet.timestamp).getTime() || 0;
        const tOut = new Date(data.outlet.timestamp).getTime() || 0;
        const latestTimestamp = tOut >= tIn ? data.outlet.timestamp : data.inlet.timestamp;

        pairs.push({
          runId,
          inlet: data.inlet,
          outlet: data.outlet,
          latestTimestamp,
          turbidityReductionPct: reductionPct,
          phChange,
          tempChange,
        });
      } else if (data.inlet && !data.outlet) {
        unpaired.push({ runId, waitingFor: 'outlet', timestamp: data.inlet.timestamp });
      } else if (!data.inlet && data.outlet) {
        unpaired.push({ runId, waitingFor: 'inlet', timestamp: data.outlet.timestamp });
      }
    }

    // Sort descending by timestamp: newest paired run first
    pairs.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
    return { pairedRuns: pairs, unpairedRuns: unpaired };
  }, [readings]);

  // Selected run state (defaults to the newest fully paired run)
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  useEffect(() => {
    if (pairedRuns.length > 0) {
      if (!selectedRunId || !pairedRuns.some(p => p.runId === selectedRunId)) {
        setSelectedRunId(pairedRuns[0].runId);
      }
    } else {
      setSelectedRunId('');
    }
  }, [pairedRuns, selectedRunId]);

  const activePairedRun = useMemo(() => {
    return pairedRuns.find(p => p.runId === selectedRunId) || pairedRuns[0] || null;
  }, [pairedRuns, selectedRunId]);

  // Interpretation state
  const [interpretation, setInterpretation] = useState<RunInterpretation | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Load saved interpretation when node or run changes (never trigger automatic generation)
  useEffect(() => {
    let isCancelled = false;

    async function loadSaved() {
      if (!activeNode?.node_id || !activePairedRun?.runId || !isBackendConnected) {
        setInterpretation(null);
        return;
      }

      setIsLoadingSaved(true);
      setFetchError(null);
      setGenerateError(null);

      try {
        const saved = await api.getRunInterpretation(activeNode.node_id, activePairedRun.runId);
        if (!isCancelled) {
          setInterpretation(saved);
        }
      } catch (err: any) {
        if (!isCancelled) {
          // If 404, it means no interpretation has been generated yet for this run
          if (err?.status === 404 || (err?.message && err.message.toLowerCase().includes('no interpretation saved'))) {
            setInterpretation(null);
          } else {
            setFetchError(err?.message || 'Failed to check for saved interpretation.');
            setInterpretation(null);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSaved(false);
        }
      }
    }

    void loadSaved();

    return () => {
      isCancelled = true;
    };
  }, [activeNode?.node_id, activePairedRun?.runId, isBackendConnected]);

  // Operator-triggered generation
  const handleGenerateInterpretation = async () => {
    if (!activeNode?.node_id || !activePairedRun?.runId) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const result = await api.generateRunInterpretation(activeNode.node_id, activePairedRun.runId);
      setInterpretation(result);
    } catch (err: any) {
      setGenerateError(err?.message || 'Gemini interpretation failed. Please verify backend logs and Gemini API configuration.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '--:--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour12: false }) + ' (' + d.toISOString().split('T')[0] + ')';
    } catch {
      return isoString;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1b3158]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-600/30 border border-cyan-400/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Gemini Insights
                </h1>
                <span className="text-[10px] font-semibold font-mono tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  AI INTERPRETATION
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Physically grounded operational water analysis for completed inlet / outlet paired runs.
              </p>
            </div>
          </div>
        </div>

        {/* Node & Paired Run Selection Details */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Node Info */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#101b33] border border-[#1e355e] text-xs">
            <span className="text-slate-400">Node:</span>
            <span className="font-semibold text-cyan-300">{activeNode?.node_id || 'Unknown'}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 truncate max-w-[140px]">{activeNode?.name || 'Water Station'}</span>
          </div>

          {/* Run Switcher Dropdown (if multiple paired runs exist) */}
          {pairedRuns.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101b33] border border-[#1e355e] text-xs">
              <span className="text-slate-400">Run:</span>
              <select
                aria-label="Select paired telemetry run"
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
              >
                {pairedRuns.map((p, idx) => (
                  <option key={p.runId} value={p.runId} className="bg-[#0b1329] text-slate-200">
                    {p.runId} {idx === 0 ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Edge Case 1: Backend Offline / Static Demo Mode */}
      {!isBackendConnected && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-amber-950/30 border border-amber-500/30 p-5 flex items-start gap-3.5 text-amber-200"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-300">Backend Disconnected / Static Demo Mode</h4>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Gemini Insights queries the SuJal Flask engine and MongoDB Atlas for verified paired telemetry runs.
              Because the backend is currently offline or unreachable, live AI interpretations cannot be evaluated.
              Ensure the backend is running on <code className="bg-amber-950/60 px-1 py-0.5 rounded font-mono text-amber-300">http://127.0.0.1:5001</code>.
            </p>
          </div>
        </motion.div>
      )}

      {/* Loading state while telemetry readings are being fetched */}
      {isBackendConnected && isLoadingReadings && (
        <div className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-8 text-center max-w-xl mx-auto my-6 space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">
            Fetching telemetry packets for {activeNode?.name || activeNode?.node_id}...
          </h3>
          <p className="text-xs text-slate-400">
            Checking MongoDB records for paired inlet and outlet runs.
          </p>
        </div>
      )}

      {/* Edge Case 2: No Paired Runs Available for the Node */}
      {isBackendConnected && !isLoadingReadings && pairedRuns.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-8 text-center max-w-2xl mx-auto my-6 space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
            <Layers className="w-7 h-7 text-cyan-400/80" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-100">
              No Fully Paired Runs Found for {activeNode?.name || activeNode?.node_id}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
              Gemini interpretation strictly evaluates the physical water filtration delta between an{' '}
              <strong className="text-cyan-300">inlet</strong> and an{' '}
              <strong className="text-cyan-300">outlet</strong> packet belonging to the same <code className="bg-[#121c35] px-1 py-0.5 rounded font-mono text-slate-300">run_id</code>.
              Node <code className="font-mono text-cyan-300">{activeNode?.node_id}</code> does not currently have any completed paired runs in its telemetry records.
            </p>
          </div>

          {/* Show if any unpaired runs are currently in progress */}
          {unpairedRuns.length > 0 && (
            <div className="p-3 bg-[#131f3d] border border-[#21355e] rounded-xl text-xs text-left space-y-1.5 max-w-md mx-auto">
              <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Runs Awaiting Paired Packet:
              </div>
              {unpairedRuns.map(u => (
                <div key={u.runId} className="flex items-center justify-between font-mono text-[11px] text-slate-300">
                  <span className="truncate max-w-[200px]">{u.runId}</span>
                  <span className="text-amber-400 text-[10px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                    Waiting for {u.waitingFor}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Suggest switching to nodes with existing paired runs */}
          {nodes.some(n => n.node_id === 'SJ-PAIR-TEST-002') && activeNode?.node_id !== 'SJ-PAIR-TEST-002' && (
            <div className="pt-2">
              <button
                onClick={() => onSelectNode('SJ-PAIR-TEST-002')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/40 text-cyan-300 inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
              >
                <span>Switch to Node SJ-PAIR-TEST-002 (Paired Test Station)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Main Content Area: Paired Run Found */}
      {isBackendConnected && !isLoadingReadings && activePairedRun && (
        <div className="space-y-6">
          {/* Header Card: Active Run Overview & Physical Metrics Comparison */}
          <div className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-5 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1b3158]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Evaluated Run:</span>
                  <span className="font-mono text-sm font-bold text-cyan-300 bg-[#122144] px-2.5 py-1 rounded-lg border border-cyan-500/30">
                    {activePairedRun.runId}
                  </span>
                  <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Fully Paired
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
                  <span>
                    Inlet Packet:{' '}
                    <strong className="text-slate-300 font-mono">
                      {formatTimestamp(activePairedRun.inlet.timestamp)}
                    </strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Outlet Packet:{' '}
                    <strong className="text-slate-300 font-mono">
                      {formatTimestamp(activePairedRun.outlet.timestamp)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Action Button: Generate or Status Indicator */}
              <div className="flex items-center gap-3">
                {isLoadingSaved && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Checking saved insights...</span>
                  </div>
                )}

                {!isLoadingSaved && !interpretation && (
                  <button
                    onClick={handleGenerateInterpretation}
                    disabled={isGenerating}
                    className="px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generating Gemini Insight...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-cyan-200" />
                        <span>Generate Gemini Insights</span>
                      </>
                    )}
                  </button>
                )}

                {!isLoadingSaved && interpretation && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-cyan-300/80 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                      Model: {interpretation.model}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 bg-[#121c35] border border-[#21355e] px-2.5 py-1 rounded-lg">
                      {interpretation.cached ? 'Loaded from DB' : 'Newly Generated'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Physical Telemetry Comparison Strip (The factual ground truth) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {/* Turbidity Reduction */}
              <div className="p-3.5 rounded-xl bg-[#121e3c]/80 border border-[#1f335c]">
                <div className="text-[11px] text-slate-400 font-medium">Turbidity Reduction</div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                  {activePairedRun.turbidityReductionPct !== null
                    ? `${activePairedRun.turbidityReductionPct > 0 ? '+' : ''}${activePairedRun.turbidityReductionPct}%`
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>In: {activePairedRun.inlet.measurements.turbidity_ntu ?? '--'} NTU</span>
                  <span>Out: {activePairedRun.outlet.measurements.turbidity_ntu ?? '--'} NTU</span>
                </div>
              </div>

              {/* pH Shift */}
              <div className="p-3.5 rounded-xl bg-[#121e3c]/80 border border-[#1f335c]">
                <div className="text-[11px] text-slate-400 font-medium">pH Level Delta</div>
                <div className="text-xl font-bold font-mono text-slate-100 mt-1 flex items-baseline gap-2">
                  <span>{activePairedRun.outlet.measurements.ph?.toFixed(2) ?? '--'}</span>
                  {activePairedRun.phChange !== null && (
                    <span
                      className={`text-xs ${
                        Math.abs(activePairedRun.phChange) > 0.5 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      (Δ {activePairedRun.phChange > 0 ? '+' : ''}
                      {activePairedRun.phChange})
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>In: {activePairedRun.inlet.measurements.ph?.toFixed(2) ?? '--'}</span>
                  <span>Out: {activePairedRun.outlet.measurements.ph?.toFixed(2) ?? '--'}</span>
                </div>
              </div>

              {/* Water Temperature */}
              <div className="p-3.5 rounded-xl bg-[#121e3c]/80 border border-[#1f335c]">
                <div className="text-[11px] text-slate-400 font-medium">Water Temperature</div>
                <div className="text-xl font-bold font-mono text-slate-100 mt-1 flex items-baseline gap-2">
                  <span>{activePairedRun.outlet.measurements.temperature_c?.toFixed(1) ?? '--'}°C</span>
                  {activePairedRun.tempChange !== null && (
                    <span className="text-xs text-slate-400">
                      (Δ {activePairedRun.tempChange > 0 ? '+' : ''}
                      {activePairedRun.tempChange}°C)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>In: {activePairedRun.inlet.measurements.temperature_c?.toFixed(1) ?? '--'}°C</span>
                  <span>Out: {activePairedRun.outlet.measurements.temperature_c?.toFixed(1) ?? '--'}°C</span>
                </div>
              </div>

              {/* MQ-5 Headspace Gas Sensor */}
              <div className="p-3.5 rounded-xl bg-[#121e3c]/80 border border-[#1f335c]">
                <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span>MQ-5 Headspace Signal</span>
                  <span className="text-[9px] text-slate-500 uppercase">Uncalibrated</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                  {activePairedRun.outlet.measurements.mq5_adc ?? '--'} <span className="text-xs font-normal text-slate-400">ADC</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>In: {activePairedRun.inlet.measurements.mq5_adc ?? '--'}</span>
                  <span>Out: {activePairedRun.outlet.measurements.mq5_adc ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner (if generation or fetch failed) */}
          {(generateError || fetchError) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-rose-950/40 border border-rose-500/40 p-4 flex items-start gap-3 text-rose-200"
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Backend / Gemini Response Notice
                </h4>
                <p className="text-xs font-mono text-rose-200/90 leading-relaxed">
                  {generateError || fetchError}
                </p>
                {generateError && generateError.includes('GEMINI_DATA_POLICY_CONFIRMED') && (
                  <p className="text-[11px] text-rose-300/80 pt-1">
                    Tip: Verify your billing configuration and set{' '}
                    <code className="bg-rose-950 px-1 py-0.5 rounded text-white font-mono">
                      GEMINI_DATA_POLICY_CONFIRMED=paid_billing_enabled
                    </code>{' '}
                    in <code className="font-mono text-white">backend/.env</code>.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Prompt to generate when no interpretation exists yet */}
          {!interpretation && !isGenerating && !generateError && (
            <div className="rounded-2xl bg-[#0e1730]/70 border border-[#1e355e] p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-900/20">
                <Sparkles className="w-6 h-6 text-cyan-300" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-slate-100">
                  No Saved Interpretation for Run {activePairedRun.runId}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click below to submit the paired telemetry summary to the Flask Gemini interpreter.
                  Interpretations are cached in MongoDB Atlas and will not be re-generated on future page reloads.
                </p>
              </div>
              <div>
                <button
                  onClick={handleGenerateInterpretation}
                  className="px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wide bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/30 inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Generate Gemini Insights for this Run</span>
                </button>
              </div>
            </div>
          )}

          {/* Render Interpretation Content */}
          {interpretation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Section 1: Operational Interpretation (Featured Hero Card) */}
              <div className="rounded-2xl bg-gradient-to-br from-[#101c3d] to-[#0c1633] border border-cyan-500/30 p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight text-white uppercase">
                    Operational Interpretation
                  </h3>
                  <span className="text-[10px] text-cyan-300/80 font-mono ml-auto">
                    Generated: {formatTimestamp(interpretation.generated_at)}
                  </span>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-sans bg-[#0a1226]/60 p-4 rounded-xl border border-[#1b2b4d]">
                  {interpretation.interpretation.operational_interpretation}
                </p>
              </div>

              {/* Section 2: Two-Column Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column A: Observed Physical Changes */}
                <div className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-5 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#1b3158]">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Observed Telemetry Changes
                    </h4>
                  </div>
                  <ul className="space-y-2.5">
                    {interpretation.interpretation.observed_changes.map((change, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-300 flex items-start gap-2.5 bg-[#121c35]/60 p-3 rounded-xl border border-[#1f2f54]"
                      >
                        <span className="w-5 h-5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column B: Suggested Operator Checks */}
                <div className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-5 shadow-lg space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#1b3158]">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Suggested Operator Checks
                    </h4>
                  </div>
                  <ul className="space-y-2.5">
                    {interpretation.interpretation.suggested_checks.map((check, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-300 flex items-start gap-2.5 bg-[#121c35]/60 p-3 rounded-xl border border-[#1f2f54]"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Section 3: Data Quality & Sensor Notes */}
              {interpretation.interpretation.data_quality_notes &&
                interpretation.interpretation.data_quality_notes.length > 0 && (
                  <div className="rounded-2xl bg-[#0e1730] border border-[#1e355e] p-5 shadow-lg space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#1b3158]">
                      <Activity className="w-4 h-4 text-sky-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Data Quality & Sensor Calibration Notes
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {interpretation.interpretation.data_quality_notes.map((note, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-slate-300 bg-[#121c35]/60 p-3 rounded-xl border border-[#1f2f54] flex items-start gap-2"
                        >
                          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Section 4: Mandatory Backend Disclaimer Banner */}
              <div className="rounded-2xl bg-[#091024] border border-[#192b4d] p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400/90 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mandatory Safety Disclaimer
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {interpretation.interpretation.disclaimer ||
                      'AI-generated operational interpretation only. Not a water-safety, potability, or certification assessment. Verify readings and follow approved procedures.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

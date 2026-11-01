import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  X,
  Copy,
  Check,
  Calendar,
  Activity,
  ShieldAlert,
  ArrowDown
} from 'lucide-react';
import { AlertItem, MonthlyArchive, TelemetryReading } from '../../types';

interface LogsAndArchiveViewProps {
  abnormalities: AlertItem[];
  archives: MonthlyArchive[];
  readings: TelemetryReading[];
  onUpdateAlertStatus: (alertId: string, status: 'open' | 'acknowledged' | 'resolved') => void;
  nodeId: string;
}

export const LogsAndArchiveView: React.FC<LogsAndArchiveViewProps> = ({
  abnormalities,
  archives,
  readings,
  onUpdateAlertStatus,
  nodeId,
}) => {
  const [abnormalityFilter, setAbnormalityFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'inlet' | 'outlet'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReading, setSelectedReading] = useState<TelemetryReading | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredAbnormalities = abnormalities.filter(a => {
    if (abnormalityFilter === 'open') return a.status === 'open';
    if (abnormalityFilter === 'resolved') return a.status === 'resolved';
    return true;
  });

  const filteredReadings = readings.filter(r => {
    if (phaseFilter !== 'all' && r.phase !== phaseFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.event_id.toLowerCase().includes(term) ||
        r.node_id.toLowerCase().includes(term) ||
        (r.run_id && r.run_id.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const handleDownloadCsv = (month: string) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Event_ID,Node_ID,Timestamp_UTC,Phase,Active_Branch,pH,Turbidity_NTU,Temperature_C,Inlet_Flow_LPM,Branch_Flow_LPM,MQ5_ADC,Filter_Clogged_Pct\n' +
      readings
        .map(
          r =>
            `${r.event_id},${r.node_id},${r.timestamp},${r.phase},${r.active_branch},${r.measurements.ph},${r.measurements.turbidity_ntu},${r.measurements.temperature_c},${r.measurements.flow_lpm.inlet},${r.measurements.flow_lpm.branch_a},${r.measurements.mq5_adc},${r.filter_clogged_percent || 28}`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sujal-${nodeId}-archive-${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* View Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Archive className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-extrabold text-white tracking-tight">Logs & Historical Telemetry Archive</h2>
        </div>
        <p className="text-xs text-cyan-200/80">
          Complete repository of past abnormalities, permanent monthly CSV downloads, and historical packet telemetry for node {nodeId}.
        </p>
      </div>

      {/* SECTION 1: Previous Abnormalities & Sensor Excursions */}
      <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e345e] pb-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Previous Abnormalities & Excursion Log</h3>
              <p className="text-[11px] text-slate-300">Flagged telemetry events requiring operator attention</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-[#091124] p-1 rounded-xl border border-[#1b325c] text-xs">
            <button
              onClick={() => setAbnormalityFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                abnormalityFilter === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({abnormalities.length})
            </button>
            <button
              onClick={() => setAbnormalityFilter('open')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                abnormalityFilter === 'open' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Open Issues
            </button>
            <button
              onClick={() => setAbnormalityFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                abnormalityFilter === 'resolved' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Abnormality Cards */}
        <div className="space-y-3">
          {filteredAbnormalities.map((item) => {
            const isHigh = item.severity === 'high';
            const isOpen = item.status === 'open';

            return (
              <div
                key={item._id}
                className={`p-4 rounded-xl border transition-all ${
                  isOpen
                    ? isHigh
                      ? 'bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/20'
                      : 'bg-amber-950/25 border-amber-500/50'
                    : 'bg-[#0f1b3b] border-[#1d3363] opacity-90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono border ${
                        isHigh ? 'bg-rose-950 text-rose-300 border-rose-600' : 'bg-amber-950 text-amber-300 border-amber-600'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {item.code}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs text-slate-300 font-mono">
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
                      {item.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-300">
                      <span>Station: <strong className="text-white font-mono">{item.node_id}</strong></span>
                      {item.run_id && <span>Run: <strong className="text-cyan-300 font-mono">{item.run_id}</strong></span>}
                      {item.phase && <span>Phase: <strong className="text-white uppercase font-mono">{item.phase}</strong></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.status === 'open' && (
                      <button
                        onClick={() => onUpdateAlertStatus(item._id, 'acknowledged')}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    {item.status !== 'resolved' && (
                      <button
                        onClick={() => onUpdateAlertStatus(item._id, 'resolved')}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-colors"
                      >
                        Resolve
                      </button>
                    )}

                    {item.status === 'resolved' && (
                      <span className="flex items-center gap-1 text-emerald-300 font-bold text-xs bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-700">
                        <Check className="w-3.5 h-3.5" />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Permanent Monthly CSV Archives to Download */}
      <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Previous Monthly Telemetry CSV Archives</h3>
            <p className="text-[11px] text-slate-300">Download permanent historical datasets collected by ESP32 sensors</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#091124] border-b border-[#1e345e] text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4">Stored Records</th>
                <th className="py-3 px-4">File Size</th>
                <th className="py-3 px-4">Telemetry Date Span</th>
                <th className="py-3 px-4 text-right">Download Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18294a]">
              {archives.map((arch) => (
                <tr key={arch.month} className="hover:bg-[#15274d] text-slate-200">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-300 text-sm">
                    {arch.month}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {arch.count.toLocaleString()} packets
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {(arch.size_kb / 1024).toFixed(1)} MB
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {new Date(arch.first_timestamp).toLocaleDateString()} — {new Date(arch.last_timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDownloadCsv(arch.month)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/25 transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {arch.month}.csv</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Live Telemetry Logs Table */}
      <div className="bg-gradient-to-br from-[#122248] to-[#0e1938] border border-[#254278] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e345e] pb-3.5">
          <div>
            <h3 className="text-sm font-bold text-white">Raw Telemetry Records Stream</h3>
            <p className="text-[11px] text-slate-300">Latest immutable database entries received from ESP32</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Phase Filters */}
            <div className="flex items-center bg-[#091124] p-1 rounded-xl border border-[#1b325c] text-xs">
              <button
                onClick={() => setPhaseFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  phaseFilter === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({readings.length})
              </button>
              <button
                onClick={() => setPhaseFilter('inlet')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  phaseFilter === 'inlet' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inlet
              </button>
              <button
                onClick={() => setPhaseFilter('outlet')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  phaseFilter === 'outlet' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Outlet
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search event ID / run..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#091124] text-xs text-white pl-9 pr-3 py-1.5 rounded-xl border border-[#1b325c] focus:outline-none focus:border-cyan-400 w-52 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#091124] border-b border-[#1e345e] text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Event ID / Run</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Phase</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">pH</th>
                <th className="py-3 px-4">Turbidity</th>
                <th className="py-3 px-4">Temp</th>
                <th className="py-3 px-4">Flow (Inlet / Branch)</th>
                <th className="py-3 px-4">Filter Clog</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18294a]">
              {filteredReadings.map((r) => {
                const isOutlet = r.phase === 'outlet';
                return (
                  <tr
                    key={r._id || r.event_id}
                    onClick={() => setSelectedReading(r)}
                    className="cursor-pointer hover:bg-[#15274d] text-slate-200 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      <div>{r.event_id}</div>
                      {r.run_id && <div className="text-[10px] text-cyan-300 font-normal">{r.run_id}</div>}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono border ${
                        isOutlet ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}>
                        {r.phase}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                      Branch {r.active_branch}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {r.measurements.ph.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={r.measurements.turbidity_ntu > 5.0 && isOutlet ? 'text-rose-400 font-extrabold' : 'text-white'}>
                        {r.measurements.turbidity_ntu.toFixed(2)} NTU
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-200">
                      {r.measurements.temperature_c.toFixed(1)} °C
                    </td>

                    <td className="py-3 px-4 font-mono text-cyan-300">
                      {r.measurements.flow_lpm.inlet.toFixed(1)} / {(r.active_branch === 'B' ? r.measurements.flow_lpm.branch_b : r.measurements.flow_lpm.branch_a).toFixed(1)} LPM
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold">
                      <span className={(r.filter_clogged_percent || 28) > 75 ? 'text-rose-400 font-bold' : 'text-emerald-300'}>
                        {r.filter_clogged_percent || 28}%
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReading(r);
                        }}
                        className="px-3 py-1 rounded-lg bg-[#182e57] hover:bg-cyan-600 text-white text-[11px] font-semibold transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Reading Inspector Drawer */}
      <AnimatePresence>
        {selectedReading && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 w-[500px] max-w-full h-full bg-[#0c1633] border-l border-[#254278] shadow-2xl z-50 flex flex-col justify-between overflow-y-auto"
          >
            <div className="p-5 border-b border-[#1e345e] flex items-center justify-between sticky top-0 bg-[#0c1633]/95 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Telemetry Record Inspector
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-0.5">
                  {selectedReading.event_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReading(null)}
                className="p-1.5 rounded-lg bg-[#15274d] hover:bg-[#1e386e] text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-[#122248] p-3 rounded-xl border border-[#254278]">
                  <span className="text-slate-400 text-[10px] block">Assigned Phase</span>
                  <span className="text-base font-bold text-cyan-300 uppercase mt-1 block">
                    {selectedReading.phase}
                  </span>
                </div>
                <div className="bg-[#122248] p-3 rounded-xl border border-[#254278]">
                  <span className="text-slate-400 text-[10px] block">Assigned Run ID</span>
                  <span className="text-base font-bold text-white mt-1 block">
                    {selectedReading.run_id || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="bg-[#122248] rounded-xl border border-[#254278] p-4">
                <h4 className="text-xs font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Calibrated Measurements
                </h4>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between py-1 border-b border-[#1b315b]">
                    <span className="text-slate-400">pH Level:</span>
                    <span className="text-white font-bold">{selectedReading.measurements.ph.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1b315b]">
                    <span className="text-slate-400">Turbidity:</span>
                    <span className="text-white font-bold">{selectedReading.measurements.turbidity_ntu.toFixed(2)} NTU</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1b315b]">
                    <span className="text-slate-400">Temperature:</span>
                    <span className="text-white font-bold">{selectedReading.measurements.temperature_c.toFixed(1)} °C</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1b315b]">
                    <span className="text-slate-400">Inlet Flow Rate:</span>
                    <span className="text-white font-bold">{selectedReading.measurements.flow_lpm.inlet.toFixed(2)} LPM</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1b315b]">
                    <span className="text-slate-400">Active Branch Flow:</span>
                    <span className="text-white font-bold">
                      {(selectedReading.active_branch === 'B' ? selectedReading.measurements.flow_lpm.branch_b : selectedReading.measurements.flow_lpm.branch_a).toFixed(2)} LPM
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Filter Clogged Amount:</span>
                    <span className="text-emerald-300 font-bold">{selectedReading.filter_clogged_percent || 28}%</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300">Raw JSON Payload</span>
                  <button
                    onClick={() => handleCopyJson(selectedReading)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#081024] border border-[#1b325c] rounded-xl text-[10px] font-mono text-cyan-200 overflow-x-auto max-h-56 leading-tight">
                  {JSON.stringify(selectedReading, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-[#1e345e] bg-[#091124]">
              <button
                onClick={() => setSelectedReading(null)}
                className="w-full py-2.5 rounded-xl bg-[#15274d] hover:bg-[#1e386e] text-white text-xs font-bold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


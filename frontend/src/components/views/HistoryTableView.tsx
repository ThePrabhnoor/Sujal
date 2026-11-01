import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table as TableIcon,
  Search,
  Filter,
  Download,
  X,
  Copy,
  Check,
  Eye,
  Calendar,
  Layers,
  ArrowRight,
  Droplets,
  Activity
} from 'lucide-react';
import { TelemetryReading } from '../../types';

interface HistoryTableViewProps {
  readings: TelemetryReading[];
  onExportCsv?: () => void;
}

export const HistoryTableView: React.FC<HistoryTableViewProps> = ({
  readings,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'inlet' | 'outlet'>('all');
  const [selectedReading, setSelectedReading] = useState<TelemetryReading | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = readings.filter(r => {
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

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto relative">
      {/* Top Filter and Actions Bar */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-cyan-400" />
            Ingested Telemetry Log History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable sensor records saved to permanent MongoDB collection. Displays inlet/outlet pairs and calibrated units.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Phase Tabs */}
          <div className="flex items-center bg-[#0a0e18] p-1 rounded-lg border border-[#1f2b3f] text-xs">
            <button
              onClick={() => setPhaseFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                phaseFilter === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({readings.length})
            </button>
            <button
              onClick={() => setPhaseFilter('inlet')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                phaseFilter === 'inlet' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inlet Only
            </button>
            <button
              onClick={() => setPhaseFilter('outlet')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                phaseFilter === 'outlet' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Outlet Only
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event ID or run..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#0a0e18] text-xs text-slate-200 pl-9 pr-4 py-1.5 rounded-lg border border-[#1f2b3f] focus:outline-none focus:border-cyan-500 w-56 font-mono"
            />
          </div>

          {/* Export Button */}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#121927] border border-[#1f2b3f] rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0b101c] border-b border-[#1f2b3f] text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                <th className="py-3 px-4">Event ID / Run</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Phase</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">pH</th>
                <th className="py-3 px-4">Turbidity</th>
                <th className="py-3 px-4">Temp</th>
                <th className="py-3 px-4">Inlet Flow</th>
                <th className="py-3 px-4">Branch Flow</th>
                <th className="py-3 px-4">MQ-5 ADC</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182335]">
              {filtered.map((reading) => {
                const isOutlet = reading.phase === 'outlet';
                const isSelected = selectedReading?._id === reading._id;

                return (
                  <tr
                    key={reading._id || reading.event_id}
                    onClick={() => setSelectedReading(reading)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-950/40 text-sky-100'
                        : 'hover:bg-[#162033] text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      <div>{reading.event_id}</div>
                      {reading.run_id && (
                        <div className="text-[10px] text-slate-400">{reading.run_id}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(reading.timestamp).toLocaleTimeString()}
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(reading.timestamp).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono border ${
                          isOutlet
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                            : 'bg-amber-950/80 text-amber-300 border-amber-800'
                        }`}
                      >
                        {reading.phase}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-300">
                      Branch {reading.active_branch}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {reading.measurements.ph.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          reading.measurements.turbidity_ntu > 5.0 && isOutlet
                            ? 'text-red-400 font-extrabold'
                            : 'text-slate-200'
                        }
                      >
                        {reading.measurements.turbidity_ntu.toFixed(2)} NTU
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {reading.measurements.temperature_c.toFixed(1)} °C
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {reading.measurements.flow_lpm.inlet.toFixed(2)} LPM
                    </td>

                    <td className="py-3 px-4 font-mono text-cyan-300">
                      {(reading.active_branch === 'B'
                        ? reading.measurements.flow_lpm.branch_b
                        : reading.measurements.flow_lpm.branch_a
                      ).toFixed(2)}{' '}
                      LPM
                    </td>

                    <td className="py-3 px-4 font-mono text-purple-300">
                      {reading.measurements.mq5_adc}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReading(reading);
                        }}
                        className="px-2.5 py-1 rounded bg-[#1c273c] hover:bg-cyan-600 hover:text-white text-slate-300 text-[11px] transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No matching telemetry logs found for the selected query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reading Detail Inspector Drawer (Framer Motion Drawer) */}
      <AnimatePresence>
        {selectedReading && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 w-[480px] max-w-full h-full bg-[#0d1422] border-l border-[#22314a] shadow-2xl z-50 flex flex-col justify-between overflow-y-auto"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#1f2b3f] flex items-center justify-between sticky top-0 bg-[#0d1422]/90 backdrop-blur-md">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                  Telemetry Packet Detail
                </span>
                <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
                  {selectedReading.event_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReading(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 space-y-5 text-xs">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121927] p-3 rounded-lg border border-[#1f2b3f]">
                  <span className="text-slate-400 text-[10px] block">Assigned Phase</span>
                  <span className="text-sm font-bold font-mono text-cyan-300 uppercase mt-1 block">
                    {selectedReading.phase}
                  </span>
                </div>
                <div className="bg-[#121927] p-3 rounded-lg border border-[#1f2b3f]">
                  <span className="text-slate-400 text-[10px] block">Assigned Run ID</span>
                  <span className="text-sm font-bold font-mono text-slate-200 mt-1 block">
                    {selectedReading.run_id || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Sensor Measurements Table */}
              <div className="bg-[#121927] rounded-lg border border-[#1f2b3f] p-4">
                <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Calibrated Measurements
                </h4>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">pH Level:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.ph.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Turbidity:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.turbidity_ntu.toFixed(2)} NTU</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Temperature:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.temperature_c.toFixed(1)} °C</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Inlet Flow Rate:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.flow_lpm.inlet.toFixed(2)} LPM</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Branch A Flow:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.flow_lpm.branch_a.toFixed(2)} LPM</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Branch B Flow:</span>
                    <span className="text-slate-100 font-bold">{selectedReading.measurements.flow_lpm.branch_b.toFixed(2)} LPM</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">MQ-5 Headspace ADC:</span>
                    <span className="text-purple-300 font-bold">{selectedReading.measurements.mq5_adc} (uncalibrated)</span>
                  </div>
                </div>
              </div>

              {/* Hardware Device Status */}
              <div className="bg-[#121927] rounded-lg border border-[#1f2b3f] p-4">
                <h4 className="text-xs font-bold text-slate-300 mb-2">Device & Valve Actuator Status</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[9px]">Wi-Fi</div>
                    <div className="text-emerald-400 font-bold">{selectedReading.device_status.wifi.toUpperCase()}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[9px]">Valve A</div>
                    <div className="text-slate-200 font-bold">{selectedReading.device_status.valve_a.toUpperCase()}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[9px]">Valve B</div>
                    <div className="text-slate-200 font-bold">{selectedReading.device_status.valve_b.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Raw JSON Ingestion Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Raw Stored Document</span>
                  <button
                    onClick={() => handleCopyJson(selectedReading)}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:underline"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#0a0e18] border border-slate-800 rounded-lg text-[10px] font-mono text-sky-200 overflow-x-auto max-h-60 leading-tight">
                  {JSON.stringify(selectedReading, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#1f2b3f] bg-[#0b101c]">
              <button
                onClick={() => setSelectedReading(null)}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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


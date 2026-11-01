import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Droplets,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  NodeProfile,
  TelemetryReading,
  AlertItem,
  MonthlyArchive,
  OperatingThresholds,
  RunComparison,
  CompletenessMetrics
} from './types';
import { api } from './services/api';
import { Navigation, ViewType } from './components/Navigation';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { MapView } from './components/views/MapView';
import { SchematicView } from './components/views/SchematicView';
import { HistoryTableView } from './components/views/HistoryTableView';
import { AlertsView } from './components/views/AlertsView';
import { DiagnosticsView } from './components/views/DiagnosticsView';
import { SettingsView } from './components/views/SettingsView';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [nodes, setNodes] = useState<NodeProfile[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('SJ-001');
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [latestReading, setLatestReading] = useState<TelemetryReading | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [archives, setArchives] = useState<MonthlyArchive[]>([]);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessMetrics | null>(null);
  const [thresholds, setThresholds] = useState<OperatingThresholds>(api.getThresholds());
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Sync with URL hash if present
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '') as ViewType;
      if (['overview', 'map', 'schematic', 'history', 'alerts', 'diagnostics', 'settings'].includes(hash)) {
        setCurrentView(hash);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectView = (view: ViewType) => {
    setCurrentView(view);
    window.location.hash = `#/${view}`;
  };

  // Initial Data Load
  const loadData = useCallback(async (nodeId: string) => {
    const health = await api.checkHealth();
    setIsBackendConnected(health.status === 'ok' || health.mongodb_connected);

    const nodeList = await api.listNodes();
    setNodes(nodeList);

    const history = await api.getReadingHistory(nodeId, 40);
    setReadings(history);

    const latest = await api.getLatestReading(nodeId);
    setLatestReading(latest);

    const alertList = await api.getNodeAlerts(nodeId);
    setAlerts(alertList);

    const archiveList = await api.getMonthlyArchives(nodeId);
    setArchives(archiveList);

    const comp = await api.getRunComparison(nodeId, latest?.run_id || 'run-118');
    setComparison(comp);

    const compMetrics = await api.getCompleteness(nodeId);
    setCompleteness(compMetrics);

    setThresholds(api.getThresholds());
  }, []);

  useEffect(() => {
    loadData(selectedNodeId);
  }, [selectedNodeId, loadData]);

  // Live streaming simulator loop (every 3 seconds when enabled)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const newReading = api.simulateIngestReading(selectedNodeId);
      setLatestReading(newReading);
      setReadings(prev => [...prev.slice(-39), newReading]);
      api.getNodeAlerts(selectedNodeId).then(setAlerts);
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming, selectedNodeId]);

  // Simulate single packet
  const handleSimulatePacket = () => {
    const newReading = api.simulateIngestReading(selectedNodeId);
    setLatestReading(newReading);
    setReadings(prev => [...prev.slice(-39), newReading]);
    api.getNodeAlerts(selectedNodeId).then(setAlerts);
  };

  // Custom packet injection from Diagnostics view
  const handleSimulateCustomPacket = (custom: any) => {
    const newReading = api.simulateIngestReading(selectedNodeId, custom);
    setLatestReading(newReading);
    setReadings(prev => [...prev.slice(-39), newReading]);
    api.getNodeAlerts(selectedNodeId).then(setAlerts);
  };

  // Branch switcher from schematic view
  const handleSimulateBranchSwitch = (branch: 'A' | 'B') => {
    const newReading = api.simulateIngestReading(selectedNodeId, {
      active_branch: branch,
      device_status: {
        wifi: 'connected',
        valve_a: branch === 'A' ? 'open' : 'closed',
        valve_b: branch === 'B' ? 'open' : 'closed',
      }
    });
    setLatestReading(newReading);
    setReadings(prev => [...prev.slice(-39), newReading]);
  };

  // Alert status updates
  const handleUpdateAlertStatus = async (alertId: string, status: 'open' | 'acknowledged' | 'resolved') => {
    await api.updateAlertStatus(alertId, status);
    const updated = await api.getNodeAlerts(selectedNodeId);
    setAlerts(updated);
  };

  // Profile updates
  const handleSaveProfile = async (profile: Partial<NodeProfile>) => {
    const updated = await api.updateNodeProfile(selectedNodeId, profile);
    setNodes(prev => prev.map(n => n.node_id === selectedNodeId ? updated : n));
  };

  // Threshold updates
  const handleSaveThresholds = (newThresh: OperatingThresholds) => {
    const updated = api.updateThresholds(newThresh);
    setThresholds(updated);
  };

  const openAlertsCount = alerts.filter(a => a.status === 'open').length;
  const activeBranch = latestReading?.active_branch || 'A';
  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0] || {
    node_id: 'SJ-001',
    name: 'Locality Checkpoint 1',
    location: { latitude: 28.6139, longitude: 77.2090, source: 'manual', verified: true }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0e17] text-slate-100">
      {/* Desktop Sidebar Navigation */}
      <div className="hidden lg:flex shrink-0">
        <Navigation
          currentView={currentView}
          onSelectView={handleSelectView}
          openAlertsCount={openAlertsCount}
          isLive={isStreaming}
          activeBranch={activeBranch}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        <Header
          nodes={nodes.length > 0 ? nodes : [selectedNode]}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          isStreaming={isStreaming}
          onToggleStreaming={() => setIsStreaming(!isStreaming)}
          onSimulatePacket={handleSimulatePacket}
          onRefresh={() => loadData(selectedNodeId)}
          lastTimestamp={latestReading?.timestamp}
          activeBranch={activeBranch}
          isBackendConnected={isBackendConnected}
        />

        {/* Mobile Header / Nav Toggle */}
        <div className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-[#0d131f] border-b border-[#1a2436]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-extrabold text-sm text-sky-400">SuJal Mobile</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[11px] font-bold">
              Branch {activeBranch}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:hidden bg-[#0d131f] border-b border-slate-800 p-4 absolute top-[6.5rem] left-0 right-0 z-40 shadow-2xl"
            >
              <Navigation
                currentView={currentView}
                onSelectView={(v) => {
                  setCurrentView(v);
                  setMobileMenuOpen(false);
                }}
                openAlertsCount={openAlertsCount}
                isLive={isStreaming}
                activeBranch={activeBranch}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Router */}
        <main className="flex-1 overflow-y-auto">
          <div key={currentView} className="h-full">
            {currentView === 'overview' && (
              <DashboardView
                readings={readings}
                latestReading={latestReading}
                thresholds={thresholds}
                comparison={comparison}
                onOpenSchematic={() => handleSelectView('schematic')}
                onOpenAlerts={() => handleSelectView('alerts')}
              />
            )}

            {currentView === 'map' && (
              <MapView
                nodes={nodes.length > 0 ? nodes : [selectedNode]}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                latestReading={latestReading}
                readings={readings}
              />
            )}

            {currentView === 'schematic' && (
              <SchematicView
                latestReading={latestReading}
                onSimulateBranchSwitch={handleSimulateBranchSwitch}
              />
            )}

            {currentView === 'history' && (
              <HistoryTableView
                readings={readings}
                onExportCsv={() => {
                  const csvContent =
                    'data:text/csv;charset=utf-8,' +
                    'Event_ID,Timestamp,Phase,Branch,pH,Turbidity_NTU,Temp_C,Inlet_Flow,Branch_Flow,MQ5_ADC\n' +
                    readings
                      .map(
                        r =>
                          `${r.event_id},${r.timestamp},${r.phase},${r.active_branch},${r.measurements.ph},${r.measurements.turbidity_ntu},${r.measurements.temperature_c},${r.measurements.flow_lpm.inlet},${r.measurements.flow_lpm.branch_a},${r.measurements.mq5_adc}`
                      )
                      .join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `sujal-${selectedNodeId}-telemetry.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              />
            )}

            {currentView === 'alerts' && (
              <AlertsView
                alerts={alerts}
                archives={archives}
                onUpdateAlertStatus={handleUpdateAlertStatus}
                nodeId={selectedNodeId}
              />
            )}

            {currentView === 'diagnostics' && (
              <DiagnosticsView
                comparison={comparison}
                completeness={completeness}
                onSimulateCustomPacket={handleSimulateCustomPacket}
                nodeId={selectedNodeId}
              />
            )}

            {currentView === 'settings' && (
              <SettingsView
                thresholds={thresholds}
                onSaveThresholds={handleSaveThresholds}
                nodeProfile={selectedNode}
                onSaveProfile={handleSaveProfile}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

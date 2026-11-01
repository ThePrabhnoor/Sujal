import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  NodeProfile,
  TelemetryReading,
  AlertItem,
  MonthlyArchive,
  OperatingThresholds,
  RunComparison,
  CompletenessMetrics,
  SystemLogEntry
} from './types';
import { api } from './services/api';
import { Navigation, ViewType } from './components/Navigation';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { MapView } from './components/views/MapView';
import { LogsAndArchiveView } from './components/views/LogsAndArchiveView';
import { AlertsView } from './components/views/AlertsView';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [nodes, setNodes] = useState<NodeProfile[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [latestReading, setLatestReading] = useState<TelemetryReading | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [abnormalities, setAbnormalities] = useState<AlertItem[]>([]);
  const [archives, setArchives] = useState<MonthlyArchive[]>([]);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessMetrics | null>(null);
  const [thresholds, setThresholds] = useState<OperatingThresholds>(api.getThresholds());
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // GSM / GPS Geolocation State (Laptop Geolocation)
  const [gsmCoords, setGsmCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gsmLocationText, setGsmLocationText] = useState<string>('Location not synced');
  const [isGsmSyncing, setIsGsmSyncing] = useState<boolean>(false);

  // System Logs & Elapsed Last Ingest Timer
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [lastIngestEpoch, setLastIngestEpoch] = useState<number>(Date.now() - 4000);
  const [lastIngestFormatted, setLastIngestFormatted] = useState<string>('00:00:04');

  const addSystemLog = useCallback((message: string, type: 'info' | 'warn' | 'success' | 'alert' = 'info') => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setSystemLogs(prev => [
      ...prev.slice(-20),
      { id: String(Date.now() + Math.random()), timestamp: timeStr, message, type }
    ]);
  }, []);

  // Update ticking elapsed timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastIngestEpoch) / 1000));
      const hh = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
      const mm = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
      const ss = String(elapsedSeconds % 60).padStart(2, '0');
      setLastIngestFormatted(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastIngestEpoch]);

  // Sync Geolocation from Laptop Hardware (GSM / GPS)
  const syncGsmLocation = useCallback(() => {
    setIsGsmSyncing(true);
    addSystemLog('Querying laptop GSM / GPS hardware...', 'info');

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lon = parseFloat(pos.coords.longitude.toFixed(4));
          setGsmCoords({ lat, lon });
          const text = `${lat >= 0 ? lat + '° N' : Math.abs(lat) + '° S'}, ${lon >= 0 ? lon + '° E' : Math.abs(lon) + '° W'} (Browser GPS)`;
          setGsmLocationText(text);
          setIsGsmSyncing(false);
          addSystemLog(`Laptop GSM localized: ${lat}, ${lon} (±${Math.round(pos.coords.accuracy || 12)}m)`, 'success');
        },
        (err) => {
          setGsmCoords(null);
          setGsmLocationText('Location unavailable');
          setIsGsmSyncing(false);
          addSystemLog(`Browser location unavailable: ${err.message}`, 'warn');
        },
        { timeout: 7000, enableHighAccuracy: true }
      );
    } else {
      setGsmCoords(null);
      setGsmLocationText('Location unavailable');
      setIsGsmSyncing(false);
      addSystemLog('Browser geolocation is unavailable.', 'warn');
    }
  }, [addSystemLog]);

  // Initial mount geolocation sync
  useEffect(() => {
    syncGsmLocation();
  }, [syncGsmLocation]);

  // Sync URL Hash router with the 4 valid views & optional node parameter
  useEffect(() => {
    const handleHash = () => {
      const fullHash = window.location.hash.replace('#/', '').replace('#', '');
      const [view, queryStr] = fullHash.split('?');
      if (['dashboard', 'maps', 'logs-archive', 'alerts'].includes(view)) {
        setCurrentView(view as ViewType);
      }
      if (queryStr) {
        const params = new URLSearchParams(queryStr);
        const nodeParam = params.get('node');
        if (nodeParam) {
          setSelectedNodeId(nodeParam);
        }
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

  // Fetch stored telemetry. Static demo data remains isolated to DashboardView.
  const loadData = useCallback(async (nodeId: string) => {
    try {
      const health = await api.checkHealth();
      const backendConnected = health.status === 'ok' && health.database === 'connected';
      setIsBackendConnected(backendConnected);

      if (!nodeId || !backendConnected) {
        setReadings([]);
        setLatestReading(null);
        setAlerts([]);
        setAbnormalities([]);
        setArchives([]);
        setComparison(null);
        setCompleteness(null);
        if (!backendConnected) setLoadError('Backend is offline. Dashboard is showing static demo data.');
        return;
      }

      const [history, latest, alertList, abnList, archiveList, telemetryCompleteness, configuredThresholds] = await Promise.all([
        api.getReadingHistory(nodeId, 60),
        api.getLatestReading(nodeId),
        api.getNodeAlerts(nodeId, 'all'),
        api.getAllAbnormalities(),
        api.getMonthlyArchives(nodeId),
        api.getCompleteness(nodeId),
        api.getConfiguredThresholds(),
      ]);

      setReadings(history);
      setLatestReading(latest);
      setAlerts(alertList);
      setAbnormalities(abnList);
      setArchives(archiveList);
      setCompleteness(telemetryCompleteness);
      if (latest?.run_id) {
        const cmp = await api.getRunComparison(nodeId, latest.run_id);
        setComparison(cmp);
      } else setComparison(null);
      setThresholds(configuredThresholds);
      if (latest?.timestamp) {
        const parsedTime = new Date(latest.timestamp).getTime();
        if (!isNaN(parsedTime) && parsedTime > 0) {
          setLastIngestEpoch(parsedTime);
        }
      }
      setLoadError(null);
    } catch (error) {
      setIsBackendConnected(false);
      setReadings([]);
      setLatestReading(null);
      setAlerts([]);
      setAbnormalities([]);
      setArchives([]);
      setComparison(null);
      setCompleteness(null);
      setLoadError(error instanceof Error ? error.message : 'Could not fetch telemetry data.');
    }
  }, []);

  // Fetch registered nodes directly from backend database
  useEffect(() => {
    (async () => {
      try {
        const [health, nodeList] = await Promise.all([api.checkHealth(), api.listNodes()]);
        setIsBackendConnected(health.status === 'ok' && health.database === 'connected');
        setNodes(nodeList);
        if (nodeList.length > 0) {
          setSelectedNodeId((current) => {
            const exists = nodeList.some(n => n.node_id === current);
            return exists ? current : nodeList[0].node_id;
          });
        } else {
          setSelectedNodeId('');
          setLoadError('No node is registered in the connected backend yet. Dashboard is showing static demo data.');
        }
      } catch (err) {
        setIsBackendConnected(false);
        setNodes([]);
        setSelectedNodeId('');
        setLoadError(err instanceof Error ? err.message : 'Could not list nodes.');
      }
    })();
  }, []);

  // Load node data whenever active node changes
  useEffect(() => {
    if (selectedNodeId) {
      void loadData(selectedNodeId);
    }
  }, [selectedNodeId, loadData]);

  // Live telemetry polling strictly from backend (updates charts & graphs as backend receives data from ESP32)
  useEffect(() => {
    if (!isStreaming || !selectedNodeId) return;

    const interval = setInterval(() => {
      void loadData(selectedNodeId);
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming, selectedNodeId, loadData]);

  // Manual Node Cycling Button handler
  const handleManualCycleNode = () => {
    if (nodes.length <= 1) return;
    const currentIndex = nodes.findIndex(n => n.node_id === selectedNodeId);
    const nextIndex = (currentIndex + 1) % nodes.length;
    const nextNode = nodes[nextIndex];
    setSelectedNodeId(nextNode.node_id);
    addSystemLog(`Station switched to ${nextNode.node_id} (${nextNode.name || nextNode.node_id})`, 'info');
  };

  // Trigger telemetry ingest through the backend API
  const handleSimulatePacket = () => {
    // Never write fabricated browser values into the same collection as ESP32 telemetry.
    addSystemLog('Static dashboard data is illustrative; no telemetry was written.', 'info');
  };

  // Alert status updates
  const handleUpdateAlertStatus = async (alertId: string, status: 'acknowledged' | 'resolved') => {
    try {
      await api.updateAlertStatus(alertId, status);
      setAlerts(await api.getNodeAlerts(selectedNodeId, 'all'));
      setAbnormalities(await api.getAllAbnormalities());
      addSystemLog(`Alert ${alertId} updated to ${status.toUpperCase()}`, 'warn');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update alert.');
    }
  };

  const openAlertsCount = alerts.filter(a => a.status === 'open').length;
  const intervalSeconds = completeness?.expected_interval_seconds;
  const packetAgeSeconds = completeness?.latest_packet_age_seconds;
  const isNodeOnline = Boolean(
    latestReading &&
    intervalSeconds &&
    packetAgeSeconds !== null && packetAgeSeconds !== undefined &&
    packetAgeSeconds <= intervalSeconds * 2 &&
    completeness?.status !== 'stale'
  );
  const activeBranch = latestReading?.active_branch || 'unknown';
  const selectedNode = nodes.find(n => n.node_id === selectedNodeId) || nodes[0] || {
    node_id: 'SJ-001',
    name: 'Static demo node',
    zone: 'Illustrative demo data',
  };

  const currentFilterClogged = latestReading?.filter_clogged_percent ?? selectedNode.filter_clogged_percent ?? Number.NaN;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b1329] text-slate-100 font-sans">
      {/* Desktop Left Navigation (With SuJal Logo without 'Pro', 4 Nav Buttons, and System Logs Status Panel) */}
      <div className="hidden lg:flex shrink-0">
        <Navigation
          currentView={currentView}
          onSelectView={handleSelectView}
          openAlertsCount={openAlertsCount}
          isStreaming={isStreaming}
          onToggleStreaming={() => {
            const next = !isStreaming;
            setIsStreaming(next);
            addSystemLog(next ? 'Live telemetry auto-refresh turned ON' : 'Live telemetry auto-refresh turned OFF', next ? 'success' : 'warn');
          }}
          onRefreshReadings={() => {
            void loadData(selectedNodeId);
            addSystemLog('Forced manual telemetry refresh executed', 'info');
          }}
          isBackendConnected={isBackendConnected}
          isNodeOnline={isNodeOnline}
          activeBranch={activeBranch}
          lastIngestTimeFormatted={lastIngestFormatted}
          systemLogs={systemLogs}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#0b1329]">
        {/* Top Header */}
        <Header
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            addSystemLog(`Node switched to ${id}`, 'info');
          }}
          onManualCycleNode={handleManualCycleNode}
          onSyncGsmLocation={syncGsmLocation}
          isGsmSyncing={isGsmSyncing}
          gsmLocationText={gsmLocationText}
          onSimulatePacket={handleSimulatePacket}
          onRefresh={() => {
            void loadData(selectedNodeId);
            addSystemLog('Telemetry sensors re-polled', 'info');
          }}
          lastTimestamp={latestReading?.timestamp}
          activeBranch={activeBranch}
          isBackendConnected={isBackendConnected}
          filterCloggedPercent={currentFilterClogged}
        />

        {loadError && (
          <div role="alert" className="px-5 py-2.5 bg-rose-950/80 border-b border-rose-700/80 text-rose-200 text-xs font-semibold flex items-center justify-between">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="text-rose-400 hover:text-white text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Mobile Header / Nav Toggle */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0d1838] border-b border-[#1f3764]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-[#14264e] text-slate-200 border border-[#274880]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
            </button>
            <div className="flex items-center gap-2">
              <img src="/sujal_monochrome_symbol_white.svg" alt="SuJal" className="w-6 h-6 object-contain" />
              <span className="font-extrabold text-sm bg-gradient-to-r from-cyan-400 to-white bg-clip-text text-transparent">
                SuJal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-800">
              Branch {activeBranch}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:hidden bg-[#0c1633] border-b border-[#1e355e] p-4 absolute top-[4.5rem] left-0 right-0 z-40 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <Navigation
                currentView={currentView}
                onSelectView={(v) => {
                  handleSelectView(v);
                  setMobileMenuOpen(false);
                }}
                openAlertsCount={openAlertsCount}
                isStreaming={isStreaming}
                onToggleStreaming={() => setIsStreaming(!isStreaming)}
                onRefreshReadings={() => void loadData(selectedNodeId)}
                isBackendConnected={isBackendConnected}
                isNodeOnline={isNodeOnline}
                activeBranch={activeBranch}
                lastIngestTimeFormatted={lastIngestFormatted}
                systemLogs={systemLogs}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Router for the 4 Dedicated Views */}
        <main className="flex-1 overflow-y-auto bg-[#0b1329]">
          <div key={currentView} className="h-full">
            {/* View 1: Dashboard with real-time graphs & filter clogged stats */}
            {currentView === 'dashboard' && (
              <DashboardView
                readings={readings}
                latestReading={isNodeOnline ? latestReading : null}
                thresholds={thresholds}
                comparison={comparison}
                completeness={completeness}
                isNodeOnline={isNodeOnline}
                activeNode={selectedNode}
                onManualCycleNode={handleManualCycleNode}
                gsmLocationText={gsmLocationText}
                onSyncGsmLocation={syncGsmLocation}
                onOpenAlerts={() => handleSelectView('alerts')}
              />
            )}

            {/* View 2: Maps with actual Leaflet GPS, node pins & click popups */}
            {currentView === 'maps' && (
              <MapView
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                latestReading={isNodeOnline ? latestReading : null}
                gsmCoords={gsmCoords}
                onSyncGsmLocation={syncGsmLocation}
                isGsmSyncing={isGsmSyncing}
              />
            )}

            {/* View 3: Logs and Archive with Previous Abnormalities & CSV Downloads */}
            {currentView === 'logs-archive' && (
              <LogsAndArchiveView
                abnormalities={abnormalities}
                archives={archives}
                readings={readings}
                onUpdateAlertStatus={handleUpdateAlertStatus}
                nodeId={selectedNodeId}
              />
            )}

            {/* View 4: Alerts & Operations */}
            {currentView === 'alerts' && (
              <AlertsView
                alerts={alerts}
                archives={archives}
                onUpdateAlertStatus={handleUpdateAlertStatus}
                nodeId={selectedNodeId}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

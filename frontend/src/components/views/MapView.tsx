import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation as NavIcon,
  Compass,
  Layers,
  Activity,
  Droplets,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Radio,
  MapPin
} from 'lucide-react';
import { NodeProfile, TelemetryReading } from '../../types';
import { formatReadingValue } from '../../services/api';

interface MapViewProps {
  nodes: NodeProfile[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  latestReading: TelemetryReading | null;
  gsmCoords: { lat: number; lon: number } | null;
  onSyncGsmLocation: () => void;
  isGsmSyncing: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  latestReading,
  gsmCoords,
  onSyncGsmLocation,
  isGsmSyncing,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on selected node or GSM coordinates (Delhi NCR baseline)
    const firstLocatedNode = nodes.find(node => node.location && Number.isFinite(node.location.latitude) && Number.isFinite(node.location.longitude));
    const initialLat = gsmCoords?.lat ?? firstLocatedNode?.location?.latitude ?? 28.6139;
    const initialLon = gsmCoords?.lon ?? firstLocatedNode?.location?.longitude ?? 77.2090;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Crisp OpenStreetMap standard tiles (real roads, rivers, water bodies, no API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers when nodes, selection, or telemetry updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    nodes.forEach(node => {
      if (!node.location || !Number.isFinite(node.location.latitude) || !Number.isFinite(node.location.longitude)) return;
      const location = node.location;
      const isSelected = node.node_id === selectedNodeId;
      const isClogged = Number.isFinite(node.filter_clogged_percent) && node.filter_clogged_percent! > 75;
      const latestMeasurements = isSelected ? latestReading?.measurements : undefined;

      // Custom pulsing HTML marker
      const markerHtml = `
        <div class="relative cursor-pointer group" style="transform: translate(-50%, -50%);">
          <div class="w-10 h-10 rounded-full flex items-center justify-center ${
            isSelected
              ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50 ring-4 ring-cyan-300/40 animate-pulse'
              : isClogged
              ? 'bg-rose-500 shadow-lg shadow-rose-500/40 ring-2 ring-rose-300/40'
              : 'bg-blue-600 shadow-md ring-2 ring-blue-400/30'
          }">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0b1329] text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border border-[#233d73] shadow-md pointer-events-none">
            ${node.node_id}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-sujal-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([location.latitude, location.longitude], { icon: customIcon });

      // Detailed Popup with all metrics
      const popupContent = `
        <div style="min-width: 280px; padding: 16px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #233d73; padding-bottom: 10px; margin-bottom: 12px;">
            <div>
              <span style="font-family: monospace; font-size: 11px; font-weight: 800; background: #082f49; color: #38bdf8; padding: 2px 8px; border-radius: 6px; border: 1px solid #0284c7;">
                ${node.node_id}
              </span>
              <h4 style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 6px; margin-bottom: 2px;">
                ${node.name || node.node_id}
              </h4>
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">${node.zone || 'Zone unset'} • ${node.address || ''}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-family: monospace;">
            <div style="background: #15244d; padding: 8px; border-radius: 8px; border: 1px solid #254278;">
              <div style="font-size: 10px; color: #94a3b8;">pH Level</div>
              <div style="font-size: 16px; font-weight: 800; color: #00f0ff;">
                ${formatReadingValue(latestMeasurements?.ph)}
              </div>
            </div>

            <div style="background: #15244d; padding: 8px; border-radius: 8px; border: 1px solid #254278;">
              <div style="font-size: 10px; color: #94a3b8;">Turbidity</div>
              <div style="font-size: 16px; font-weight: 800; color: #38bdf8;">
                ${formatReadingValue(latestMeasurements?.turbidity_ntu)} <span style="font-size: 10px; color: #94a3b8;">NTU</span>
              </div>
            </div>

            <div style="background: #15244d; padding: 8px; border-radius: 8px; border: 1px solid #254278;">
              <div style="font-size: 10px; color: #94a3b8;">Temperature</div>
              <div style="font-size: 15px; font-weight: 800; color: #fbbf24;">
                ${formatReadingValue(latestMeasurements?.temperature_c, 1)} °C
              </div>
            </div>

            <div style="background: #15244d; padding: 8px; border-radius: 8px; border: 1px solid #254278;">
              <div style="font-size: 10px; color: #94a3b8;">Filter Clogged</div>
              <div style="font-size: 15px; font-weight: 800; color: ${isClogged ? '#f43f5e' : '#94a3b8'};">
                ${Number.isFinite(node.filter_clogged_percent) ? `${formatReadingValue(node.filter_clogged_percent, 0)}%` : 'Not measured'}
              </div>
            </div>
          </div>

          <div style="background: #091228; padding: 8px 10px; border-radius: 8px; border: 1px solid #1a2f55; font-size: 11px; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">GPS Coordinates:</span>
            <span style="color: #e2e8f0; font-family: monospace;">
              ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
            </span>
          </div>

          <button id="select-node-btn-${node.node_id}" style="width: 100%; padding: 8px; background: linear-gradient(to right, #06b6d4, #2563eb); color: white; font-weight: 700; font-size: 12px; border-radius: 8px; border: none; cursor: pointer;">
            ${isSelected ? 'Active Telemetry Station' : 'Select This Station'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 320 });

      marker.on('click', () => {
        onSelectNode(node.node_id);
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`select-node-btn-${node.node_id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectNode(node.node_id);
          };
        }
      });

      marker.addTo(map);
      markersRef.current[node.node_id] = marker;
    });

    // If selected node changes, pan smoothly
    const sel = nodes.find(n => n.node_id === selectedNodeId);
    if (sel?.location && Number.isFinite(sel.location.latitude) && Number.isFinite(sel.location.longitude)) {
      map.panTo([sel.location.latitude, sel.location.longitude], { animate: true });
    }
  }, [nodes, selectedNodeId, latestReading]);

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] overflow-hidden bg-[#0b1329]">
      {/* Full-bleed Real Leaflet Map Container (Initially ONLY the Map is visible with node markers) */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Top Controls */}
      <div className="absolute top-5 left-5 z-[500] flex items-center gap-3">
        <div className="bg-[#0c1633]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#233d73] shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Live Satellite / Carto Map
            </span>
          </div>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-cyan-300 font-mono">
            {nodes.length} Stations Active
          </span>
        </div>

        {/* Sync My GPS Location Button */}
        <button
          onClick={onSyncGsmLocation}
          disabled={isGsmSyncing}
          className="bg-[#0c1633]/90 hover:bg-[#15274f] backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-[#233d73] shadow-xl flex items-center gap-2 text-xs font-semibold text-cyan-300 transition-colors"
        >
          <Compass className={`w-4 h-4 text-cyan-400 ${isGsmSyncing ? 'animate-spin text-amber-400' : ''}`} />
          <span>{isGsmSyncing ? 'Locating...' : 'Sync Laptop GPS'}</span>
        </button>
      </div>

      {/* Quick Station Switcher Pill Bar (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-[#0c1633]/95 backdrop-blur-md p-1.5 rounded-2xl border border-[#233d73] shadow-2xl flex items-center gap-1.5 max-w-[95vw] overflow-x-auto">
        {nodes.map(n => {
          const isSelected = n.node_id === selectedNodeId;
          return (
            <button
              key={n.node_id}
              onClick={() => {
                onSelectNode(n.node_id);
                markersRef.current[n.node_id]?.openPopup();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 whitespace-nowrap ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-[#15274f]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-cyan-400'}`} />
              <span>{n.node_id}</span>
              <span className="text-[10px] font-sans font-normal opacity-80 truncate max-w-[120px]">
                {n.name || 'Profile not set'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

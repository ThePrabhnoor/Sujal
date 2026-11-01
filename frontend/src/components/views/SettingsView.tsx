import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Compass,
  Radio,
  Info
} from 'lucide-react';
import { NodeProfile, OperatingThresholds } from '../../types';

interface SettingsViewProps {
  thresholds: OperatingThresholds;
  nodeProfile: NodeProfile;
  onSaveProfile: (profile: Partial<NodeProfile>) => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  thresholds,
  nodeProfile,
  onSaveProfile,
}) => {
  // Local Threshold State
  const [turbLimit, setTurbLimit] = useState(thresholds.turbidity_limit_ntu.toString());
  const [phMin, setPhMin] = useState(thresholds.ph_min.toString());
  const [phMax, setPhMax] = useState(thresholds.ph_max.toString());
  const [tempMin, setTempMin] = useState(thresholds.temperature_min_c.toString());
  const [tempMax, setTempMax] = useState(thresholds.temperature_max_c.toString());
  const [mq5Thresh, setMq5Thresh] = useState(Number.isFinite(thresholds.mq5_adc_alert_threshold) ? thresholds.mq5_adc_alert_threshold.toString() : '');
  const [intervalSec, setIntervalSec] = useState(Number.isFinite(thresholds.expected_interval_seconds) ? thresholds.expected_interval_seconds.toString() : '');

  // Local Profile State
  const [nodeName, setNodeName] = useState(nodeProfile.name || nodeProfile.node_id);
  const [address, setAddress] = useState(nodeProfile.address || '');
  const [lat, setLat] = useState(Number.isFinite(nodeProfile.location?.latitude) ? String(nodeProfile.location?.latitude) : '');
  const [lon, setLon] = useState(Number.isFinite(nodeProfile.location?.longitude) ? String(nodeProfile.location?.longitude) : '');
  const [locSource, setLocSource] = useState<'manual' | 'gps' | 'gsm'>(nodeProfile.location?.source || 'manual');
  const [isVerified, setIsVerified] = useState(nodeProfile.location?.verified || false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setProfileError('Enter valid latitude and longitude before saving this node profile.');
      return;
    }
    setProfileError('');
    try {
      await onSaveProfile({
      name: nodeName,
      address,
      location: {
        latitude,
        longitude,
        source: locSource,
        verified: isVerified,
      }
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save the node profile.');
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-100">Thresholds & Station Profile Settings</h2>
        </div>
        <p className="text-xs text-slate-400">
          Backend environment settings control alert thresholds. This page can edit node survey metadata for {nodeProfile.node_id}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL 1: Operational Limits Configuration */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#1b263a] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                Operational Telemetry Thresholds
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Triggers flags for operator review; not a potable water safety limit.
              </p>
            </div>
          </div>

          <form onSubmit={(event) => event.preventDefault()} className="space-y-4 text-xs">
            <fieldset disabled className="space-y-4 opacity-70">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Turbidity Limit (NTU)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={turbLimit}
                  onChange={(e) => setTurbLimit(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 5.0 NTU</span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Expected Interval (Sec)
                </label>
                <input
                  type="number"
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">ESP32 Ingestion Cadence</span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  pH Operating Min
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={phMin}
                  onChange={(e) => setPhMin(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  pH Operating Max
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={phMax}
                  onChange={(e) => setPhMax(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Temp Operating Min (°C)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={tempMin}
                  onChange={(e) => setTempMin(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Temp Operating Max (°C)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={tempMax}
                  onChange={(e) => setTempMax(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                MQ-5 Headspace Alert Threshold (ADC)
              </label>
              <input
                type="number"
                value={mq5Thresh}
                onChange={(e) => setMq5Thresh(e.target.value)}
                className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-purple-300 font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Uncalibrated headspace signal above water.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Thresholds are read-only here</span>
            </button>
            </fieldset>
          </form>
        </div>

        {/* PANEL 2: Node Survey Profile Editor */}
        <div className="bg-[#121927] border border-[#1f2b3f] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#1b263a] pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Station Profile & Coordinates
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Saved profile for map display via <code className="text-sky-300 font-mono text-[10px]">PUT /api/v1/nodes/:id/profile</code>
              </p>
              {!nodeProfile.location && <p className="text-[11px] text-amber-300 mt-1">This node has readings but no saved location profile yet.</p>}
            </div>
            {profileSaved && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Profile Updated!
              </span>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            {profileError && <p role="alert" className="text-amber-300">{profileError}</p>}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Station / Node ID</label>
              <input
                type="text"
                disabled
                value={nodeProfile.node_id}
                className="w-full bg-[#0a0e18]/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Station Display Name</label>
              <input
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Site Address / Landmark</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Optional physical checkpoint site description"
                className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Location Source</label>
                <select
                  value={locSource}
                  onChange={(e) => setLocSource(e.target.value as 'manual' | 'gps')}
                  className="w-full bg-[#0a0e18] border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="manual">manual (Fixed Survey)</option>
                  <option value="gps">gps (Device GPS Module)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Verification Status</label>
                <button
                  type="button"
                  onClick={() => setIsVerified(!isVerified)}
                  className={`w-full py-2 px-3 rounded-lg border font-mono font-semibold transition-colors ${
                    isVerified
                      ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                      : 'bg-amber-950/70 border-amber-700 text-amber-300'
                  }`}
                >
                  {isVerified ? 'VERIFIED' : 'PENDING CHECK'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Update Station Profile</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


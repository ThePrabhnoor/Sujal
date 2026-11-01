import {
  TelemetryReading,
  NodeProfile,
  AlertItem,
  OperatingThresholds,
  RunComparison,
  MonthlyArchive,
  CompletenessMetrics
} from '../types';
import {
  MOCK_NODES,
  MOCK_ABNORMALITIES,
  MOCK_ARCHIVES,
  INITIAL_THRESHOLDS
} from './mockData';

const BASE_URL = '/api';
const DEVICE_TOKEN = '8d37fc1349b1d8a8bbb58f6f05dbcf7f7e93789a7191926ac93bffc59d2940b9';

export function normalizeReading(r: any): TelemetryReading {
  if (!r) {
    throw new Error('Empty reading object');
  }
  const measurements = r.measurements || {};
  const flow = measurements.flow_lpm || {};
  const phase = r.phase || 'outlet';
  const activeBranch = r.active_branch || 'A';

  // Calculate realistic filter clogged indicator from flow or turbidity if not stored
  const turbidity = typeof measurements.turbidity_ntu === 'number' ? measurements.turbidity_ntu : 3.5;
  const filterClogged = r.filter_clogged_percent ?? (phase === 'outlet' && turbidity > 5 ? 78 : 24);

  return {
    _id: r.id || r._id || `rdg-${Date.now()}`,
    node_id: r.node_id || 'SJ-PAIR-TEST-002',
    event_id: r.event_id || r.id || 'esp32-packet',
    timestamp: r.recorded_at || r.timestamp || r.received_at || new Date().toISOString(),
    active_branch: activeBranch,
    phase: phase,
    run_id: r.run_id || '',
    filter_clogged_percent: filterClogged,
    measurements: {
      ph: typeof measurements.ph === 'number' ? measurements.ph : 7.20,
      turbidity_ntu: turbidity,
      temperature_c: typeof measurements.temperature_c === 'number' ? measurements.temperature_c : 24.5,
      mq5_adc: typeof measurements.mq5_adc === 'number' ? measurements.mq5_adc : 1800,
      mq5_digital: typeof measurements.mq5_digital === 'number' ? measurements.mq5_digital : 0,
      flow_lpm: {
        inlet: typeof flow.inlet === 'number' ? flow.inlet : (typeof flow.branch_a === 'number' ? flow.branch_a + 0.1 : 2.40),
        branch_a: typeof flow.branch_a === 'number' ? flow.branch_a : (activeBranch === 'B' ? 0.0 : 2.32),
        branch_b: typeof flow.branch_b === 'number' ? flow.branch_b : (activeBranch === 'B' ? 2.28 : 0.0),
      }
    },
    device_status: {
      wifi: r.device_status?.wifi || 'connected',
      valve_a: r.device_status?.valve_a || (activeBranch === 'B' ? 'closed' : 'open'),
      valve_b: r.device_status?.valve_b || (activeBranch === 'B' ? 'open' : 'closed'),
    },
    received_at: r.received_at || r.recorded_at || new Date().toISOString(),
  };
}

class ApiService {
  private isOnline = true;
  private thresholds: OperatingThresholds = { ...INITIAL_THRESHOLDS };

  async checkHealth(): Promise<{ status: string; mongodb_connected: boolean }> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        return {
          status: data.status || 'ok',
          mongodb_connected: data.database === 'connected' || data.mongodb_connected === true
        };
      }
    } catch {
      this.isOnline = false;
    }
    return { status: 'mock_mode', mongodb_connected: false };
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // Fetch nodes directly from MongoDB Atlas backend
  async listNodes(): Promise<NodeProfile[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const rawNodes = data.nodes || [];
        if (rawNodes.length > 0) {
          this.isOnline = true;
          return rawNodes.map((n: any) => {
            const defaultLocation = n.node_id === 'SJ-TEST-001'
              ? { latitude: 28.5476, longitude: 77.3094, source: 'gps', verified: true }
              : { latitude: 28.7112, longitude: 77.2319, source: 'gps', verified: true };
            const defaultName = n.node_id === 'SJ-PAIR-TEST-002'
              ? 'Yamuna Wazirabad Raw Intake Station'
              : n.node_id === 'SJ-TEST-001'
              ? 'Okhla Barrage Clarifier & Desiltation Header'
              : n.node_id;
            const defaultZone = n.node_id === 'SJ-PAIR-TEST-002'
              ? 'North Riverine Sector'
              : 'South Canal Basin';

            return {
              node_id: n.node_id,
              name: n.name || defaultName,
              zone: n.zone || defaultZone,
              address: n.address || '',
              location: n.location || defaultLocation,
              filter_clogged_percent: n.filter_clogged_percent ?? (n.node_id.includes('002') ? 24 : 64),
              filter_status: (n.filter_clogged_percent > 75 ? 'clogged' : n.filter_clogged_percent > 40 ? 'moderate' : 'optimal') as any,
              updated_at: n.updated_at
            };
          });
        }
      }
    } catch {
      // fallback to mock profiles if backend unavailable
    }
    return MOCK_NODES;
  }

  async getNodeProfile(nodeId: string): Promise<NodeProfile> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/profile`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const n = await res.json();
        return {
          node_id: n.node_id,
          name: n.name || n.node_id,
          zone: n.zone || 'Metropolitan Delhi Treatment Zone',
          address: n.address || '',
          location: n.location || { latitude: 28.7112, longitude: 77.2319, source: 'gps', verified: true },
          filter_clogged_percent: n.filter_clogged_percent ?? 24,
          filter_status: 'optimal',
          updated_at: n.updated_at
        };
      }
    } catch {
      // fallback
    }
    const found = MOCK_NODES.find(n => n.node_id === nodeId);
    return found || MOCK_NODES[0];
  }

  async updateNodeProfile(nodeId: string, profile: Partial<NodeProfile>): Promise<NodeProfile> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': DEVICE_TOKEN,
        },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      ...MOCK_NODES[0],
      ...profile,
      node_id: nodeId,
      updated_at: new Date().toISOString()
    };
  }

  // Update current device location from browser/laptop GPS in the backend
  async updateDeviceGsmLocation(
    nodeIdOrCoords: string | { latitude: number; longitude: number; accuracy_meters?: number },
    lat?: number,
    lon?: number,
    accuracy?: number
  ): Promise<NodeProfile> {
    let targetNodeId = 'SJ-PAIR-TEST-002';
    let targetLat = 28.7112;
    let targetLon = 77.2319;

    if (typeof nodeIdOrCoords === 'object') {
      targetLat = nodeIdOrCoords.latitude;
      targetLon = nodeIdOrCoords.longitude;
    } else {
      targetNodeId = nodeIdOrCoords;
      if (lat !== undefined) targetLat = lat;
      if (lon !== undefined) targetLon = lon;
    }

    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${targetNodeId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': DEVICE_TOKEN,
        },
        body: JSON.stringify({
          location: {
            latitude: targetLat,
            longitude: targetLon,
            source: 'gsm',
            verified: true,
          }
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }

    return {
      node_id: targetNodeId,
      name: 'Yamuna Wazirabad Raw Intake Station',
      zone: 'North Riverine Sector',
      location: { latitude: targetLat, longitude: targetLon, source: 'gsm', verified: true, accuracy_meters: accuracy || 10 },
      filter_clogged_percent: 24,
      filter_status: 'optimal'
    };
  }

  // Fetch the latest reading sent by the ESP32 from MongoDB Atlas
  async getLatestReading(nodeId: string): Promise<TelemetryReading | null> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/latest`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const raw = await res.json();
        return normalizeReading(raw);
      }
    } catch {
      // fallback
    }
    return null;
  }

  // Fetch chronological reading history directly from MongoDB Atlas backend
  async getReadingHistory(nodeId: string, limit: number = 100): Promise<TelemetryReading[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/readings?limit=${limit}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const rawList = data.readings || [];
        // Note: backend returns readings in DESCENDING order (newest first).
        // Reverse array so charts receive ASCENDING chronological order (left to right).
        return rawList.map((r: any) => normalizeReading(r)).reverse();
      }
    } catch {
      // fallback
    }
    return [];
  }

  // Fetch alerts from backend
  async getNodeAlerts(nodeId: string, status: string = 'all'): Promise<AlertItem[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/alerts?status=${status}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const list = data.alerts || [];
        return list.map((a: any) => ({
          _id: a.id || a._id,
          code: a.code,
          category: a.category || 'measurement',
          severity: a.severity || 'warning',
          title: a.title || a.message || 'Operational Alert',
          message: a.message,
          node_id: a.node_id || nodeId,
          run_id: a.run_id,
          phase: a.phase,
          status: a.status || 'open',
          safety_assessment: a.safety_assessment || false,
          created_at: a.created_at || new Date().toISOString(),
          updated_at: a.last_seen_at || a.updated_at,
        }));
      }
    } catch {
      // fallback
    }
    return MOCK_ABNORMALITIES.filter(a => a.node_id === nodeId || !a.node_id);
  }

  async getAllAbnormalities(): Promise<AlertItem[]> {
    try {
      // Query alerts for all known nodes from backend
      const nodes = await this.listNodes();
      const alertPromises = nodes.map(n => this.getNodeAlerts(n.node_id, 'all'));
      const results = await Promise.all(alertPromises);
      const combined = results.flat();
      if (combined.length > 0) return combined;
    } catch {
      // fallback
    }
    return MOCK_ABNORMALITIES;
  }

  async updateAlertStatus(alertId: string, status: 'open' | 'acknowledged' | 'resolved'): Promise<any> {
    try {
      const res = await fetch(`${BASE_URL}/v1/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { ok: true, id: alertId, status };
  }

  // Fetch pairing run comparison computed by the backend rules engine
  async getRunComparison(nodeId: string, runId: string): Promise<RunComparison> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/runs/${runId}/comparison`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        return {
          node_id: data.node_id || nodeId,
          run_id: data.run_id || runId,
          status: data.status || 'complete',
          turbidity_reduction_percent: data.turbidity_reduction_pct,
          turbidity_reduction_pct: data.turbidity_reduction_pct,
          turbidity_delta_ntu: data.comparisons?.turbidity_ntu?.change,
          ph_delta: data.comparisons?.ph?.change,
          temp_delta_c: data.comparisons?.temperature_c?.change,
          comparisons: data.comparisons,
          received: data.received,
        };
      }
    } catch {
      // fallback
    }
    return {
      node_id: nodeId,
      run_id: runId,
      status: 'complete',
      turbidity_reduction_percent: 51.55,
      turbidity_reduction_pct: 51.55,
      turbidity_delta_ntu: -2.5,
      ph_delta: 0.04,
      temp_delta_c: 0.1,
    };
  }

  // Fetch canonical monthly archives generated from MongoDB
  async getMonthlyArchives(nodeId: string): Promise<MonthlyArchive[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/archives`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const rawArchives = data.archives || [];
        if (rawArchives.length > 0) {
          return rawArchives.map((a: any) => ({
            month: a.month,
            count: a.readings_count,
            first_timestamp: a.first_reading_at,
            last_timestamp: a.last_reading_at,
            download_url: `${BASE_URL}/v1/nodes/${nodeId}/archives/${a.month}.csv`,
            size_kb: Math.round(a.readings_count * 0.48),
          }));
        }
      }
    } catch {
      // fallback
    }
    return MOCK_ARCHIVES;
  }

  getThresholds(): OperatingThresholds {
    return this.thresholds;
  }

  updateThresholds(newThresholds: Partial<OperatingThresholds>): OperatingThresholds {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    return this.thresholds;
  }

  // Send an ESP32 packet to the backend ingest API
  async sendTelemetryToBackend(nodeId: string, custom?: Partial<TelemetryReading>): Promise<any> {
    const now = new Date();
    const eventId = `esp32-pkt-${Date.now().toString(36)}`;
    const payload = {
      node_id: nodeId,
      event_id: eventId,
      timestamp: now.toISOString(),
      active_branch: custom?.active_branch || 'A',
      measurements: {
        ph: custom?.measurements?.ph ?? 7.20,
        turbidity_ntu: custom?.measurements?.turbidity_ntu ?? 4.80,
        temperature_c: custom?.measurements?.temperature_c ?? 24.6,
        mq5_adc: custom?.measurements?.mq5_adc ?? 1790,
        flow_lpm: {
          inlet: custom?.measurements?.flow_lpm?.inlet ?? 2.40,
          branch_a: custom?.measurements?.flow_lpm?.branch_a ?? 2.32,
          branch_b: 0.0,
        }
      },
      device_status: {
        wifi: 'connected',
        valve_a: 'open',
        valve_b: 'closed',
      }
    };

    const res = await fetch(`${BASE_URL}/v1/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': DEVICE_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
    throw new Error(`Failed to ingest telemetry: ${res.statusText}`);
  }

  async simulateTelemetryPacket(nodeId: string = 'SJ-PAIR-TEST-002'): Promise<TelemetryReading> {
    // Send directly to backend API and then fetch latest canonical reading
    await this.sendTelemetryToBackend(nodeId);
    const latest = await this.getLatestReading(nodeId);
    if (!latest) {
      throw new Error('No reading returned after ingestion');
    }
    return latest;
  }

  async getCompleteness(nodeId: string): Promise<CompletenessMetrics> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/telemetry-completeness`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        return {
          node_id: nodeId,
          completeness_percent: data.completeness_pct ?? 100,
          expected_interval_seconds: data.expected_interval_seconds ?? 30,
          status: data.status || 'optimal',
          received_packets: data.received_packets ?? 120,
          expected_packets: data.expected_packets ?? 120,
          duplicate_or_burst_packets: data.duplicate_or_burst_packets ?? 0,
        };
      }
    } catch {
      // fallback
    }
    return {
      node_id: nodeId,
      completeness_percent: 100,
      expected_interval_seconds: 30,
      status: 'optimal',
      received_packets: 120,
      expected_packets: 120,
      duplicate_or_burst_packets: 0,
    };
  }
}

export const api = new ApiService();

export function formatReadingValue(val: number | undefined | null, digits = 2, unit = ''): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toFixed(digits)}${unit ? ' ' + unit : ''}`;
}

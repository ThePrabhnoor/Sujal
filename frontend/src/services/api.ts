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
  MOCK_ALERTS,
  MOCK_ARCHIVES,
  MOCK_COMPLETENESS,
  MOCK_RUN_COMPARISON,
  INITIAL_THRESHOLDS,
  generateMockReadings
} from './mockData';

const BASE_URL = '/api';

class ApiService {
  private isOnline = false;
  private currentReadings: Record<string, TelemetryReading[]> = {
    'SJ-001': generateMockReadings('SJ-001', 40),
    'SJ-002': generateMockReadings('SJ-002', 30),
    'SJ-003': generateMockReadings('SJ-003', 20),
  };
  private nodes: NodeProfile[] = [...MOCK_NODES];
  private alerts: AlertItem[] = [...MOCK_ALERTS];
  private thresholds: OperatingThresholds = { ...INITIAL_THRESHOLDS };

  async checkHealth(): Promise<{ status: string; mongodb_connected: boolean }> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        return data;
      }
    } catch {
      this.isOnline = false;
    }
    return { status: 'mock_mode', mongodb_connected: false };
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  async listNodes(): Promise<NodeProfile[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        return data.nodes || data;
      }
    } catch {
      // fallback
    }
    return this.nodes;
  }

  async getNodeProfile(nodeId: string): Promise<NodeProfile> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/profile`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const found = this.nodes.find(n => n.node_id === nodeId);
    return found || this.nodes[0];
  }

  async updateNodeProfile(nodeId: string, profile: Partial<NodeProfile>): Promise<NodeProfile> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const idx = this.nodes.findIndex(n => n.node_id === nodeId);
    if (idx >= 0) {
      this.nodes[idx] = {
        ...this.nodes[idx],
        ...profile,
        location: { ...this.nodes[idx].location, ...(profile.location || {}) },
        updated_at: new Date().toISOString()
      };
      return this.nodes[idx];
    }
    return this.nodes[0];
  }

  async getLatestReading(nodeId: string): Promise<TelemetryReading | null> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/latest`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const list = this.currentReadings[nodeId] || this.currentReadings['SJ-001'];
    return list[list.length - 1] || null;
  }

  async getReadingHistory(nodeId: string, limit: number = 100): Promise<TelemetryReading[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/readings?limit=${limit}`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return data.readings || data;
      }
    } catch {
      // fallback
    }
    const list = this.currentReadings[nodeId] || this.currentReadings['SJ-001'];
    return list.slice(-limit);
  }

  async getNodeAlerts(nodeId: string): Promise<AlertItem[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/alerts`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return data.alerts || data;
      }
    } catch {
      // fallback
    }
    return this.alerts.filter(a => a.node_id === nodeId || !a.node_id);
  }

  async updateAlertStatus(alertId: string, status: 'open' | 'acknowledged' | 'resolved'): Promise<AlertItem> {
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
    const item = this.alerts.find(a => a._id === alertId);
    if (item) {
      item.status = status;
      item.updated_at = new Date().toISOString();
      return item;
    }
    throw new Error('Alert not found');
  }

  async getRunComparison(nodeId: string, runId: string): Promise<RunComparison> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/runs/${runId}/comparison`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { ...MOCK_RUN_COMPARISON, node_id: nodeId, run_id: runId };
  }

  async getMonthlyArchives(nodeId: string): Promise<MonthlyArchive[]> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/archives`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return data.archives || data;
      }
    } catch {
      // fallback
    }
    return MOCK_ARCHIVES;
  }

  async getCompleteness(nodeId: string): Promise<CompletenessMetrics> {
    try {
      const res = await fetch(`${BASE_URL}/v1/nodes/${nodeId}/completeness`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { ...MOCK_COMPLETENESS, node_id: nodeId };
  }

  getThresholds(): OperatingThresholds {
    return this.thresholds;
  }

  updateThresholds(newThresholds: Partial<OperatingThresholds>): OperatingThresholds {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    return this.thresholds;
  }

  // Simulate pushing a new reading (as if ESP32 sent a packet)
  simulateIngestReading(nodeId: string = 'SJ-001', custom?: Partial<TelemetryReading>): TelemetryReading {
    const list = this.currentReadings[nodeId] || [];
    const last = list[list.length - 1];
    const newPhase: 'inlet' | 'outlet' = (last?.phase === 'inlet') ? 'outlet' : 'inlet';
    const isOutlet = newPhase === 'outlet';
    
    const count = list.length + 1;
    const now = new Date();
    
    const reading: TelemetryReading = {
      _id: `rec-live-${Date.now()}`,
      node_id: nodeId,
      event_id: `esp32-live-rdg${count}`,
      timestamp: now.toISOString(),
      active_branch: custom?.active_branch || last?.active_branch || 'A',
      phase: newPhase,
      run_id: isOutlet ? last?.run_id || `run-${100 + Math.floor(count / 2)}` : `run-${101 + Math.floor(count / 2)}`,
      measurements: {
        ph: custom?.measurements?.ph ?? Number((7.18 + (Math.random() - 0.5) * 0.15).toFixed(2)),
        turbidity_ntu: custom?.measurements?.turbidity_ntu ?? (isOutlet ? Number((5.7 + Math.random() * 0.3).toFixed(2)) : Number((9.2 + Math.random() * 0.5).toFixed(2))),
        temperature_c: custom?.measurements?.temperature_c ?? Number((24.5 + Math.random() * 0.3).toFixed(1)),
        mq5_adc: custom?.measurements?.mq5_adc ?? Math.round(1820 + Math.random() * 30),
        mq5_digital: custom?.measurements?.mq5_digital ?? 0,
        flow_lpm: {
          inlet: custom?.measurements?.flow_lpm?.inlet ?? Number((2.35 + Math.random() * 0.15).toFixed(2)),
          branch_a: custom?.active_branch === 'B' ? 0.0 : Number((2.28 + Math.random() * 0.12).toFixed(2)),
          branch_b: custom?.active_branch === 'B' ? Number((2.25 + Math.random() * 0.12).toFixed(2)) : 0.0,
        }
      },
      device_status: {
        wifi: 'connected',
        valve_a: custom?.active_branch === 'B' ? 'closed' : 'open',
        valve_b: custom?.active_branch === 'B' ? 'open' : 'closed',
        ...custom?.device_status
      },
      received_at: now.toISOString(),
    };

    list.push(reading);
    if (list.length > 100) list.shift();
    this.currentReadings[nodeId] = list;

    // Check operating limits to create alerts if exceeded
    if (reading.measurements.turbidity_ntu > this.thresholds.turbidity_limit_ntu && isOutlet) {
      const newAlert: AlertItem = {
        _id: `alt-${Date.now()}`,
        code: 'turbidity_excursion',
        category: 'measurement',
        severity: 'high',
        title: 'Turbidity above configured operating limit',
        message: `${reading.measurements.turbidity_ntu} NTU exceeds ${this.thresholds.turbidity_limit_ntu} NTU threshold.`,
        node_id: nodeId,
        run_id: reading.run_id,
        phase: reading.phase,
        reading_id: reading._id,
        status: 'open',
        safety_assessment: false,
        created_at: now.toISOString()
      };
      this.alerts.unshift(newAlert);
    }

    return reading;
  }
}

export const api = new ApiService();


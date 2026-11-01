import {
  TelemetryReading,
  NodeProfile,
  AlertItem,
  OperatingThresholds,
  RunComparison,
  MonthlyArchive,
  CompletenessMetrics,
  SixHourAverages,
  RunInterpretation,
} from '../types';

const BASE_URL = '/api';
type JsonObject = Record<string, any>;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    signal: init?.signal || AbortSignal.timeout(8000),
  });
  const contentType = response.headers.get('content-type') || '';
  const body: any = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body?.error
      ? body.error
      : `${response.status} ${response.statusText}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

const finiteOrNaN = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;

function normalizeReading(raw: JsonObject): TelemetryReading {
  if (!raw || typeof raw !== 'object') throw new Error('Backend returned an invalid reading.');
  const measurements = raw.measurements && typeof raw.measurements === 'object' ? raw.measurements : {};
  const flow = measurements.flow_lpm && typeof measurements.flow_lpm === 'object' ? measurements.flow_lpm : {};
  const device = raw.device_status && typeof raw.device_status === 'object' ? raw.device_status : {};
  return {
    _id: raw.id || raw._id || undefined,
    node_id: String(raw.node_id || ''),
    event_id: String(raw.event_id || ''),
    timestamp: String(raw.recorded_at || raw.timestamp || raw.received_at || ''),
    active_branch: raw.active_branch || 'unknown',
    phase: raw.phase || undefined,
    run_id: raw.run_id || undefined,
    // No pressure sensor is installed, so filter clog percentage is not measured.
    filter_clogged_percent: Number.NaN,
    measurements: {
      ph: finiteOrNaN(measurements.ph),
      turbidity_ntu: finiteOrNaN(measurements.turbidity_ntu),
      temperature_c: finiteOrNaN(measurements.temperature_c),
      mq5_adc: finiteOrNaN(measurements.mq5_adc),
      mq5_digital: finiteOrNaN(measurements.mq5_digital),
      flow_lpm: {
        inlet: finiteOrNaN(flow.inlet),
        branch_a: finiteOrNaN(flow.branch_a),
        branch_b: finiteOrNaN(flow.branch_b),
      },
    },
    device_status: {
      wifi: typeof device.wifi === 'string' ? device.wifi : 'unknown',
      valve_a: typeof device.valve_a === 'string' ? device.valve_a : 'unknown',
      valve_b: typeof device.valve_b === 'string' ? device.valve_b : 'unknown',
    },
    received_at: raw.received_at || undefined,
  };
}

function normalizeNode(raw: JsonObject): NodeProfile {
  const location = raw.location && typeof raw.location === 'object' ? raw.location : undefined;
  const latitude = finiteOrNaN(location?.latitude);
  const longitude = finiteOrNaN(location?.longitude);
  return {
    node_id: String(raw.node_id || ''),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : undefined,
    zone: typeof raw.zone === 'string' && raw.zone.trim() ? raw.zone : undefined,
    address: typeof raw.address === 'string' && raw.address.trim() ? raw.address : undefined,
    location: Number.isFinite(latitude) && Number.isFinite(longitude) ? {
      latitude,
      longitude,
      source: location?.source === 'gps' ? 'gps' : 'manual',
      verified: location?.verified === true,
    } : undefined,
    // Do not surface an unvalidated filter-clog estimate as telemetry.
    filter_clogged_percent: undefined,
    filter_status: raw.filter_status || undefined,
    updated_at: raw.updated_at || undefined,
  };
}

function normalizeAlert(raw: JsonObject): AlertItem {
  return {
    _id: String(raw.id || raw._id || ''),
    code: String(raw.code || 'unknown'),
    category: String(raw.category || 'system'),
    severity: String(raw.severity || 'warning'),
    title: String(raw.title || raw.code || 'Alert'),
    message: String(raw.message || ''),
    node_id: String(raw.node_id || ''),
    run_id: raw.run_id || undefined,
    phase: raw.phase || undefined,
    reading_id: raw.reading_id || raw.latest_reading_id || undefined,
    status: raw.status || 'open',
    safety_assessment: raw.safety_assessment === true,
    created_at: raw.created_at || raw.last_seen_at || '',
    updated_at: raw.updated_at || raw.last_seen_at || undefined,
  };
}

class ApiService {
  async checkHealth(): Promise<{ status: string; database: string }> {
    return requestJson('/health');
  }

  async listNodes(): Promise<NodeProfile[]> {
    const data = await requestJson<JsonObject>('/v1/nodes');
    return (data.nodes || []).map(normalizeNode).filter((node: NodeProfile) => node.node_id);
  }

  async getNodeProfile(nodeId: string): Promise<NodeProfile | null> {
    try {
      return normalizeNode(await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/profile`));
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  }

  // Browser profile writes intentionally carry no device secret. Configure a
  // separate authenticated admin flow before enabling profile editing.
  async updateNodeProfile(nodeId: string, profile: Partial<NodeProfile>): Promise<NodeProfile> {
    const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    return normalizeNode(data);
  }

  async getLatestReading(nodeId: string): Promise<TelemetryReading | null> {
    try {
      return normalizeReading(await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/latest`));
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  }

  async getReadingHistory(nodeId: string, limit = 100): Promise<TelemetryReading[]> {
    const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/readings?limit=${limit}`);
    return (data.readings || []).map(normalizeReading).reverse();
  }

  async getNodeAlerts(nodeId: string, status: 'open' | 'acknowledged' | 'resolved' | 'all' = 'all'): Promise<AlertItem[]> {
    try {
      const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/alerts?status=${status}`);
      return (data.alerts || []).map(normalizeAlert);
    } catch {
      return [];
    }
  }

  async getAllAbnormalities(): Promise<AlertItem[]> {
    try {
      const nodes = await this.listNodes();
      const all = await Promise.all(nodes.map(node => this.getNodeAlerts(node.node_id, 'all')));
      return all.flat();
    } catch {
      return [];
    }
  }

  async updateAlertStatus(alertId: string, status: 'acknowledged' | 'resolved'): Promise<void> {
    await requestJson(`/v1/alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async getRunComparison(nodeId: string, runId: string): Promise<RunComparison | null> {
    try {
      const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/runs/${encodeURIComponent(runId)}/comparison`);
      return {
        node_id: data.node_id,
        run_id: data.run_id,
        status: data.status,
        received: data.received,
        comparisons: data.comparisons || {},
        turbidity_reduction_pct: data.turbidity_reduction_pct ?? null,
        note: data.note,
      };
    } catch {
      return null;
    }
  }

  async generateRunInterpretation(nodeId: string, runId: string): Promise<RunInterpretation> {
    return requestJson<RunInterpretation>(
      `/v1/nodes/${encodeURIComponent(nodeId)}/runs/${encodeURIComponent(runId)}/interpretation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(60000),
      },
    );
  }

  async getRunInterpretation(nodeId: string, runId: string): Promise<RunInterpretation> {
    return requestJson<RunInterpretation>(
      `/v1/nodes/${encodeURIComponent(nodeId)}/runs/${encodeURIComponent(runId)}/interpretation`,
    );
  }

  async getMonthlyArchives(nodeId: string): Promise<MonthlyArchive[]> {
    try {
      const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/archives`);
      return (data.archives || []).map((item: JsonObject) => ({
        month: item.month,
        count: item.readings_count,
        first_timestamp: item.first_reading_at,
        last_timestamp: item.last_reading_at,
        download_url: `${BASE_URL}/v1/nodes/${encodeURIComponent(nodeId)}/archives/${encodeURIComponent(item.month)}.csv`,
      }));
    } catch {
      return [];
    }
  }

  async getCompleteness(nodeId: string): Promise<CompletenessMetrics | null> {
    try {
      const data = await requestJson<JsonObject>(`/v1/nodes/${encodeURIComponent(nodeId)}/telemetry-completeness`);
      return {
        node_id: data.node_id,
        status: data.status,
        completeness_percent: data.completeness_pct ?? null,
        expected_interval_seconds: data.expected_interval_seconds ?? null,
        received_packets: data.received_packets ?? null,
        raw_packets: data.raw_packets ?? null,
        duplicate_or_burst_packets: data.duplicate_or_burst_packets ?? null,
        expected_packets: data.expected_packets ?? null,
        window_seconds: data.window_seconds ?? null,
        latest_packet_age_seconds: data.latest_packet_age_seconds ?? null,
        note: data.note,
      };
    } catch {
      return null;
    }
  }

  async getSixHourAverages(nodeId: string, date?: string): Promise<SixHourAverages> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return requestJson<SixHourAverages>(
      `/v1/nodes/${encodeURIComponent(nodeId)}/averages/6-hour${query}`,
    );
  }

  getThresholds(): OperatingThresholds {
    return {
      turbidity_limit_ntu: 5,
      ph_min: 6.5,
      ph_max: 8.5,
      temperature_min_c: 5,
      temperature_max_c: 40,
      mq5_adc_alert_threshold: Number.NaN,
      mq5_digital_alarm_value: Number.NaN,
      active_flow_min_lpm: Number.NaN,
      expected_interval_seconds: Number.NaN,
    };
  }

  async getConfiguredThresholds(): Promise<OperatingThresholds> {
    const data = await requestJson<JsonObject>('/v1/config/thresholds');
    const values = data.thresholds || {};
    return {
      turbidity_limit_ntu: finiteOrNaN(values.turbidity_limit_ntu),
      ph_min: finiteOrNaN(values.ph_min),
      ph_max: finiteOrNaN(values.ph_max),
      temperature_min_c: finiteOrNaN(values.temperature_min_c),
      temperature_max_c: finiteOrNaN(values.temperature_max_c),
      mq5_adc_alert_threshold: finiteOrNaN(values.mq5_adc_alert_threshold),
      mq5_digital_alarm_value: finiteOrNaN(values.mq5_digital_alarm_value),
      active_flow_min_lpm: finiteOrNaN(values.active_flow_min_lpm),
      expected_interval_seconds: finiteOrNaN(values.expected_interval_seconds),
    };
  }
}

export const api = new ApiService();

export const formatReadingValue = (value: number | null | undefined, digits = 2): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

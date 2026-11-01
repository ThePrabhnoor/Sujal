export interface FlowRates {
  inlet: number;
  branch_a: number;
  branch_b: number;
}

export interface Measurements {
  ph: number;
  turbidity_ntu: number;
  temperature_c: number;
  mq5_adc: number;
  mq5_digital: number;
  flow_lpm: FlowRates;
}

export interface DeviceStatus {
  wifi: 'connected' | 'disconnected' | 'reconnecting';
  valve_a: 'open' | 'closed';
  valve_b: 'open' | 'closed';
}

export interface TelemetryReading {
  _id?: string;
  node_id: string;
  event_id: string;
  timestamp: string;
  active_branch: 'A' | 'B' | string;
  phase: 'inlet' | 'outlet';
  run_id?: string;
  measurements: Measurements;
  device_status: DeviceStatus;
  received_at?: string;
  filter_clogged_percent?: number;
}

export interface NodeLocation {
  latitude: number;
  longitude: number;
  source: 'manual' | 'gps' | 'gsm';
  verified: boolean;
  accuracy_meters?: number;
}

export interface NodeProfile {
  node_id: string;
  name: string;
  zone: string;
  address?: string;
  location: NodeLocation;
  updated_at?: string;
  filter_clogged_percent: number;
  filter_status: 'optimal' | 'moderate' | 'clogged';
  last_maintenance?: string;
}

export interface AlertItem {
  _id: string;
  code: string;
  category: 'measurement' | 'environmental_sensor' | 'hardware' | 'network' | 'filter';
  severity: 'high' | 'warning' | 'info';
  title: string;
  message: string;
  node_id: string;
  run_id?: string;
  phase?: 'inlet' | 'outlet';
  reading_id?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  safety_assessment: boolean;
  created_at: string;
  updated_at?: string;
}

export interface OperatingThresholds {
  turbidity_limit_ntu: number;
  ph_min: number;
  ph_max: number;
  temperature_min_c: number;
  temperature_max_c: number;
  mq5_adc_alert_threshold: number;
  mq5_digital_alarm_value: number;
  active_flow_min_lpm: number;
  expected_interval_seconds: number;
}

export interface RunComparison {
  node_id: string;
  run_id: string;
  status: 'complete' | 'waiting_for_pair' | 'paired';
  inlet?: TelemetryReading;
  outlet?: TelemetryReading;
  turbidity_reduction_percent?: number;
  turbidity_reduction_pct?: number;
  turbidity_delta_ntu?: number;
  ph_delta?: number;
  temp_delta_c?: number;
  comparisons?: Record<string, any>;
  received?: { inlet?: boolean; outlet?: boolean };
}

export interface CompletenessMetrics {
  node_id: string;
  total_expected?: number;
  total_received?: number;
  completeness_percent: number | null;
  missing_runs?: string[];
  expected_interval_seconds?: number;
  latest_packet_age_seconds?: number | null;
  status?: string;
  received_packets?: number;
  expected_packets?: number;
  duplicate_or_burst_packets?: number;
}

export interface MonthlyArchive {
  month: string;
  count: number;
  first_timestamp: string;
  last_timestamp: string;
  download_url: string;
  size_kb: number;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'success' | 'alert';
}

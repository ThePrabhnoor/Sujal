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
  wifi: string;
  valve_a: string;
  valve_b: string;
}

export interface TelemetryReading {
  _id?: string;
  node_id: string;
  event_id: string;
  timestamp: string;
  active_branch: 'A' | 'B' | 'none' | 'unknown' | string;
  phase?: 'inlet' | 'outlet';
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
  name?: string;
  zone?: string;
  address?: string;
  location?: NodeLocation;
  updated_at?: string;
  filter_clogged_percent?: number;
  filter_status?: 'optimal' | 'moderate' | 'clogged';
  last_maintenance?: string;
}

export interface AlertItem {
  _id: string;
  code: string;
  category: string;
  severity: string;
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
  status: 'waiting_for_pair' | 'paired' | string;
  comparisons: Record<string, { inlet: number; outlet: number; change: number }>;
  turbidity_reduction_pct?: number | null;
  received?: { inlet?: boolean; outlet?: boolean };
  note?: string;
}

export interface RunInterpretation {
  node_id: string;
  run_id: string;
  model: string;
  summary: {
    water_comparisons: Record<string, { inlet: number; outlet: number; change_outlet_minus_inlet: number }>;
    turbidity_reduction_pct: number | null;
    missing_required_measurements: { inlet: string[]; outlet: string[] };
    operational_alerts: Array<{
      code?: string;
      severity?: string;
      title?: string;
      message?: string;
      status?: string;
    }>;
  };
  interpretation: {
    observed_changes: string[];
    operational_interpretation: string;
    suggested_checks: string[];
    data_quality_notes: string[];
    disclaimer: string;
  };
  generated_at: string;
  cached?: boolean;
}

export interface CompletenessMetrics {
  node_id: string;
  status: string;
  completeness_percent: number | null;
  expected_interval_seconds: number | null;
  latest_packet_age_seconds?: number | null;
  received_packets: number | null;
  raw_packets: number | null;
  expected_packets: number | null;
  duplicate_or_burst_packets: number | null;
  window_seconds: number | null;
  note?: string;
}

export interface SixHourAverageBucket {
  slot: number;
  start: string;
  end: string;
  reading_count: number;
  averages: Record<'ph' | 'turbidity_ntu' | 'temperature_c' | 'mq5_adc' | 'mq5_digital', number | null>;
  valid_counts: Record<string, number>;
  excluded_counts: Record<string, number>;
  flow_lpm: Record<string, { average: number | null; valid_count: number; excluded_count: number }>;
}

export interface SixHourAverages {
  node_id: string;
  date: string;
  timezone: 'Asia/Kolkata';
  buckets: SixHourAverageBucket[];
  validity_rules: Record<string, string>;
}

export interface MonthlyArchive {
  month: string;
  count: number;
  first_timestamp: string;
  last_timestamp: string;
  download_url: string;
  size_kb?: number;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'success' | 'alert';
}

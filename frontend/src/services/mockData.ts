import {
  TelemetryReading,
  NodeProfile,
  AlertItem,
  OperatingThresholds,
  RunComparison,
  MonthlyArchive,
  CompletenessMetrics
} from '../types';

export const INITIAL_THRESHOLDS: OperatingThresholds = {
  turbidity_limit_ntu: 5.0,
  ph_min: 6.5,
  ph_max: 8.5,
  temperature_min_c: 5.0,
  temperature_max_c: 40.0,
  mq5_adc_alert_threshold: 2200,
  mq5_digital_alarm_value: 1,
  active_flow_min_lpm: 1.0,
  expected_interval_seconds: 30,
};

export const MOCK_NODES: NodeProfile[] = [
  {
    node_id: 'SJ-001',
    name: 'Locality Checkpoint 1 - Main Station',
    address: 'Sector 4, Central Filtration Plant, New Delhi',
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      source: 'manual',
      verified: true,
    },
    updated_at: '2026-10-31T20:15:00Z',
  },
  {
    node_id: 'SJ-002',
    name: 'Locality Checkpoint 2 - River Inflow',
    address: 'Yamuna Canal Feeder, Node B',
    location: {
      latitude: 28.6448,
      longitude: 77.2167,
      source: 'gps',
      verified: true,
    },
    updated_at: '2026-10-31T21:40:00Z',
  },
  {
    node_id: 'SJ-003',
    name: 'Locality Checkpoint 3 - Sub-station West',
    address: 'Palam Colony Distribution Header',
    location: {
      latitude: 28.5892,
      longitude: 77.0863,
      source: 'manual',
      verified: false,
    },
    updated_at: '2026-10-31T18:00:00Z',
  },
];

// Generate 40 historical readings with realistic patterns
export const generateMockReadings = (nodeId: string = 'SJ-001', count: number = 40): TelemetryReading[] => {
  const readings: TelemetryReading[] = [];
  const now = Date.now();
  const intervalMs = 30 * 1000; // 30s interval

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * intervalMs);
    const phase: 'inlet' | 'outlet' = i % 2 === 0 ? 'outlet' : 'inlet';
    const isOutlet = phase === 'outlet';
    
    // Wave calculations for natural looking telemetry
    const sinOffset = Math.sin((count - i) * 0.25);
    const noise = (Math.random() - 0.5) * 0.1;
    
    const ph = Number((7.2 + sinOffset * 0.15 + noise).toFixed(2));
    const rawTurbidity = isOutlet 
      ? Number((5.8 + sinOffset * 0.6 + noise * 2).toFixed(2))
      : Number((9.4 + sinOffset * 0.8 + noise * 3).toFixed(2));
    
    const temp = Number((24.6 + Math.cos((count - i) * 0.2) * 0.8 + noise).toFixed(1));
    const mq5 = Math.round(1830 + sinOffset * 40 + (Math.random() - 0.5) * 20);
    
    const inletFlow = Number((2.4 + noise * 0.5).toFixed(2));
    const branchAFlow = Number((2.3 + noise * 0.4).toFixed(2));
    
    const runNumber = Math.floor((count - i) / 2) + 100;
    
    readings.push({
      _id: `rec-${count - i}-${time.getTime()}`,
      node_id: nodeId,
      event_id: `esp32-boot7-rdg${count - i}`,
      timestamp: time.toISOString(),
      active_branch: 'A',
      phase,
      run_id: `run-${runNumber}`,
      measurements: {
        ph,
        turbidity_ntu: Math.max(0.5, rawTurbidity),
        temperature_c: temp,
        mq5_adc: mq5,
        mq5_digital: 0,
        flow_lpm: {
          inlet: inletFlow,
          branch_a: branchAFlow,
          branch_b: 0.0,
        },
      },
      device_status: {
        wifi: 'connected',
        valve_a: 'open',
        valve_b: 'closed',
      },
      received_at: time.toISOString(),
    });
  }

  return readings;
};

export const MOCK_ALERTS: AlertItem[] = [
  {
    _id: 'alt-001',
    code: 'turbidity_excursion',
    category: 'measurement',
    severity: 'high',
    title: 'Turbidity above configured operating limit',
    message: '5.8 NTU exceeds this node\'s configured 5.0 NTU operating limit.',
    node_id: 'SJ-001',
    run_id: 'run-118',
    phase: 'outlet',
    reading_id: 'rec-38',
    status: 'open',
    safety_assessment: false,
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    _id: 'alt-002',
    code: 'mq5_headspace_signal_high',
    category: 'environmental_sensor',
    severity: 'warning',
    title: 'MQ-5 headspace signal approaching warning baseline',
    message: 'MQ-5 ADC reading 1845 is near baseline monitoring threshold; uncalibrated headspace sensor.',
    node_id: 'SJ-001',
    run_id: 'run-115',
    phase: 'inlet',
    reading_id: 'rec-32',
    status: 'acknowledged',
    safety_assessment: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    _id: 'alt-003',
    code: 'ph_above_operating_range',
    category: 'measurement',
    severity: 'warning',
    title: 'pH spike flagged on inlet intake',
    message: 'pH 7.42 transient reading captured during purge sequence.',
    node_id: 'SJ-002',
    run_id: 'run-89',
    phase: 'inlet',
    status: 'resolved',
    safety_assessment: false,
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

export const MOCK_ARCHIVES: MonthlyArchive[] = [
  {
    month: '2026-10',
    count: 8640,
    first_timestamp: '2026-10-01T00:00:15Z',
    last_timestamp: '2026-10-31T23:59:45Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-10.csv',
  },
  {
    month: '2026-09',
    count: 8420,
    first_timestamp: '2026-09-01T00:00:30Z',
    last_timestamp: '2026-09-30T23:58:10Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-09.csv',
  },
  {
    month: '2026-08',
    count: 8190,
    first_timestamp: '2026-08-01T00:01:00Z',
    last_timestamp: '2026-08-31T23:55:00Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-08.csv',
  },
];

export const MOCK_COMPLETENESS: CompletenessMetrics = {
  node_id: 'SJ-001',
  total_packets: 2880,
  expected_interval_seconds: 30,
  average_interval_seconds: 30.14,
  completeness_percent: 99.5,
  dropped_estimate: 14,
  last_seen: new Date().toISOString(),
};

export const MOCK_RUN_COMPARISON: RunComparison = {
  node_id: 'SJ-001',
  run_id: 'run-118',
  status: 'complete',
  inlet: {
    node_id: 'SJ-001',
    event_id: 'esp32-boot7-rdg37',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    active_branch: 'A',
    phase: 'inlet',
    run_id: 'run-118',
    measurements: {
      ph: 7.22,
      turbidity_ntu: 9.40,
      temperature_c: 24.5,
      mq5_adc: 1820,
      mq5_digital: 0,
      flow_lpm: { inlet: 2.4, branch_a: 2.3, branch_b: 0.0 },
    },
    device_status: { wifi: 'connected', valve_a: 'open', valve_b: 'closed' },
  },
  outlet: {
    node_id: 'SJ-001',
    event_id: 'esp32-boot7-rdg38',
    timestamp: new Date(Date.now() - 30000).toISOString(),
    active_branch: 'A',
    phase: 'outlet',
    run_id: 'run-118',
    measurements: {
      ph: 7.20,
      turbidity_ntu: 5.80,
      temperature_c: 24.6,
      mq5_adc: 1830,
      mq5_digital: 0,
      flow_lpm: { inlet: 2.4, branch_a: 2.3, branch_b: 0.0 },
    },
    device_status: { wifi: 'connected', valve_a: 'open', valve_b: 'closed' },
  },
  turbidity_reduction_percent: 38.3,
  turbidity_delta_ntu: -3.6,
  ph_delta: -0.02,
  temp_delta_c: 0.1,
};


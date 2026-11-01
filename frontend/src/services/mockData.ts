import {
  TelemetryReading,
  NodeProfile,
  AlertItem,
  OperatingThresholds,
  RunComparison,
  MonthlyArchive,
  SystemLogEntry
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
    name: 'Yamuna Wazirabad Raw Intake Station',
    zone: 'North Riverine Sector',
    address: 'Wazirabad Waterworks Pier 3, North Delhi',
    location: {
      latitude: 28.7112,
      longitude: 77.2319,
      source: 'gsm',
      verified: true,
      accuracy_meters: 8,
    },
    filter_clogged_percent: 28,
    filter_status: 'optimal',
    last_maintenance: '2026-10-24T08:30:00Z',
    updated_at: '2026-11-01T07:15:00Z',
  },
  {
    node_id: 'SJ-002',
    name: 'Okhla Barrage Clarifier & Desiltation Header',
    zone: 'South Canal Basin',
    address: 'Okhla Headworks Canal Feeder 2, South Delhi',
    location: {
      latitude: 28.5476,
      longitude: 77.3094,
      source: 'gps',
      verified: true,
      accuracy_meters: 12,
    },
    filter_clogged_percent: 64,
    filter_status: 'moderate',
    last_maintenance: '2026-10-18T11:00:00Z',
    updated_at: '2026-11-01T07:18:00Z',
  },
  {
    node_id: 'SJ-003',
    name: 'Haiderpur High-Rate Sand Filter Basin',
    zone: 'North-West Primary Treatment',
    address: 'Haiderpur Water Works Trunk Line A, Delhi',
    location: {
      latitude: 28.7291,
      longitude: 77.1472,
      source: 'manual',
      verified: true,
      accuracy_meters: 5,
    },
    filter_clogged_percent: 18,
    filter_status: 'optimal',
    last_maintenance: '2026-10-29T14:20:00Z',
    updated_at: '2026-11-01T07:10:00Z',
  },
  {
    node_id: 'SJ-004',
    name: 'Chandrawal Main Reservoir Distribution Terminal',
    zone: 'Central City Header',
    address: 'Chandrawal Water Works, Civil Lines, Central Delhi',
    location: {
      latitude: 28.6742,
      longitude: 77.2215,
      source: 'gps',
      verified: false,
      accuracy_meters: 15,
    },
    filter_clogged_percent: 82,
    filter_status: 'clogged',
    last_maintenance: '2026-10-09T09:15:00Z',
    updated_at: '2026-11-01T07:22:00Z',
  },
];

export const generateMockReadings = (nodeId: string = 'SJ-001', count: number = 40): TelemetryReading[] => {
  const readings: TelemetryReading[] = [];
  const now = Date.now();
  const intervalMs = 30 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * intervalMs);
    const phase: 'inlet' | 'outlet' = i % 2 === 0 ? 'outlet' : 'inlet';
    const isOutlet = phase === 'outlet';
    
    const sinOffset = Math.sin((count - i) * 0.28);
    const noise = (Math.random() - 0.5) * 0.12;
    
    const ph = Number((7.22 + sinOffset * 0.14 + noise).toFixed(2));
    const rawTurbidity = isOutlet 
      ? Number((5.45 + sinOffset * 0.55 + noise * 1.5).toFixed(2))
      : Number((9.20 + sinOffset * 0.75 + noise * 2.5).toFixed(2));
    
    const temp = Number((24.8 + Math.cos((count - i) * 0.22) * 0.7 + noise).toFixed(1));
    const mq5 = Math.round(1820 + sinOffset * 35 + (Math.random() - 0.5) * 20);
    
    const inletFlow = Number((2.42 + noise * 0.3).toFixed(2));
    const branchAFlow = Number((2.34 + noise * 0.25).toFixed(2));
    
    const runNumber = Math.floor((count - i) / 2) + 120;
    
    readings.push({
      _id: `rec-${nodeId}-${count - i}`,
      node_id: nodeId,
      event_id: `esp32-boot9-rdg${count - i}`,
      timestamp: time.toISOString(),
      active_branch: 'A',
      phase,
      run_id: `run-${runNumber}`,
      filter_clogged_percent: 28 + Math.round(sinOffset * 4),
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

export const MOCK_ABNORMALITIES: AlertItem[] = [
  {
    _id: 'abn-101',
    code: 'turbidity_excursion',
    category: 'measurement',
    severity: 'high',
    title: 'Outlet Turbidity Above 5.0 NTU Operating Limit',
    message: 'Outlet reading peaked at 5.82 NTU during raw inflow pulse. Recommended filter cycle backwash check.',
    node_id: 'SJ-001',
    run_id: 'run-128',
    phase: 'outlet',
    reading_id: 'rec-SJ-001-38',
    status: 'open',
    safety_assessment: false,
    created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    _id: 'abn-102',
    code: 'filter_clogged_warning',
    category: 'filter',
    severity: 'high',
    title: 'Filter Bed Resistance Spike (> 80% Clogged)',
    message: 'Differential hydraulic head loss detected on Chandrawal Primary Bed. Pressure ratio 1.84 bar.',
    node_id: 'SJ-004',
    run_id: 'run-94',
    phase: 'outlet',
    status: 'open',
    safety_assessment: false,
    created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
  {
    _id: 'abn-103',
    code: 'mq5_headspace_signal_high',
    category: 'environmental_sensor',
    severity: 'warning',
    title: 'MQ-5 Volatile Headspace Vapor Elevation',
    message: 'MQ-5 ADC sensor registered 1940 ADC in chamber headspace. Uncalibrated gas sensor above water level.',
    node_id: 'SJ-001',
    run_id: 'run-124',
    phase: 'inlet',
    reading_id: 'rec-SJ-001-31',
    status: 'acknowledged',
    safety_assessment: false,
    created_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
  },
  {
    _id: 'abn-104',
    code: 'branch_flow_drop',
    category: 'hardware',
    severity: 'warning',
    title: 'Active Branch Flow Rate Below Baseline (< 1.2 LPM)',
    message: 'Branch A flow dropped to 0.84 LPM while Inlet was 2.40 LPM. Valve A partial constriction cleared.',
    node_id: 'SJ-002',
    run_id: 'run-110',
    phase: 'inlet',
    status: 'resolved',
    safety_assessment: false,
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    _id: 'abn-105',
    code: 'ph_below_operating_range',
    category: 'measurement',
    severity: 'warning',
    title: 'pH Transient Dip Below 6.5 Minimum',
    message: 'Inlet pH dipped to 6.38 for 90 seconds following heavy upstream rainwater runoff.',
    node_id: 'SJ-003',
    run_id: 'run-88',
    phase: 'inlet',
    status: 'resolved',
    safety_assessment: false,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
];

export const MOCK_ARCHIVES: MonthlyArchive[] = [
  {
    month: '2026-10',
    count: 8640,
    first_timestamp: '2026-10-01T00:00:15Z',
    last_timestamp: '2026-10-31T23:59:45Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-10.csv',
    size_kb: 4210,
  },
  {
    month: '2026-09',
    count: 8420,
    first_timestamp: '2026-09-01T00:00:30Z',
    last_timestamp: '2026-09-30T23:58:10Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-09.csv',
    size_kb: 4095,
  },
  {
    month: '2026-08',
    count: 8190,
    first_timestamp: '2026-08-01T00:01:00Z',
    last_timestamp: '2026-08-31T23:55:00Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-08.csv',
    size_kb: 3980,
  },
  {
    month: '2026-07',
    count: 7950,
    first_timestamp: '2026-07-01T00:02:00Z',
    last_timestamp: '2026-07-31T23:54:00Z',
    download_url: '/api/v1/nodes/SJ-001/archives/2026-07.csv',
    size_kb: 3840,
  },
];

export const INITIAL_SYSTEM_LOGS: SystemLogEntry[] = [
  { id: '1', timestamp: '07:26:45', message: 'ESP32 TLS handshake complete on socket port 5001', type: 'success' },
  { id: '2', timestamp: '07:27:00', message: 'Telemetry packet esp32-boot9-rdg39 ingested (28B)', type: 'info' },
  { id: '3', timestamp: '07:27:15', message: 'Branch A valve state confirmed: OPEN (12V nominal)', type: 'info' },
  { id: '4', timestamp: '07:27:30', message: 'Pairing engine: assigned outlet phase to run-128', type: 'info' },
  { id: '5', timestamp: '07:27:45', message: 'Turbidity reduction calculated: -38.3% across Bed A', type: 'success' },
  { id: '6', timestamp: '07:28:00', message: 'Atlas database sync: 0.04s latency, 1 record committed', type: 'info' },
];

export interface Layer {
  id: string;
  name: string;
  group: 'Base Layers' | 'Radar' | 'Analysis' | 'Mission';
  visible: boolean;
  expanded: boolean;
  opacity: number; // 0 to 1
  legendType?: 'color-ramp' | 'single-color' | 'radar-intensity';
  legendColors?: string[]; // array of hex colors for ramp
  legendLabels?: string[]; // array of labels for ramp
  legendColor?: string; // single color hex
  description: string;
}

export interface Workspace {
  name: string;
  projectCreator: string;
  creationDate: string;
  projection: string;
  targetCrater: string;
  status: 'Idle' | 'Active Planning' | 'Simulation' | 'Locked';
  scale: string;
  zoom: number;
}

export type ViewMode = 'MAP' | 'RADAR' | '3D' | 'PROFILE';

export type ActiveTheme = 'Light Professional' | 'Retro-Futurist Glitch';

export interface LandingSite {
  id: number;
  name: string;
  rank: number;
  score: number;
  coords: { lat: number; lon: number };
  gx: number;
  gy: number;
  distanceToPSR: number; // in meters
  slope: number;
  hazardIndex: number;
  illumination: number;
  roughness: number;
  iceProbability: number;
  elevation: number;
  confidence: number;
  terrainType: string;
  recommendation: string;
}

export interface LandingAnalysisConstraints {
  slopeMax: number;
  hazardMax: number;
  iceMin: number;
  illumMin: number;
  psrRadiusMax: number; // in meters
}

export interface LandingAnalysisState {
  status: 'IDLE' | 'ANALYZING' | 'COMPLETED';
  progress: number;
  currentStep: string;
  constraints: LandingAnalysisConstraints;
  candidates: LandingSite[];
  selectedCandidateId: number | null;
  bestLandingSite: LandingSite | null;
}

export interface RoverWaypoint {
  id: string;
  name: string;
  coords: { lat: number; lon: number };
  gx: number;
  gy: number;
  distance: number; // cumulative in km
  elevation: number; // meters
  slope: number; // degrees
  arrivalTime: string; // HH:MM:SS
  batteryRemaining: number; // %
  hazardRating: number; // 0 to 1
}

export interface MissionTimelineEvent {
  id: string;
  name: string;
  time: string; // Elapsed time (e.g. "+00h 42m")
  battery: number; // %
  distance: number; // km
  description: string;
}

export interface TraverseAnalysisState {
  status: 'IDLE' | 'ANALYZING' | 'COMPLETED';
  progress: number;
  currentStep: string;
  algorithm: 'A*' | 'Dijkstra';
  mode: 'SHORTEST' | 'SAFEST' | 'ENERGY';
  selectedTargetName: string;
  runtimeMs: number;
  nodesExplored: number;
  pathCost: number;
  
  // Results
  path: { gx: number; gy: number }[];
  rejectedPaths: { gx: number; gy: number }[][];
  waypoints: RoverWaypoint[];
  timeline: MissionTimelineEvent[];
  
  // Metrics
  totalDistanceKm: number;
  estimatedDurationSeconds: number;
  avgSpeedKmh: number;
  maxSlopeDeg: number;
  batteryConsumptionPct: number;
  solarExposurePct: number;
  hazardExposureScore: number;
  successProbability: number;
}

export interface ResourceInspectedPoint {
  gx: number;
  gy: number;
  lat: number;
  lon: number;
  icePct: number;
  depth: number;
  volumeM3: number;
  confidencePct: number;
  dielectricClass: string;
  radarSignature: string;
  recommendation: string;
  accessibility: string;
}

export interface ResourceSamplingLocation {
  id: string;
  name: string;
  coords: { lat: number; lon: number };
  gx: number;
  gy: number;
  score: number;
  distance: number;
  icePct: number;
  safetyScore: number;
  confidencePct: number;
}

export interface ResourceSamplingPlanEvent {
  id: string;
  phase: string;
  activity: string;
  instrument: string;
  duration: string;
  status: string;
}

export interface ResourceAnalysisState {
  status: 'IDLE' | 'ANALYZING' | 'COMPLETED';
  progress: number;
  currentStep: string;
  estimatedDepth: number;
  estimatedIcePct: number;
  estimatedVolumeM3: number;
  estimatedWaterMassMt: number;
  confidencePct: number;
  accessibility: 'EASY' | 'MODERATE' | 'DIFFICULT';
  dielectricClass: string;
  radarSignature: string;
  top1mVolume: number;
  top2mVolume: number;
  top5mVolume: number;
  top10mVolume: number;
  inspectedPoint: ResourceInspectedPoint | null;
  topSamplingLocations: ResourceSamplingLocation[];
  samplingPlan: ResourceSamplingPlanEvent[];
  intelligence: {
    scienceScore: number;
    missionSuccessProb: number;
    resourcePotential: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCEPTIONAL';
    engineeringReadiness: 'LOW' | 'MODERATE' | 'HIGH' | 'FLIGHT_READY';
  };
}

export interface WorkstationState {
  workspace: Workspace;
  layers: Layer[];
  activeTab: string;
  viewMode: ViewMode;
  theme: ActiveTheme;
  cursorCoords: { lon: number; lat: number } | null;
  selectedLayerId: string | null;
  activeDialog: 'open_project' | 'save_project' | 'workspace_settings' | 'about' | 'theme' | null;
  recentProjects: string[];
  
  // Landing Analysis state
  landingAnalysis: LandingAnalysisState;
  
  // Traverse Analysis state
  traverseAnalysis: TraverseAnalysisState;

  // Resource Analysis state
  resourceAnalysis: ResourceAnalysisState;
  
  // Actions
  setWorkspaceValue: <K extends keyof Workspace>(key: K, value: Workspace[K]) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerExpanded: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  reorderLayer: (id: string, direction: 'up' | 'down') => void;
  setActiveTab: (tab: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: ActiveTheme) => void;
  setCursorCoords: (coords: { lon: number; lat: number } | null) => void;
  setSelectedLayerId: (id: string | null) => void;
  setActiveDialog: (dialog: 'open_project' | 'save_project' | 'workspace_settings' | 'about' | 'theme' | null) => void;
  loadProject: (projectName: string) => void;
  
  // Landing Actions
  setLandingConstraints: (constraints: Partial<LandingAnalysisConstraints>) => void;
  setLandingAnalysisState: (status: LandingAnalysisState['status'], progress: number, currentStep: string) => void;
  setLandingCandidates: (candidates: LandingSite[], best: LandingSite | null) => void;
  setSelectedCandidateId: (id: number | null) => void;

  // Traverse Actions
  setTraverseAlgorithm: (algo: 'A*' | 'Dijkstra') => void;
  setTraverseMode: (mode: 'SHORTEST' | 'SAFEST' | 'ENERGY') => void;
  setTraverseTarget: (targetName: string) => void;
  runTraverseAnalysis: () => void;
  setTraverseAnalysisValue: <K extends keyof TraverseAnalysisState>(key: K, value: TraverseAnalysisState[K]) => void;

  // Resource Actions
  runResourceAnalysis: () => void;
  setResourceAnalysisValue: <K extends keyof ResourceAnalysisState>(key: K, value: ResourceAnalysisState[K]) => void;
  setInspectedPoint: (point: ResourceInspectedPoint | null) => void;
  setInspectedPointByCoords: (gx: number, gy: number) => void;
}

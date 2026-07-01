import { create } from 'zustand';
import { WorkstationState, Layer, Workspace, ViewMode, ActiveTheme } from '../types';
import { computeRoverTraverse, generateTraverseDetails } from '../utils/traversePathfinder';
import { 
  getIceProbability, 
  getElevationAt, 
  getSlopeAt, 
  getRoughnessAt, 
  getNormalizedCPR, 
  getNormalizedDOP, 
  getRadarConfidence,
  mapCoordsToLunar
} from '../utils/lunarGenerator';

const INITIAL_LAYERS: Layer[] = [
  // Mission Layers
  {
    id: 'labels',
    name: 'Planetary Feature Labels',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 1.0,
    legendType: 'single-color',
    legendColor: '#a855f7', // Purple
    description: 'Cartographic names for major lunar landforms, craters, and designated operation areas.'
  },
  {
    id: 'target-crater',
    name: 'Target Crater (Shackleton-9)',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 1.0,
    legendType: 'single-color',
    legendColor: '#f43f5e', // Rose 500
    description: 'Targeted mission operation boundary centered at Shackleton Crater rim, South Pole.'
  },
  {
    id: 'waypoints',
    name: 'Pragyan Rover Waypoints',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 1.0,
    legendType: 'single-color',
    legendColor: '#06b6d4', // Cyan 500
    description: 'Pre-calculated mission milestones and scientific collection sites.'
  },
  {
    id: 'traverse',
    name: 'Planned Traverse Path',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 1.0,
    legendType: 'single-color',
    legendColor: '#eab308', // Yellow
    description: 'Active Yellow Engineering Rover Path animated routing.'
  },
  {
    id: 'rejected-routes',
    name: 'Rejected Path Candidates',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 0.4,
    legendType: 'single-color',
    legendColor: '#f87171', // Red-400
    description: 'Alternative sub-optimal paths discarded by the autonomous rover search engine.'
  },
  {
    id: 'mission-timeline',
    name: 'Mobility Phase Markers',
    group: 'Mission',
    visible: true,
    expanded: false,
    opacity: 1.0,
    legendType: 'single-color',
    legendColor: '#a855f7', // Purple
    description: 'Critical traverse milestones, sampling sites, and return coordinate markings.'
  },
  // Analysis Layers
  {
    id: 'cost-surface',
    name: 'Traversability Cost Surface',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#22c55e', '#eab308', '#ef4444'], // green, yellow, red
    legendLabels: ['0.0 (Easy)', '0.5 (Moderate)', '1.0 (Severe)'],
    description: 'Dynamic cost grid combining slope (35%), hazards (25%), roughness (15%), illumination (15%), and distance penalties (10%).'
  },
  {
    id: 'landing-zones',
    name: 'Lander Safety Envelope (LSE-1)',
    group: 'Analysis',
    visible: true,
    expanded: false,
    opacity: 0.6,
    legendType: 'single-color',
    legendColor: '#10b981', // Emerald 500
    description: 'Candidate lunar landing ellipsoids with slope < 5 degrees and clear line of sight.'
  },
  {
    id: 'hazards',
    name: 'Slope & Boulder Hazards (>15°)',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.7,
    legendType: 'single-color',
    legendColor: '#ef4444', // Red 500
    description: 'Slopes exceeding safe lander/rover tolerances (diagonal red engineering hatch).'
  },
  {
    id: 'ice-prob',
    name: 'H2O Volatiles Probability Index',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.8,
    legendType: 'color-ramp',
    legendColors: ['#0284c7', '#38bdf8', '#bae6fd'], // deep blue to light blue
    legendLabels: ['0.0 (Dry)', '0.5 (Sub-surface)', '1.0 (Exposure)'],
    description: 'Water-ice exposure likelihood glowing blue only inside permanently shadowed cold traps.'
  },
  {
    id: 'illumination',
    name: 'Direct Sun Illumination Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#1e293b', '#fef08a'], // Dark to bright yellow
    legendLabels: ['Shadow', 'Illuminated'],
    description: 'Binary sunlight/shadow coverage calculated dynamically from Dem and active sun azimuth.'
  },
  {
    id: 'slope-map',
    name: 'Planetary Slope Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#22c55e', '#eab308', '#ef4444'], // green, yellow, red
    legendLabels: ['0° (Optimal)', '10°', '30°+ (Severe)'],
    description: 'Detailed planetary surface gradient slope map computed dynamically on-the-fly.'
  },
  {
    id: 'aspect-map',
    name: 'Planetary Aspect Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'],
    legendLabels: ['North (0°)', 'East (90°)', 'South (180°)', 'West (270°)', 'North (360°)'],
    description: 'Calculated planetary surface slope direction in degrees (0° to 360°).'
  },
  {
    id: 'curvature-map',
    name: 'Planetary Curvature Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#3b82f6', '#f3f4f6', '#ef4444'],
    legendLabels: ['Concave (-)', 'Flat (0)', 'Convex (+)'],
    description: 'Calculated rate of change of slope, highlighting crater rims, ridges, and valleys.'
  },
  {
    id: 'roughness-map',
    name: 'Planetary Surface Roughness Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#15803d', '#eab308', '#b91c1c'],
    legendLabels: ['Smooth (0m)', 'Moderate (5m)', 'Rough (15m+)'],
    description: 'Standard deviation of local elevations signifying boulder densities and micro-relief.'
  },
  {
    id: 'relief-map',
    name: 'Planetary Local Relief Map',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#1e1b4b', '#4338ca', '#f43f5e'],
    legendLabels: ['Low Relief (0m)', 'Medium', 'High Relief (100m+)'],
    description: 'Elevation range difference (Max - Min) computed over a local terrain cell.'
  },
  {
    id: 'hazard-heatmap',
    name: 'Multi-Criteria Hazard Heatmap',
    group: 'Analysis',
    visible: false,
    expanded: false,
    opacity: 0.7,
    legendType: 'color-ramp',
    legendColors: ['#22c55e', '#eab308', '#ef4444'],
    legendLabels: ['Safe (0.0)', 'Moderate (0.35)', 'Unsafe (1.0)'],
    description: 'Combined risk heatmap incorporating steep slopes, high curvature, roughness, and poor illumination.'
  },
  // Radar Layers
  {
    id: 'radar-composite',
    name: 'DFSAR Radar RGB Composite',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 0.8,
    legendType: 'color-ramp',
    legendColors: ['#ef4444', '#22c55e', '#3b82f6'],
    legendLabels: ['R: Backscatter', 'G: CPR', 'B: DOP'],
    description: 'Multi-band polarimetric composite showing Backscatter (Red), CPR (Green), and DOP (Blue).'
  },
  {
    id: 'radar-incidence',
    name: 'DFSAR Radar Incidence Angle',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 0.6,
    legendType: 'color-ramp',
    legendColors: ['#1e1b4b', '#4338ca', '#818cf8'],
    legendLabels: ['20° (Near Nadir)', '40°', '60° (Far-Range)'],
    description: 'Local incidence angle calculated relative to lunar ellipsoid topography.'
  },
  {
    id: 'radar-confidence',
    name: 'DFSAR Radar Confidence Layer',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 0.7,
    legendType: 'color-ramp',
    legendColors: ['#7f1d1d', '#b45309', '#15803d'],
    legendLabels: ['Poor (Noise)', 'Adequate', 'High Quality'],
    description: 'Confidence map reflecting signal-to-noise ratio, shadow masking, and speckle metrics.'
  },
  {
    id: 'dop',
    name: 'DFSAR Degree of Polarization (DOP)',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 0.7,
    legendType: 'radar-intensity',
    description: 'Chandrayaan-2 DFSAR L-band degree of polarization signifying surface scattering traits.'
  },
  {
    id: 'cpr',
    name: 'Circular Polarization Ratio (CPR)',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 0.7,
    legendType: 'color-ramp',
    legendColors: ['#4a044e', '#c084fc', '#fdf4ff'], // purple gradient
    legendLabels: ['Low (Roughness)', 'Medium', 'High (Ice/Scatter)'],
    description: 'Dual-frequency synthetic aperture radar CPR. High values inside PSRs indicate possible water-ice.'
  },
  {
    id: 'dfsar-backscatter',
    name: 'DFSAR L-band SAR backscatter',
    group: 'Radar',
    visible: false,
    expanded: false,
    opacity: 1.0,
    legendType: 'radar-intensity',
    description: 'High-resolution radar imaging of permanently shadowed regions (PSRs) at 2m resolution.'
  },
  // Base Layers
  {
    id: 'contours',
    name: 'Elevation Contours',
    group: 'Base Layers',
    visible: false,
    expanded: false,
    opacity: 0.8,
    legendType: 'single-color',
    legendColor: '#64748b',
    description: 'Thin cartographic contour isolines generated from LOLA DEM at 500m intervals.'
  },
  {
    id: 'lola-hillshade',
    name: 'LOLA Slope Hillshade Map',
    group: 'Base Layers',
    visible: true,
    expanded: false,
    opacity: 0.5,
    legendType: 'color-ramp',
    legendColors: ['#000000', '#808080', '#ffffff'],
    legendLabels: ['Shadow', 'Midtone', 'Sunlit'],
    description: 'Dynamic hillshade simulation calculated from DEM with active lighting controls.'
  },
  {
    id: 'terrain-elevation',
    name: 'LOLA Digital Elevation Model (DEM)',
    group: 'Base Layers',
    visible: false,
    expanded: false,
    opacity: 0.8,
    legendType: 'color-ramp',
    legendColors: ['#111827', '#6b7280', '#f3f4f6'], // dark to light grayscale
    legendLabels: ['-6500 m (Basins)', '0 m', '+4200 m (Peaks)'],
    description: 'Topographic elevation model from Lunar Reconnaissance Orbiter LOLA instrument.'
  },
  {
    id: 'ohrc-imagery',
    name: 'Chandrayaan-2 OHRC High-Res Imagery',
    group: 'Base Layers',
    visible: true,
    expanded: false,
    opacity: 0.9,
    legendType: 'radar-intensity',
    description: 'Orthorectified high-resolution orbiter camera base raster stream.'
  }
];

const INITIAL_WORKSPACE: Workspace = {
  name: 'Chandrayaan-3 SAC Polar Region Workspace Alpha',
  projectCreator: 'Scientist-In-Charge, SAC, ISRO',
  creationDate: '2026-07-01 05:01:00 UTC',
  projection: 'Lunar South Pole Polar Stereographic (EPSG:30112)',
  targetCrater: 'Shackleton Crater Rim (-89.9° S, 0.0° E)',
  status: 'Active Planning',
  scale: '1 : 25,000',
  zoom: 8
};

export const useWorkstationStore = create<WorkstationState>((set, get) => ({
  workspace: INITIAL_WORKSPACE,
  layers: INITIAL_LAYERS,
  activeTab: 'Mission',
  viewMode: 'MAP',
  theme: 'Light Professional',
  cursorCoords: null,
  selectedLayerId: 'ohrc-imagery',
  activeDialog: null,
  recentProjects: [
    'Chandrayaan-3 SAC Polar Region Workspace Alpha',
    'Manzinus Crater Traverse Feasibility Study',
    'Shoemaker PSR Dual-SAR Ice Exploration Plan',
    'Nobile Basin Landing Zone Survey LSE-4'
  ],

  // Landing Analysis initial state
  landingAnalysis: {
    status: 'IDLE',
    progress: 0,
    currentStep: '',
    constraints: {
      slopeMax: 10,
      hazardMax: 0.35,
      iceMin: 0.45,
      illumMin: 35,
      psrRadiusMax: 2000
    },
    candidates: [],
    selectedCandidateId: null,
    bestLandingSite: null
  },

  // Traverse Analysis initial state
  traverseAnalysis: {
    status: 'IDLE',
    progress: 0,
    currentStep: '',
    algorithm: 'A*',
    mode: 'SAFEST',
    selectedTargetName: 'Shackleton Crater Rim',
    runtimeMs: 0,
    nodesExplored: 0,
    pathCost: 0,
    path: [],
    rejectedPaths: [],
    waypoints: [],
    timeline: [],
    totalDistanceKm: 0,
    estimatedDurationSeconds: 0,
    avgSpeedKmh: 0,
    maxSlopeDeg: 0,
    batteryConsumptionPct: 0,
    solarExposurePct: 0,
    hazardExposureScore: 0,
    successProbability: 0
  },

  // Resource Analysis initial state
  resourceAnalysis: {
    status: 'IDLE',
    progress: 0,
    currentStep: '',
    estimatedDepth: 2.0,
    estimatedIcePct: 0,
    estimatedVolumeM3: 0,
    estimatedWaterMassMt: 0,
    confidencePct: 0,
    accessibility: 'EASY',
    dielectricClass: 'Class IV (Dry Basaltic Anhydrous Regolith)',
    radarSignature: 'No evaluation',
    top1mVolume: 0,
    top2mVolume: 0,
    top5mVolume: 0,
    top10mVolume: 0,
    inspectedPoint: null,
    topSamplingLocations: [],
    samplingPlan: [],
    intelligence: {
      scienceScore: 0,
      missionSuccessProb: 0,
      resourcePotential: 'LOW',
      engineeringReadiness: 'LOW'
    }
  },

  setWorkspaceValue: (key, value) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        [key]: value
      }
    }));
  },

  toggleLayerVisibility: (id) => {
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      )
    }));
  },

  toggleLayerExpanded: (id) => {
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, expanded: !layer.expanded } : layer
      )
    }));
  },

  setLayerOpacity: (id, opacity) => {
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) } : layer
      )
    }));
  },

  reorderLayer: (id, direction) => {
    const { layers } = get();
    const index = layers.findIndex((l) => l.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= layers.length) return;

    // Create copy and swap
    const updatedLayers = [...layers];
    const temp = updatedLayers[index];
    updatedLayers[index] = updatedLayers[newIndex];
    updatedLayers[newIndex] = temp;

    set({ layers: updatedLayers });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setTheme: (theme) => {
    set({ theme });
  },

  setCursorCoords: (coords) => {
    set({ cursorCoords: coords });
  },

  setSelectedLayerId: (id) => {
    set({ selectedLayerId: id });
  },

  setActiveDialog: (dialog) => {
    set({ activeDialog: dialog });
  },

  loadProject: (projectName) => {
    // Dynamically adjust parameters based on selection to simulate real file loading
    let projection = 'Lunar South Pole Polar Stereographic (EPSG:30112)';
    let targetCrater = 'Shackleton Crater Rim (-89.9° S, 0.0° E)';
    let status: Workspace['status'] = 'Active Planning';

    if (projectName.includes('Manzinus')) {
      projection = 'Lunar Equidistant Cylindrical (EPSG:30111)';
      targetCrater = 'Manzinus Crater Floor (-67.5° S, 26.3° E)';
      status = 'Simulation';
    } else if (projectName.includes('Shoemaker')) {
      projection = 'Lunar Polar Stereographic (EPSG:30112)';
      targetCrater = 'Shoemaker PSR (-88.1° S, 120.7° E)';
      status = 'Idle';
    } else if (projectName.includes('Nobile')) {
      projection = 'Lunar Polar Stereographic (EPSG:30112)';
      targetCrater = 'Nobile Rim Basin LSE-4 (-85.3° S, 53.5° E)';
      status = 'Locked';
    }

    set({
      workspace: {
        name: projectName,
        projectCreator: 'Scientist-In-Charge, SAC, ISRO',
        creationDate: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        projection,
        targetCrater,
        status,
        scale: '1 : 50,000',
        zoom: 7
      },
      activeDialog: null
    });
  },

  setLandingConstraints: (constraints) => {
    set((state) => ({
      landingAnalysis: {
        ...state.landingAnalysis,
        constraints: {
          ...state.landingAnalysis.constraints,
          ...constraints
        }
      }
    }));
  },

  setLandingAnalysisState: (status, progress, currentStep) => {
    set((state) => ({
      landingAnalysis: {
        ...state.landingAnalysis,
        status,
        progress,
        currentStep
      }
    }));
  },

  setLandingCandidates: (candidates, best) => {
    set((state) => ({
      landingAnalysis: {
        ...state.landingAnalysis,
        candidates,
        bestLandingSite: best,
        selectedCandidateId: best ? best.id : null
      }
    }));
  },

  setSelectedCandidateId: (id) => {
    set((state) => ({
      landingAnalysis: {
        ...state.landingAnalysis,
        selectedCandidateId: id
      }
    }));
  },

  setTraverseAlgorithm: (algo) => {
    set((state) => ({
      traverseAnalysis: {
        ...state.traverseAnalysis,
        algorithm: algo
      }
    }));
  },

  setTraverseMode: (mode) => {
    set((state) => ({
      traverseAnalysis: {
        ...state.traverseAnalysis,
        mode
      }
    }));
  },

  setTraverseTarget: (targetName) => {
    set((state) => ({
      traverseAnalysis: {
        ...state.traverseAnalysis,
        selectedTargetName: targetName
      }
    }));
  },

  setTraverseAnalysisValue: (key, value) => {
    set((state) => ({
      traverseAnalysis: {
        ...state.traverseAnalysis,
        [key]: value
      }
    }));
  },

  runTraverseAnalysis: () => {
    const store = get();
    
    // Clear previous traverse graphics immediately to avoid artifacts on screen
    (window as any).lunarRoverPathCleared = true;
    (window as any).lunarRoverPath = [];
    (window as any).lunarRoverWaypoints = [];
    (window as any).lunarRoverRejectedPaths = [];
    window.dispatchEvent(new Event('lunar-map-refresh'));

    set((state) => ({
      traverseAnalysis: {
        ...state.traverseAnalysis,
        status: 'ANALYZING',
        progress: 0,
        currentStep: 'Initializing Pragyan Pathfinding Engine...',
        path: [],
        waypoints: [],
        timeline: []
      }
    }));

    const activeCand = store.landingAnalysis.candidates.find(c => c.id === store.landingAnalysis.selectedCandidateId) 
                     || store.landingAnalysis.bestLandingSite;
    const startGx = activeCand ? activeCand.gx : 0.502136;
    const startGy = activeCand ? activeCand.gy : 0.501525;

    const targetName = store.traverseAnalysis.selectedTargetName;
    let endGx = 0.5000;
    let endGy = 0.5000;
    if (targetName === 'Shoemaker Basin') {
      endGx = 0.5060;
      endGy = 0.4930;
    } else if (targetName === 'Nobile Mount') {
      endGx = 0.4930;
      endGy = 0.5080;
    } else if (targetName === 'Faustini Valle') {
      endGx = 0.5090;
      endGy = 0.5050;
    }

    const algo = store.traverseAnalysis.algorithm;
    const mode = store.traverseAnalysis.mode;

    const pathResults = computeRoverTraverse(startGx, startGy, endGx, endGy, algo, mode);
    const detailResults = generateTraverseDetails(pathResults.path, mode);

    const logEvent = (msg: string) => {
      window.dispatchEvent(new CustomEvent('lunar-log', {
        detail: { msg, source: 'ROVER' }
      }));
    };

    setTimeout(() => {
      logEvent(`[INFO] Building Traversability Cost Surface...`);
      set((state) => ({
        traverseAnalysis: { ...state.traverseAnalysis, progress: 20, currentStep: 'Building Cost Surface...' }
      }));

      setTimeout(() => {
        logEvent(`[INFO] Running ${algo} Search Algorithm...`);
        set((state) => ({
          traverseAnalysis: { ...state.traverseAnalysis, progress: 50, currentStep: `Running ${algo}...` }
        }));

        setTimeout(() => {
          logEvent(`[INFO] ${pathResults.nodesExplored.toLocaleString()} Nodes Explored`);
          logEvent(`[INFO] Optimizing Energy Model...`);
          set((state) => ({
            traverseAnalysis: { ...state.traverseAnalysis, progress: 75, currentStep: 'Optimizing Energy...' }
          }));

          setTimeout(() => {
            logEvent(`[INFO] Generating Waypoints...`);
            set((state) => ({
              traverseAnalysis: { ...state.traverseAnalysis, progress: 90, currentStep: 'Generating Waypoints...' }
            }));

            setTimeout(() => {
              logEvent(`[INFO] Estimated Distance: ${detailResults.metrics.totalDistanceKm.toFixed(2)} km`);
              const hours = Math.floor(detailResults.metrics.estimatedDurationSeconds / 3600);
              const mins = Math.floor((detailResults.metrics.estimatedDurationSeconds % 3600) / 60);
              const secs = Math.floor(detailResults.metrics.estimatedDurationSeconds % 60);
              logEvent(`[INFO] Estimated Mission Time: ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
              logEvent(`[INFO] Mission Route Complete`);
              
              (window as any).lunarRoverPathCleared = false;
              (window as any).lunarRoverPath = pathResults.path;
              (window as any).lunarRoverWaypoints = detailResults.waypoints;
              (window as any).lunarRoverRejectedPaths = pathResults.rejectedPaths;
              (window as any).traversePlanningMode = mode;
              
              window.dispatchEvent(new Event('lunar-map-refresh'));

              set((state) => ({
                traverseAnalysis: {
                  ...state.traverseAnalysis,
                  status: 'COMPLETED',
                  progress: 100,
                  currentStep: 'Mission Route Complete.',
                  runtimeMs: pathResults.runtimeMs,
                  nodesExplored: pathResults.nodesExplored,
                  pathCost: pathResults.pathCost,
                  path: pathResults.path,
                  rejectedPaths: pathResults.rejectedPaths,
                  waypoints: detailResults.waypoints,
                  timeline: detailResults.timeline,
                  totalDistanceKm: detailResults.metrics.totalDistanceKm,
                  estimatedDurationSeconds: detailResults.metrics.estimatedDurationSeconds,
                  avgSpeedKmh: detailResults.metrics.avgSpeedKmh,
                  maxSlopeDeg: detailResults.metrics.maxSlopeDeg,
                  batteryConsumptionPct: detailResults.metrics.batteryConsumptionPct,
                  solarExposurePct: detailResults.metrics.solarExposurePct,
                  hazardExposureScore: detailResults.metrics.hazardExposureScore,
                  successProbability: detailResults.metrics.successProbability
                }
              }));
            }, 400);
          }, 350);
        }, 400);
      }, 400);
    }, 300);
  },

  setResourceAnalysisValue: (key, value) => {
    set((state) => ({
      resourceAnalysis: {
        ...state.resourceAnalysis,
        [key]: value
      }
    }));
  },

  setInspectedPoint: (point) => {
    set((state) => ({
      resourceAnalysis: {
        ...state.resourceAnalysis,
        inspectedPoint: point
      }
    }));
  },

  setInspectedPointByCoords: (gx: number, gy: number) => {
    const latLon = mapCoordsToLunar((gx - 0.5) * 40075016, (0.5 - gy) * 40075016);
    const iceProb = getIceProbability(gx, gy);
    const slope = getSlopeAt(gx, gy, 8);
    const roughness = getRoughnessAt(gx, gy, 8);
    const cpr = getNormalizedCPR(gx, gy);
    const dop = getNormalizedDOP(gx, gy);
    const radarConf = getRadarConfidence(gx, gy);

    const icePct = Math.max(0.0, Math.min(100.0, (iceProb * 0.7 + cpr * 0.3) * 100));
    const depth = Math.max(0.2, Math.min(5.0, 0.5 + (iceProb * 3.0) + (cpr * 1.5)));
    const pixelArea = 250.0; // m^2
    const confidencePct = Math.max(50.0, Math.min(99.0, radarConf * 100));
    const volumeM3 = (icePct / 100) * pixelArea * depth * (confidencePct / 100);

    let dielectricClass = 'Class IV (Dry Basaltic Anhydrous Regolith)';
    if (cpr > 0.5 && dop < 0.45) {
      dielectricClass = 'Class I (High-Purity Subsurface Volatile Glacial)';
    } else if (cpr > 0.35 && dop < 0.6) {
      dielectricClass = 'Class II (Coherent Ice-Regolith Sintered Mixture)';
    } else if (cpr > 0.18) {
      dielectricClass = 'Class III (Disseminated Pore-Filling Capillary Volatiles)';
    }

    const radarSignature = `CPR: ${cpr.toFixed(3)} | DOP: ${dop.toFixed(3)} | Backscatter: ${(cpr * -11 - 6).toFixed(1)} dB`;

    let accessibility = 'EASY';
    if (slope > 14.0 || roughness > 0.14) {
      accessibility = 'DIFFICULT';
    } else if (slope > 7.0 || roughness > 0.07) {
      accessibility = 'MODERATE';
    }

    let recommendation = 'Low confidence resource signature. Avoid core drilling.';
    if (icePct > 40 && slope < 9 && confidencePct > 80) {
      recommendation = 'Excellent radar signature. High confidence ice. Safe slope. Highly suitable for robotic core drilling.';
    } else if (icePct > 20 && slope < 14 && confidencePct > 70) {
      recommendation = 'Moderate ice signatures detected. Suitable for GPR survey and APXS spectrometer scans.';
    } else if (icePct > 15 && slope >= 14) {
      recommendation = 'Subsurface volatiles likely present, but high slope risk makes robotic extraction difficult.';
    }

    set((state) => ({
      resourceAnalysis: {
        ...state.resourceAnalysis,
        inspectedPoint: {
          gx,
          gy,
          lat: latLon.lat,
          lon: latLon.lon,
          icePct,
          depth,
          volumeM3,
          confidencePct,
          dielectricClass,
          radarSignature,
          recommendation,
          accessibility
        }
      }
    }));

    // Trigger log
    window.dispatchEvent(new CustomEvent('lunar-log', {
      detail: {
        msg: `Resource Inspector: Lat ${latLon.lat.toFixed(6)}°S, Lon ${latLon.lon.toFixed(6)}°E | Subsurface H2O: ${icePct.toFixed(1)}% | Depth: ${depth.toFixed(2)}m | Vol: ${volumeM3.toFixed(1)} m³ | Conf: ${confidencePct.toFixed(1)}%`,
        source: 'TELEMETRY'
      }
    }));
  },

  runResourceAnalysis: () => {
    const logEvent = (msg: string) => {
      window.dispatchEvent(new CustomEvent('lunar-log', { detail: { msg, source: 'ALGO' } }));
    };

    logEvent(`Initiating Water Ice Volatiles & Geotechnical Resource Assessment workflow...`);
    set((state) => ({
      resourceAnalysis: {
        ...state.resourceAnalysis,
        status: 'ANALYZING',
        progress: 0,
        currentStep: 'Initializing SAC Multi-Channel Volatiles Engine...',
        inspectedPoint: null
      }
    }));

    setTimeout(() => {
      logEvent(`Sampling Radar Layers...`);
      set((state) => ({
        resourceAnalysis: {
          ...state.resourceAnalysis,
          progress: 20,
          currentStep: '██░░░░░░░░ Ingesting DFSAR L-Band & S-Band CPR/DOP grids...'
        }
      }));

      setTimeout(() => {
        logEvent(`Estimating Dielectric Constant...`);
        set((state) => ({
          resourceAnalysis: {
            ...state.resourceAnalysis,
            progress: 45,
            currentStep: '████░░░░░░ Computing subsurface dielectric properties...'
          }
        }));

        setTimeout(() => {
          logEvent(`Computing Ice Volume...`);
          set((state) => ({
            resourceAnalysis: {
              ...state.resourceAnalysis,
              progress: 65,
              currentStep: '██████░░░░ Integrating Ice Probability with LOLA DEM slope/roughness...'
            }
          }));

          setTimeout(() => {
            logEvent(`Building Resource Map...`);
            set((state) => ({
              resourceAnalysis: {
                ...state.resourceAnalysis,
                progress: 85,
                currentStep: '████████░░ Generating resource concentration classification layers...'
              }
            }));

            setTimeout(() => {
              logEvent(`Generating Mission Intelligence...`);
              set((state) => ({
                resourceAnalysis: {
                  ...state.resourceAnalysis,
                  progress: 95,
                  currentStep: '██████████ Mapping optimal scientific drilling sites...'
                }
              }));

              setTimeout(() => {
                logEvent(`Mission Intelligence Ready.`);
                
                const topSamplingLocations = [
                  { id: 'SMP-01', name: 'Shackleton-PSR Alpha', coords: { lat: 89.9213, lon: 112.5021 }, gx: 0.5021, gy: 0.5015, score: 94.2, distance: 1.2, icePct: 42.5, safetyScore: 88.0, confidencePct: 91.0 },
                  { id: 'SMP-02', name: 'Shoemaker Rim-B', coords: { lat: 88.1028, lon: 120.7011 }, gx: 0.5028, gy: 0.5011, score: 89.5, distance: 3.4, icePct: 38.2, safetyScore: 92.0, confidencePct: 87.0 },
                  { id: 'SMP-03', name: 'Faustini Valley Ridge', coords: { lat: 85.3005, lon: 53.5024 }, gx: 0.5005, gy: 0.5024, score: 86.1, distance: 4.8, icePct: 34.1, safetyScore: 85.0, confidencePct: 89.0 },
                  { id: 'SMP-04', name: 'Nobile Crater Slope-South', coords: { lat: 85.3123, lon: 53.5123 }, gx: 0.4991, gy: 0.4988, score: 81.4, distance: 6.1, icePct: 31.8, safetyScore: 78.0, confidencePct: 84.0 },
                  { id: 'SMP-05', name: 'Shackleton Ridge-C', coords: { lat: 89.9118, lon: 112.4995 }, gx: 0.5018, gy: 0.4995, score: 78.9, distance: 1.8, icePct: 29.5, safetyScore: 82.0, confidencePct: 81.0 },
                  { id: 'SMP-06', name: 'De Gerlache Basin', coords: { lat: 88.5124, lon: -87.1245 }, gx: 0.4980, gy: 0.5032, score: 75.3, distance: 8.5, icePct: 27.2, safetyScore: 71.0, confidencePct: 85.0 },
                  { id: 'SMP-07', name: 'Haworth Rim North', coords: { lat: 87.5412, lon: -5.1241 }, gx: 0.5042, gy: 0.4975, score: 72.8, distance: 11.2, icePct: 25.4, safetyScore: 88.0, confidencePct: 79.0 },
                  { id: 'SMP-08', name: 'Cabeus Ice Deposit Alpha', coords: { lat: 84.9565, lon: -35.5021 }, gx: 0.4965, gy: 0.5050, score: 69.1, distance: 15.6, icePct: 22.9, safetyScore: 65.0, confidencePct: 82.0 },
                  { id: 'SMP-09', name: 'Amundsen Uplands', coords: { lat: 84.5065, lon: 104.5065 }, gx: 0.5065, gy: 0.4950, score: 65.5, distance: 22.1, icePct: 19.8, safetyScore: 90.0, confidencePct: 74.0 },
                  { id: 'SMP-10', name: 'Scott Rim Valley', coords: { lat: 82.3545, lon: 48.5075 }, gx: 0.4945, gy: 0.5075, score: 61.2, distance: 28.4, icePct: 17.5, safetyScore: 58.0, confidencePct: 70.0 }
                ];

                const samplingPlan = [
                  { id: 'EVT-01', phase: 'PHASE-I (00h-04h)', activity: 'Ground Penetrating Radar Profile Scan', instrument: 'PRAGYAN GPR', duration: '4.0 hrs', status: 'COMPLETE' },
                  { id: 'EVT-02', phase: 'PHASE-II (04h-08h)', activity: 'Laser-Induced Breakdown Spectroscopy (LIBS)', instrument: 'PRAGYAN LIBS', duration: '4.0 hrs', status: 'COMPLETE' },
                  { id: 'EVT-03', phase: 'PHASE-III (08h-16h)', activity: 'Alpha Particle X-Ray Spectrometer (APXS)', instrument: 'PRAGYAN APXS', duration: '8.0 hrs', status: 'COMPLETE' },
                  { id: 'EVT-04', phase: 'PHASE-IV (16h-24h)', activity: 'Direct Subsurface Robotic Core Drilling (1.5m)', instrument: 'Robotic Core Drill', duration: '8.0 hrs', status: 'IN_PROGRESS' },
                  { id: 'EVT-05', phase: 'PHASE-V (24h-36h)', activity: 'Volatile Extraction and Return Sample Containment', instrument: 'Sample Return Module', duration: '12.0 hrs', status: 'PENDING' }
                ];

                // Set window variables for resource map visualization in GISWorkspace
                (window as any).lunarSamplingLocations = topSamplingLocations;
                (window as any).lunarResourceAssessmentCompleted = true;
                window.dispatchEvent(new Event('lunar-map-refresh'));

                set((state) => ({
                  resourceAnalysis: {
                    ...state.resourceAnalysis,
                    status: 'COMPLETED',
                    progress: 100,
                    currentStep: 'Resource Assessment complete.',
                    estimatedDepth: 1.85,
                    estimatedIcePct: 24.8,
                    estimatedVolumeM3: 1842500,
                    estimatedWaterMassMt: 1.69,
                    confidencePct: 88.5,
                    accessibility: 'MODERATE',
                    dielectricClass: 'Class II (Ice-Regolith Coherent Mixture)',
                    radarSignature: 'High CPR (0.64), Low DOP (0.35), Backscatter coefficient -7.8 dB',
                    top1mVolume: 921250,
                    top2mVolume: 1842500,
                    top5mVolume: 4606250,
                    top10mVolume: 9212500,
                    topSamplingLocations,
                    samplingPlan,
                    intelligence: {
                      scienceScore: 91,
                      missionSuccessProb: 87,
                      resourcePotential: 'EXCEPTIONAL',
                      engineeringReadiness: 'FLIGHT_READY'
                    }
                  }
                }));

                logEvent(`Assessment Complete! Total Estimated Subsurface H2O Volume: 1.84M m³. Science Score: 91. Flight Readiness: FLIGHT_READY.`);
              }, 400);
            }, 450);
          }, 500);
        }, 500);
      }, 500);
    }, 400);
  }
}));

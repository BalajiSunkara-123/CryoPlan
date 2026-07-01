/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { ViewMode } from '../../types';
import { 
  drawLunarTile, 
  mapCoordsToLunar, 
  getElevationAt, 
  getSlopeAt, 
  hash2D,
  getNormalizedBackscatter,
  getNormalizedCPR,
  getNormalizedDOP,
  getRadarIncidenceAngle,
  getRadarConfidence,
  getIceProbability
} from '../../utils/lunarGenerator';
import { Map as OLMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { Zoom, ScaleLine } from 'ol/control';
import { Vector as OLVectorLayer } from 'ol/layer';
import { Vector as OLVectorSource } from 'ol/source';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { Style, Stroke } from 'ol/style';
import 'ol/ol.css';
import { 
  Compass, 
  BarChart2, 
  Globe, 
  Radio, 
  Sliders, 
  Maximize2, 
  Pencil, 
  Activity, 
  Terminal, 
  ChevronUp, 
  ChevronDown, 
  Volume2, 
  Layers, 
  ChevronRight,
  Database
} from 'lucide-react';

export const GISWorkspace: React.FC = () => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OLMap | null>(null);
  const olLayersRef = useRef<{ [key: string]: TileLayer }>({});
  const drawVectorSourceRef = useRef<OLVectorSource | null>(null);

  const {
    viewMode,
    setViewMode,
    layers,
    theme,
    cursorCoords,
    setCursorCoords,
    selectedLayerId,
    workspace,
    setWorkspaceValue
  } = useWorkstationStore();

  const isGlitch = theme === 'Retro-Futurist Glitch';

  // State for Console Logs
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SYSTEM] Booting CryoPlan GIS Engine v4.8...`,
    `[${new Date().toLocaleTimeString()}] [HARDWARE] GPS-Receiver: LUNAR_SOUTH_POLE_S9 locked.`,
    `[${new Date().toLocaleTimeString()}] [IO] LOLA Lunar DEM Topography mounted (0.5m native).`,
    `[${new Date().toLocaleTimeString()}] [IO] Chandrayaan-2 OHRC high-res raster stream online.`,
    `[${new Date().toLocaleTimeString()}] [SAR] DFSAR Backscatter ready (3.24 GHz L-Band).`,
    `[${new Date().toLocaleTimeString()}] [SYSTEM] CryoPlan Workstation Station Sync OK. Ready.`
  ]);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  // States for interactive RADAR View
  const [radarDataset, setRadarDataset] = useState<'DFSAR_BACKSCATTER' | 'CPR' | 'DOP' | 'INCIDENCE_ANGLE' | 'CONFIDENCE' | 'COMPOSITE'>('DFSAR_BACKSCATTER');
  const [radarColormap, setRadarColormap] = useState<'Gray' | 'Blue' | 'Viridis' | 'Inferno' | 'Engineering Blue'>('Gray');
  const [radarGain, setRadarGain] = useState<number>(1.2);
  const [radarNoiseFilter, setRadarNoiseFilter] = useState<boolean>(true);
  const [radarHover, setRadarHover] = useState<{ x: number; y: number; val: number; lat: number; lon: number } | null>(null);

  // Radar analysis workflow states
  const [radarAnalysisState, setRadarAnalysisState] = useState<'IDLE' | 'ANALYZING' | 'COMPLETED'>('IDLE');
  const [radarAnalysisLogs, setRadarAnalysisLogs] = useState<string[]>([]);
  const [radarAnalysisProgress, setRadarAnalysisProgress] = useState<number>(0);
  const [radarAnalysisCurrentStep, setRadarAnalysisCurrentStep] = useState<string>('');
  const [iceThreshold, setIceThreshold] = useState<number>(0.50);
  
  const [radarMetrics, setRadarMetrics] = useState({
    avgCpr: 0.32,
    avgDop: 0.41,
    maxIceScore: 0.78,
    estimatedIcePixels: 12450,
    coveragePercent: 15.4,
    radarQuality: 'Excellent (SNR 42dB)',
    processingTime: 125,
    confidenceScore: 94.2
  });

  const [activeHistTab, setActiveHistTab] = useState<'BACKSCATTER' | 'CPR' | 'DOP' | 'ICE_PROB'>('BACKSCATTER');
  const [hoveredHistBin, setHoveredHistBin] = useState<{ binIdx: number; range: string; value: number } | null>(null);

  // Synchronize radar parameters dynamically
  useEffect(() => {
    (window as any).lunarIceThreshold = iceThreshold;
    if (mapInstance.current) {
      Object.values(olLayersRef.current).forEach((olLayer) => {
        (olLayer as any).getSource()?.refresh();
      });
    }
  }, [iceThreshold]);

  const runRadarAnalysis = () => {
    setRadarAnalysisState('ANALYZING');
    setRadarAnalysisProgress(0);
    setRadarAnalysisLogs([]);
    addLog('Initiating Chandrayaan-2 DFSAR Multi-Band Radar Analysis workflow...', 'SAR');
    
    const steps = [
      { text: 'Reading DFSAR Raster...', log: '[INFO] Initializing DFSAR L-band raster stream', wait: 500 },
      { text: 'Loading Tiles...', log: '[INFO] Streaming 2m SAR tiles from Shackleton-9 orbit trajectory', wait: 500 },
      { text: 'Normalizing Values...', log: '[INFO] Calibrating Sigma-0 microwave backscatter to dB values', wait: 400 },
      { text: 'Completed.', log: '[INFO] DFSAR Raster Loaded', wait: 400 },
      
      { text: 'Computing normalized CPR...', log: '[INFO] CPR Computed', wait: 600 },
      { text: 'CPR Stats: Min=0.04, Max=1.35, Mean=0.38', log: '[INFO] CPR stats computed. Mean circular polarization ratio is 0.38.', wait: 500 },
      
      { text: 'Loading DOP...', log: '[INFO] DOP Computed', wait: 600 },
      { text: 'Normalizing DOP values...', log: '[INFO] Normalizing Degree of Polarization values between 0.0 and 1.0', wait: 400 },
      { text: 'DOP Stats: Min=0.01, Max=0.98, Mean=0.42', log: '[INFO] DOP stats loaded successfully.', wait: 400 },
      
      { text: 'Generating Radar Composite...', log: '[INFO] Radar Composite Generated', wait: 700 },
      { text: 'Overlaying Backscatter, CPR, DOP...', log: '[INFO] Overlaying Backscatter, CPR, and DOP channels to build composite map', wait: 500 },
      
      { text: 'Generating Ice Probability Layer...', log: '[INFO] Ice Probability Layer Generated', wait: 700 },
      { text: 'Ice Score formula applied [0.45*CPR + 0.30*DOP + 0.25*Backscatter]', log: '[INFO] Multi-band weighted lunar ice score formula calibrated successfully', wait: 600 },
      { text: 'Analysis Complete.', log: '[INFO] Analysis Complete', wait: 400 }
    ];

    let currentIdx = 0;
    
    const runNext = () => {
      if (currentIdx >= steps.length) {
        setRadarAnalysisState('COMPLETED');
        setRadarAnalysisCurrentStep('Done.');
        setRadarMetrics({
          avgCpr: 0.38,
          avgDop: 0.42,
          maxIceScore: 0.89,
          estimatedIcePixels: 14820,
          coveragePercent: 18.2,
          radarQuality: 'High Quality (SNR 44.5dB)',
          processingTime: 140,
          confidenceScore: 95.8
        });
        
        // Push actual engineering logs to general workstation console
        addLog('[INFO] DFSAR Raster Loaded', 'SAR');
        addLog('[INFO] CPR Computed', 'SAR');
        addLog('[INFO] DOP Computed', 'SAR');
        addLog('[INFO] Radar Composite Generated', 'SAR');
        addLog('[INFO] Ice Probability Layer Generated', 'SAR');
        addLog('[INFO] Analysis Complete', 'SAR');
        return;
      }
      
      const step = steps[currentIdx];
      setRadarAnalysisCurrentStep(step.text);
      setRadarAnalysisProgress(Math.min(100, Math.floor(((currentIdx + 1) / steps.length) * 100)));
      setRadarAnalysisLogs(prev => [...prev, step.log]);
      
      if (step.log.includes('[INFO]')) {
        addLog(step.log, 'SAR');
      }
      
      currentIdx++;
      setTimeout(runNext, step.wait);
    };
    
    runNext();
  };

  const getRadarLoadingVisualization = () => {
    if (radarAnalysisState === 'IDLE') return null;
    
    let dfBar = "░░░░░░░░░░";
    let cprBar = "░░░░░░░░░░";
    let dopBar = "░░░░░░░░░░";
    let iceBar = "░░░░░░░░░░";
    
    if (radarAnalysisProgress >= 25) {
      dfBar = "██████████";
    } else {
      const filled = Math.floor((radarAnalysisProgress / 25) * 10);
      dfBar = "█".repeat(filled) + "░".repeat(10 - filled);
    }
    
    if (radarAnalysisProgress >= 50) {
      cprBar = "██████████";
    } else if (radarAnalysisProgress >= 25) {
      const filled = Math.floor(((radarAnalysisProgress - 25) / 25) * 10);
      cprBar = "█".repeat(filled) + "░".repeat(10 - filled);
    }
    
    if (radarAnalysisProgress >= 75) {
      dopBar = "██████████";
    } else if (radarAnalysisProgress >= 50) {
      const filled = Math.floor(((radarAnalysisProgress - 50) / 25) * 10);
      dopBar = "█".repeat(filled) + "░".repeat(10 - filled);
    }
    
    if (radarAnalysisProgress >= 100) {
      iceBar = "██████████";
    } else if (radarAnalysisProgress >= 75) {
      const filled = Math.floor(((radarAnalysisProgress - 75) / 25) * 10);
      iceBar = "█".repeat(filled) + "░".repeat(10 - filled);
    }
    
    return (
      <div className="font-mono text-[9px] leading-relaxed p-2.5 border border-cyan-500/30 bg-black/80 text-cyan-400 space-y-1 rounded shadow-inner">
        <div className="text-[8px] opacity-60 uppercase tracking-widest border-b border-cyan-500/20 pb-1 mb-1.5 flex justify-between">
          <span>PIPELINE ENGINE STATUS</span>
          <span className="animate-pulse">● RUNNING</span>
        </div>
        <div>
          <span className="opacity-75">Loading DFSAR...</span>
          <div className="text-pink-500 tracking-tight">{dfBar}</div>
        </div>
        {radarAnalysisProgress >= 25 && (
          <div>
            <span className="opacity-75">Loading CPR...</span>
            <div className="text-emerald-400 tracking-tight">{cprBar}</div>
          </div>
        )}
        {radarAnalysisProgress >= 50 && (
          <div>
            <span className="opacity-75">Loading DOP...</span>
            <div className="text-yellow-400 tracking-tight">{dopBar}</div>
          </div>
        )}
        {radarAnalysisProgress >= 75 && (
          <div>
            <span className="opacity-75">Generating Ice Probability...</span>
            <div className="text-sky-400 tracking-tight">{iceBar}</div>
          </div>
        )}
        {radarAnalysisProgress === 100 && (
          <div className="text-emerald-400 font-bold uppercase animate-pulse pt-1 border-t border-cyan-500/20 mt-1 flex items-center gap-1">
            <span>[✔] DONE. PIPELINE SYNCHRONIZED</span>
          </div>
        )}
      </div>
    );
  };

  const triggerExport = (format: string) => {
    addLog(`Initiating export sequence for format: [${format}]...`, 'SYSTEM');
    const element = document.createElement("a");
    let content = "";
    let filename = "";
    let mime = "text/plain";
    
    if (format === 'ICE_PROB') {
      filename = "DFSAR_H2O_ICE_PROBABILITY_RASTER.tif";
      content = "Scientific Geotiff Header\nResolution: 2m/px\nGeoreference: Shackleton Crater Polar projection\nData: Float32 Ice Probability raster bands\nSeeded metadata checksum: 0x9ef10c22";
      mime = "application/octet-stream";
    } else if (format === 'COMPOSITE') {
      filename = "DFSAR_MULTIBAND_RGB_COMPOSITE.tif";
      content = "Scientific Geotiff Header\nResolution: 2m/px\nBands: R=DFSAR Backscatter, G=CPR, B=DOP\nGeoreference: Lunar South Pole Polar Stereo";
      mime = "application/octet-stream";
    } else if (format === 'PNG') {
      filename = "DFSAR_GEOSPATIAL_WORKVIEW_SNAPSHOT.png";
      content = "Mock Image binary data representing workspace rendering";
      mime = "image/png";
    } else if (format === 'GEOJSON') {
      filename = "DFSAR_WATER_ICE_HABITAT_METADATA.json";
      content = JSON.stringify({
        type: "FeatureCollection",
        metadata: {
          satellite: "Chandrayaan-2",
          instrument: "DFSAR",
          processingLevel: "L3 Map Project",
          analysisTimestamp: new Date().toISOString(),
          parameters: {
            iceThreshold: iceThreshold,
            cprWeight: 0.45,
            dopWeight: 0.30,
            backscatterWeight: 0.25
          },
          computedMetrics: {
            estimatedIceCoveragePercent: radarMetrics.coveragePercent,
            estimatedIcePixels: radarMetrics.estimatedIcePixels,
            averageCPR: radarMetrics.avgCpr,
            averageDOP: radarMetrics.avgDop,
            confidenceScore: radarMetrics.confidenceScore
          }
        },
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [135.41, -89.54] },
            properties: { name: "Shackleton Crater Floor - High Probability Volatiles Concentration", iceProbability: 0.89 }
          }
        ]
      }, null, 2);
      mime = "application/json";
    }

    const file = new Blob([content], {type: mime});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addLog(`Export successful: ${filename}`, 'SYSTEM');
  };

  // States for interactive 3D View
  const [rot3d, setRot3d] = useState<number>(45);
  const [tilt3d, setTilt3d] = useState<number>(35);
  const [zoom3d, setZoom3d] = useState<number>(1.8);
  const [exaggerate3d, setExaggerate3d] = useState<number>(2.5);
  const [sunAzimuth3d, setSunAzimuth3d] = useState<number>(135);
  const [sunElevation3d, setSunElevation3d] = useState<number>(45);

  // States for Profile / Transect View
  const [profileTransect, setProfileTransect] = useState<'Standard' | 'Waypoints' | 'Custom'>('Standard');
  const [customLineCoords, setCustomLineCoords] = useState<[[number, number], [number, number]] | null>(null);
  const [isDrawingProfile, setIsDrawingProfile] = useState<boolean>(false);
  const [hoverProfileX, setHoverProfileX] = useState<number | null>(null);
  const [hoverMapCoords, setHoverMapCoords] = useState<{ gx: number; gy: number } | null>(null);

  // Synchronize 2D and 3D lighting models dynamically
  useEffect(() => {
    (window as any).lunarSunAzimuth = sunAzimuth3d;
    (window as any).lunarSunElevation = sunElevation3d;
    if (mapInstance.current) {
      Object.values(olLayersRef.current).forEach((olLayer) => {
        (olLayer as any).getSource()?.refresh();
      });
    }
  }, [sunAzimuth3d, sunElevation3d]);

  // Helper to add dynamic system logs
  const addLog = (msg: string, source = 'SYSTEM') => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [...prev, `[${time}] [${source}] ${msg}`].slice(-40));
  };

  useEffect(() => {
    const handleExternalLog = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        addLog(detail.msg, detail.source);
      }
    };
    window.addEventListener('lunar-log', handleExternalLog);
    return () => {
      window.removeEventListener('lunar-log', handleExternalLog);
    };
  }, []);

  // -------------------------------------------------------------
  // OPENLAYERS INTEGRATION (MAP VIEW)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    // Create separate OpenLayers tile layers for each layer in state
    const olLayers: { [key: string]: TileLayer } = {};

    layers.forEach((layer, idx) => {
      const zIndex = layers.length - idx;

      const layerSource = new XYZ({
        projection: 'EPSG:3857',
        tileUrlFunction: (tileCoord) => {
          const z = tileCoord[0];
          const x = tileCoord[1];
          const y = tileCoord[2];
          return `${z}/${x}/${y}`;
        },
        tileLoadFunction: (imageTile, src) => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const parts = src.split('/');
            const tileZ = parseInt(parts[0], 10);
            const tileX = parseInt(parts[1], 10);
            const tileY = parseInt(parts[2], 10);

            drawLunarTile(ctx, tileZ, tileX, tileY, layer.id, theme);
          }
          (imageTile as any).getImage().src = canvas.toDataURL();
        },
        transition: 0 
      });

      const tileLayer = new TileLayer({
        source: layerSource,
        visible: layer.visible,
        opacity: layer.opacity,
        zIndex: zIndex
      });

      olLayers[layer.id] = tileLayer;
    });

    olLayersRef.current = olLayers;

    // Profile Drawing Vector Source & Layer
    const vectorSource = new OLVectorSource();
    drawVectorSourceRef.current = vectorSource;
    const vectorLayer = new OLVectorLayer({
      source: vectorSource,
      zIndex: 100,
      style: new Style({
        stroke: new Stroke({
          color: isGlitch ? '#ff0055' : '#ef4444',
          width: 3,
          lineDash: [6, 6]
        })
      })
    });

    // Initialize Map Instance
    const map = new OLMap({
      target: mapElement.current,
      layers: [...Object.values(olLayers), vectorLayer],
      controls: [
        new Zoom({
          className: `ol-zoom absolute top-4 right-4 flex flex-col gap-1 z-10 [&_.ol-zoom-in]:px-2 [&_.ol-zoom-in]:py-1 [&_.ol-zoom-in]:bg-white [&_.ol-zoom-in]:border [&_.ol-zoom-in]:border-gray-300 [&_.ol-zoom-in]:text-gray-800 [&_.ol-zoom-in]:font-bold [&_.ol-zoom-in]:cursor-pointer [&_.ol-zoom-out]:px-2 [&_.ol-zoom-out]:py-1 [&_.ol-zoom-out]:bg-white [&_.ol-zoom-out]:border [&_.ol-zoom-out]:border-gray-300 [&_.ol-zoom-out]:text-gray-800 [&_.ol-zoom-out]:font-bold [&_.ol-zoom-out]:cursor-pointer`
        }),
        new ScaleLine({
          units: 'metric',
          className: 'ol-scale-line absolute bottom-12 left-4 text-[10px] font-mono bg-white/85 px-1.5 py-0.5 border border-gray-300 text-gray-700'
        })
      ],
      view: new View({
        center: [0, 0], 
        zoom: workspace.zoom,
        minZoom: 3,
        maxZoom: 14,
        projection: 'EPSG:3857'
      })
    });

    mapInstance.current = map;

    // Pointermove event to trace Lunar Coordinates
    map.on('pointermove', (evt) => {
      if (evt.coordinate) {
        const [x, y] = evt.coordinate;
        const lunarCoords = mapCoordsToLunar(x, y);
        setCursorCoords(lunarCoords);
        
        // Calculate global fractional coordinates (gx, gy)
        const gx = 0.5 + x / 40075016;
        const gy = 0.5 - y / 40075016;
        setHoverMapCoords({ gx, gy });
      } else {
        setHoverMapCoords(null);
      }
    });

    // Pointer click for profile line drawing and candidate selection
    map.on('click', (evt) => {
      if (!evt.coordinate) return;
      
      const [mx, my] = evt.coordinate;
      // Convert map projection coordinates to global fractional coordinates
      // Map center is 0,0 which maps to gx=0.5, gy=0.5. Map bounds go from -20037508 to 20037508
      const gx = 0.5 + mx / 40075016;
      const gy = 0.5 - my / 40075016; // invert Y for standard image space coordinates

      // Check if clicked near a landing candidate first
      const store = useWorkstationStore.getState();
      const { candidates } = store.landingAnalysis;
      if (candidates && candidates.length > 0) {
        let nearestCand: any = null;
        let minDistance = Infinity;
        candidates.forEach((cand) => {
          const d = Math.hypot(gx - cand.gx, gy - cand.gy);
          if (d < minDistance) {
            minDistance = d;
            nearestCand = cand;
          }
        });

        if (nearestCand && minDistance < 0.0018) {
          store.setSelectedCandidateId(nearestCand.id);
          addLog(`Landing Site LSE-${nearestCand.id} (${nearestCand.name}) selected via GIS Map Inspector.`, 'INFO');
          
          const mx_cand = (nearestCand.gx - 0.5) * 40075016;
          const my_cand = (0.5 - nearestCand.gy) * 40075016;
          map.getView().animate({ center: [mx_cand, my_cand], duration: 400 });
          return;
        }
      }

      setIsDrawingProfile((drawing) => {
        if (!drawing) return drawing;

        setCustomLineCoords((prev) => {
          if (!prev) {
            // First click
            addLog(`Profile Transect Start point locked at (${gx.toFixed(5)}, ${gy.toFixed(5)})`, 'MAP');
            return [[gx, gy], [gx, gy]];
          } else {
            // Second click - lock transect!
            addLog(`Profile Transect locked! End: (${gx.toFixed(5)}, ${gy.toFixed(5)}). Swapping view mode to PROFILE.`, 'MAP');
            setViewMode('PROFILE');
            setProfileTransect('Custom');
            return [prev[0], [gx, gy]];
          }
        });

        // Toggle drawing state off on second click
        return false;
      });
    });

    // View change listeners to update store
    map.getView().on('change:resolution', () => {
      const currentZoom = Math.round(map.getView().getZoom() || 8);
      setWorkspaceValue('zoom', currentZoom);
      let scaleStr = '1 : 50,000';
      if (currentZoom >= 11) scaleStr = '1 : 2,500';
      else if (currentZoom >= 9) scaleStr = '1 : 10,000';
      else if (currentZoom >= 7) scaleStr = '1 : 25,000';
      else if (currentZoom >= 5) scaleStr = '1 : 100,000';
      else scaleStr = '1 : 500,000';
      setWorkspaceValue('scale', scaleStr);
      addLog(`Cartographic zoom updated: LEVEL_${currentZoom} (${scaleStr} scale)`, 'ENGINE');
    });

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
  }, []);

  // Update map layer configurations when state changes
  useEffect(() => {
    if (!mapInstance.current) return;

    layers.forEach((layer, idx) => {
      const olLayer = olLayersRef.current[layer.id];
      if (olLayer) {
        const wasVisible = olLayer.getVisible();
        if (wasVisible !== layer.visible) {
          addLog(`Layer '${layer.name}' toggled ${layer.visible ? 'ACTIVE' : 'INACTIVE'}`, 'IO');
        }
        olLayer.setVisible(layer.visible);
        olLayer.setOpacity(layer.opacity);
        olLayer.setZIndex(layers.length - idx); 
      }
    });
  }, [layers]);

  // Update map tiles rendering when theme changes
  useEffect(() => {
    if (!mapInstance.current) return;
    Object.values(olLayersRef.current).forEach((olLayer) => {
      (olLayer as any).getSource()?.refresh();
    });
    addLog(`Cartographic visual theme updated: ${theme}`, 'SYSTEM');
  }, [theme]);

  // React to selected landing candidate changes by animating view
  const prevSelectedIdRef = useRef<number | null>(null);
  const selectedCandidateId = useWorkstationStore((s) => s.landingAnalysis.selectedCandidateId);
  const candidates = useWorkstationStore((s) => s.landingAnalysis.candidates);
  
  useEffect(() => {
    if (!mapInstance.current || selectedCandidateId === null || candidates.length === 0) return;
    if (prevSelectedIdRef.current === selectedCandidateId) return;
    prevSelectedIdRef.current = selectedCandidateId;

    const cand = candidates.find((c) => c.id === selectedCandidateId);
    if (cand) {
      const mx = (cand.gx - 0.5) * 40075016;
      const my = (0.5 - cand.gy) * 40075016;
      
      mapInstance.current.getView().animate({
        center: [mx, my],
        zoom: 11,
        duration: 800
      });
    }
  }, [selectedCandidateId, candidates]);

  // Handle profile line geometry rendering in OpenLayers
  useEffect(() => {
    if (!drawVectorSourceRef.current) return;
    drawVectorSourceRef.current.clear();
    
    if (customLineCoords) {
      const p1 = customLineCoords[0];
      const p2 = customLineCoords[1];
      
      // Convert back to map coordinates
      const x1 = (p1[0] - 0.5) * 40075016;
      const y1 = (0.5 - p1[1]) * 40075016;
      const x2 = (p2[0] - 0.5) * 40075016;
      const y2 = (0.5 - p2[1]) * 40075016;

      const lineFeature = new Feature({
        geometry: new LineString([[x1, y1], [x2, y2]])
      });
      drawVectorSourceRef.current.addFeature(lineFeature);
    }
  }, [customLineCoords]);

  // Switch View Mode Log Trigger
  useEffect(() => {
    addLog(`Switched workstation view mode to ${viewMode} view mode`, 'SYSTEM');
  }, [viewMode]);

  // -------------------------------------------------------------
  // RADAR CANVAS GENERATOR (Fully interactive radar workspace)
  // -------------------------------------------------------------
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  const getColormappedRGB = (val: number, cmap: string): [number, number, number] => {
    const gainVal = Math.max(0, Math.min(1.0, val * radarGain));
    
    switch (cmap) {
      case 'Blue':
        return [
          Math.floor(gainVal * 30),
          Math.floor(gainVal * 120),
          Math.floor(gainVal * 255)
        ];
      case 'Viridis':
        return [
          Math.floor(gainVal * gainVal * 255),
          Math.floor(gainVal * 220),
          Math.floor((1 - gainVal) * 140)
        ];
      case 'Inferno':
        return [
          Math.floor(gainVal * 255),
          Math.floor(gainVal * Math.pow(gainVal, 2.5) * 230),
          Math.floor(Math.pow(1 - gainVal, 3) * 50)
        ];
      case 'Engineering Blue':
        return [
          Math.floor(Math.pow(1 - gainVal, 2) * 20),
          Math.floor(gainVal * 180),
          Math.floor(gainVal * 255)
        ];
      case 'Gray':
      default:
        return [
          Math.floor(gainVal * 255),
          Math.floor(gainVal * 255),
          Math.floor(gainVal * 255)
        ];
    }
  };

  const renderRadarFrame = () => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = isGlitch ? '#03050a' : '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Render simulated 2D high-resolution DFSAR raw microwave grid
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        // Map x,y to global fractional coordinates centered near Shackleton S9
        const gx = 0.495 + (x / w) * 0.01;
        const gy = 0.495 + (y / h) * 0.01;

        let intensity = 0;
        let rVal = 0, gVal = 0, bVal = 0;

        if (radarDataset === 'DFSAR_BACKSCATTER') {
          intensity = getNormalizedBackscatter(gx, gy, 0.0001);
          if (!radarNoiseFilter) {
            intensity *= (0.7 + hash2D(Math.floor(gx * 45000), Math.floor(gy * 45000)) * 0.6);
          }
        } else if (radarDataset === 'CPR') {
          intensity = getNormalizedCPR(gx, gy);
        } else if (radarDataset === 'DOP') {
          intensity = getNormalizedDOP(gx, gy);
        } else if (radarDataset === 'INCIDENCE_ANGLE') {
          const angle = getRadarIncidenceAngle(gx, gy);
          intensity = (angle - 20) / 55;
        } else if (radarDataset === 'CONFIDENCE') {
          intensity = getRadarConfidence(gx, gy);
        } else if (radarDataset === 'COMPOSITE') {
          const bs = getNormalizedBackscatter(gx, gy, 0.0001);
          const cpr = getNormalizedCPR(gx, gy);
          const dop = getNormalizedDOP(gx, gy);
          rVal = Math.floor(bs * 255);
          gVal = Math.floor(cpr * 255);
          bVal = Math.floor(dop * 255);
        }

        if (radarDataset === 'COMPOSITE') {
          data[idx] = rVal;
          data[idx + 1] = gVal;
          data[idx + 2] = bVal;
          data[idx + 3] = 255;
        } else {
          const [r, g, b] = getColormappedRGB(intensity, radarColormap);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw grid coordinate overlays
    ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 50; x < w; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 50; y < h; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Interactive HUD Hover Inspector Line
    if (radarHover) {
      ctx.strokeStyle = isGlitch ? '#ff0055' : '#10b981';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(radarHover.x, 0); ctx.lineTo(radarHover.x, h);
      ctx.moveTo(0, radarHover.y); ctx.lineTo(w, radarHover.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const renderRadarHistogram = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = isGlitch ? '#03050a' : '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Compute dynamic histogram bins based on active histogram tab
    const bins = new Array(25).fill(0);
    for (let i = 0; i < 250; i++) {
      let val = 0;
      if (activeHistTab === 'BACKSCATTER') {
        val = 0.45 + (Math.sin(i * 0.25) * 0.18) + (Math.cos(i * 0.1) * 0.08) + (Math.random() * 0.08 - 0.04);
      } else if (activeHistTab === 'CPR') {
        if (i < 160) {
          val = 0.12 + Math.random() * 0.12;
        } else {
          val = 0.65 + Math.random() * 0.25;
        }
      } else if (activeHistTab === 'DOP') {
        val = 0.22 + Math.sin(i * 0.05) * Math.sin(i * 0.08) * 0.35 + Math.random() * 0.18;
      } else {
        const t = i / 250;
        val = Math.pow(t, 2) * 0.62 + Math.random() * 0.12;
        if (i > 210) {
          val = 0.72 + Math.random() * 0.22;
        }
      }
      const binIdx = Math.min(24, Math.floor(Math.max(0, val) * 25));
      bins[binIdx]++;
    }

    const maxBin = Math.max(...bins, 1);
    
    // Draw horizontal grids inside histogram
    ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const yLine = (h - 20) * (i / 4) + 10;
      ctx.beginPath(); ctx.moveTo(10, yLine); ctx.lineTo(w - 10, yLine); ctx.stroke();
    }

    const barW = (w - 20) / 25;
    for (let i = 0; i < 25; i++) {
      const barH = (bins[i] / maxBin) * (h - 20);
      const bx = 10 + i * barW;
      const by = h - 10 - barH;
      
      const isHovered = hoveredHistBin && hoveredHistBin.binIdx === i;
      
      let fillStyle = '';
      if (activeHistTab === 'BACKSCATTER') {
        fillStyle = isHovered ? '#ff0055' : '#fb7185';
      } else if (activeHistTab === 'CPR') {
        fillStyle = isHovered ? '#00ffff' : '#c084fc';
      } else if (activeHistTab === 'DOP') {
        fillStyle = isHovered ? '#00ffff' : '#22d3ee';
      } else {
        fillStyle = isHovered ? '#fb7185' : '#38bdf8';
      }
      ctx.fillStyle = fillStyle;
      ctx.fillRect(bx, by, barW - 1.5, barH);
    }
  };

  const handleHistMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvas.width;
    
    const barW = (w - 20) / 25;
    const xOffset = mx - 10;
    if (xOffset >= 0 && xOffset < w - 20) {
      const binIdx = Math.floor(xOffset / barW);
      if (binIdx >= 0 && binIdx < 25) {
        let val = 0;
        if (activeHistTab === 'BACKSCATTER') {
          val = 12 + Math.floor(Math.sin(binIdx * 0.3) * 35) + (binIdx % 3) * 4;
        } else if (activeHistTab === 'CPR') {
          val = binIdx < 8 ? 48 - binIdx * 4 : (binIdx > 16 ? 15 + (binIdx - 16) * 5 : 5);
        } else if (activeHistTab === 'DOP') {
          val = 10 + Math.floor(Math.sin(binIdx * 0.15) * 40);
        } else {
          val = Math.max(2, Math.floor(45 * Math.exp(-Math.pow(binIdx - 2, 2) / 32)) + (binIdx > 18 ? 8 : 0));
        }
        
        const minVal = (binIdx / 25).toFixed(2);
        const maxVal = ((binIdx + 1) / 25).toFixed(2);
        
        setHoveredHistBin({
          binIdx,
          range: `${minVal} - ${maxVal}`,
          value: Math.max(1, val)
        });
      }
    } else {
      setHoveredHistBin(null);
    }
  };

  useEffect(() => {
    if (viewMode === 'RADAR') {
      renderRadarFrame();
    }
  }, [viewMode, radarDataset, radarColormap, radarGain, radarNoiseFilter, radarHover, sunAzimuth3d, sunElevation3d]);

  // -------------------------------------------------------------
  // 3D HEIGHTFIELD PROJECTOR (Real 3D interactive mesh renderer)
  // -------------------------------------------------------------
  const topoCanvasRef = useRef<HTMLCanvasElement>(null);

  const render3DField = () => {
    const canvas = topoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = isGlitch ? '#02050b' : '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // 3D Mesh properties
    const gridSize = 45;
    const rotRad = (rot3d * Math.PI) / 180;
    const tiltRad = (tilt3d * Math.PI) / 180;

    // Generate projected points
    const points: { sx: number; sy: number; depth: number; hVal: number; gx: number; gy: number }[][] = [];
    
    for (let i = 0; i <= gridSize; i++) {
      points[i] = [];
      const u = i / gridSize;
      const gx = 0.495 + u * 0.01; // Span Shackleton S9 rim region

      for (let j = 0; j <= gridSize; j++) {
        const v = j / gridSize;
        const gy = 0.495 + v * 0.01;

        const hVal = getElevationAt(gx, gy);

        // Standard isometric yaw/pitch rotation formulas
        const x0 = (u - 0.5) * 450;
        const y0 = (v - 0.5) * 450;

        // Rotate YAW (Z-axis rotation)
        const x1 = x0 * Math.cos(rotRad) - y0 * Math.sin(rotRad);
        const y1 = x0 * Math.sin(rotRad) + y0 * Math.cos(rotRad);

        // Scale altitude height
        const altScale = (hVal - (-3500)) * exaggerate3d * 0.045; // meters displacement
        
        // Rotate PITCH (X-axis rotation)
        const x2 = x1;
        const y2 = y1 * Math.cos(tiltRad) - altScale * Math.sin(tiltRad);
        const depth = y1 * Math.sin(tiltRad) + altScale * Math.cos(tiltRad);

        // Project
        const scale = zoom3d * 1.6;
        const sx = w / 2 + x2 * scale;
        const sy = h / 2 + y2 * scale;

        points[i][j] = { sx, sy, depth, hVal, gx, gy };
      }
    }

    // Build & sort polygon quads (Painter's algorithm for back-to-front projection)
    interface MeshQuad {
      p00: typeof points[0][0];
      p10: typeof points[0][0];
      p11: typeof points[0][0];
      p01: typeof points[0][0];
      avgDepth: number;
    }

    const quads: MeshQuad[] = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const p00 = points[i][j];
        const p10 = points[i + 1][j];
        const p11 = points[i + 1][j + 1];
        const p01 = points[i][j + 1];

        const avgDepth = (p00.depth + p10.depth + p11.depth + p01.depth) / 4;
        quads.push({ p00, p10, p11, p01, avgDepth });
      }
    }

    // Sort quads by depth (farthest rendered first)
    quads.sort((a, b) => b.avgDepth - a.avgDepth);

    // Render Shaded Polygons
    quads.forEach((q) => {
      // Calculate normal vector components to apply direct NW Sun lighting
      const dxY = q.p10.sx - q.p00.sx;
      const dyY = q.p10.sy - q.p00.sy;
      const dzY = q.p10.hVal - q.p00.hVal;

      const dxX = q.p01.sx - q.p00.sx;
      const dyX = q.p01.sy - q.p00.sy;
      const dzX = q.p01.hVal - q.p00.hVal;

      // Normal cross-product estimation
      const nx = dyY * dzX - dzY * dyX;
      const ny = dzY * dxX - dxY * dzX;
      const nz = dxY * dyX - dyY * dxX;
      const lenN = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const normalZ = nz / lenN;

      // Basic diffuse factor matching Sun elevation
      const sunFactor = Math.abs(normalZ * Math.sin((sunElevation3d * Math.PI) / 180));
      const colShade = Math.min(255, Math.max(10, Math.floor(120 * sunFactor + 60)));

      // Dynamic color: Grayscale base
      ctx.fillStyle = isGlitch 
        ? `rgb(0, ${Math.floor(colShade * 0.7)}, ${colShade})` 
        : `rgb(${colShade}, ${colShade}, ${colShade})`;
      ctx.strokeStyle = isGlitch ? 'rgba(0,255,255,0.06)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(q.p00.sx, q.p00.sy);
      ctx.lineTo(q.p10.sx, q.p10.sy);
      ctx.lineTo(q.p11.sx, q.p11.sy);
      ctx.lineTo(q.p01.sx, q.p01.sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // -------------------------------------------------------------
    // DRAPE OVERLAYS: Waypoint Traverse Route on 3D mesh
    // -------------------------------------------------------------
    const waypoints = [
      { wx: 110, wy: 110 },
      { wx: 124, wy: 116 },
      { wx: 138, wy: 130 },
      { wx: 132, wy: 142 },
      { wx: 118, wy: 134 }
    ];

    const getProjected3D = (gx: number, gy: number) => {
      // Shift to local coordinates
      const u = (gx - 0.495) / 0.01;
      const v = (gy - 0.495) / 0.01;

      const hVal = getElevationAt(gx, gy);

      const x0 = (u - 0.5) * 450;
      const y0 = (v - 0.5) * 450;

      const x1 = x0 * Math.cos(rotRad) - y0 * Math.sin(rotRad);
      const y1 = x0 * Math.sin(rotRad) + y0 * Math.cos(rotRad);

      const altScale = (hVal - (-3500)) * exaggerate3d * 0.045;
      
      const x2 = x1;
      const y2 = y1 * Math.cos(tiltRad) - altScale * Math.sin(tiltRad);

      const scale = zoom3d * 1.6;
      return {
        sx: w / 2 + x2 * scale,
        sy: h / 2 + y2 * scale
      };
    };

    // Plot draped golden traverse route polyline
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = isGlitch ? 8 : 0;
    ctx.shadowColor = '#eab308';
    ctx.beginPath();
    
    waypoints.forEach((wp, index) => {
      const gx = (128 * 256 + wp.wx) / 65536;
      const gy = (128 * 256 + wp.wy) / 65536;
      const proj = getProjected3D(gx, gy);
      
      if (index === 0) ctx.moveTo(proj.sx, proj.sy);
      else ctx.lineTo(proj.sx, proj.sy);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Plot waypoint white nodes draped
    waypoints.forEach((wp, index) => {
      const gx = (128 * 256 + wp.wx) / 65536;
      const gy = (128 * 256 + wp.wy) / 65536;
      const proj = getProjected3D(gx, gy);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // -------------------------------------------------------------
    // DRAPE OVERLAYS: Landing Ellipse draped on 3D terrain
    // -------------------------------------------------------------
    const lzX = (128 * 256 + 140) / 65536;
    const lzY = (128 * 256 + 100) / 65536;
    const rLZ = 45 / 65536;

    ctx.strokeStyle = isGlitch ? '#00ff80' : '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    // Plot rotated ellipse boundary draped
    const numSteps = 36;
    for (let k = 0; k <= numSteps; k++) {
      const theta = (k / numSteps) * Math.PI * 2;
      // Ellipse transform (width rLZ, height rLZ * 0.7, rotated -30deg)
      const ex0 = rLZ * Math.cos(theta);
      const ey0 = rLZ * 0.7 * Math.sin(theta);
      
      const rot = -Math.PI / 6;
      const ex = ex0 * Math.cos(rot) - ey0 * Math.sin(rot) + lzX;
      const ey = ex0 * Math.sin(rot) + ey0 * Math.cos(rot) + lzY;
      
      const proj = getProjected3D(ex, ey);
      if (k === 0) ctx.moveTo(proj.sx, proj.sy);
      else ctx.lineTo(proj.sx, proj.sy);
    }
    ctx.stroke();
  };

  useEffect(() => {
    if (viewMode === '3D') {
      render3DField();
    }
  }, [viewMode, rot3d, tilt3d, zoom3d, exaggerate3d, sunAzimuth3d, sunElevation3d]);

  // -------------------------------------------------------------
  // ELEVATION PROFILE CANVAS GENERATOR (True path cross-section)
  // -------------------------------------------------------------
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);

  const getProfilePoints = () => {
    // Collect coordinates along chosen profile line
    const pointsList: { gx: number; gy: number; dist: number }[] = [];
    const totalSamples = 100;

    if (profileTransect === 'Standard') {
      // Lander to Shackleton deep basin floor
      const startX = (128 * 256 + 140) / 65536;
      const startY = (128 * 256 + 100) / 65536;
      const endX = 0.5002;
      const endY = 0.5004;

      for (let i = 0; i < totalSamples; i++) {
        const t = i / (totalSamples - 1);
        const gx = startX + (endX - startX) * t;
        const gy = startY + (endY - startY) * t;
        // Cumulative distance approximation: 1 fractional unit = 10,921 kilometers
        const dist = t * Math.hypot(endX - startX, endY - startY) * 10921;
        pointsList.push({ gx, gy, dist });
      }
    } else if (profileTransect === 'Waypoints') {
      // Trace path along consecutive waypoints
      const waypoints = [
        { wx: 110, wy: 110 },
        { wx: 124, wy: 116 },
        { wx: 138, wy: 130 },
        { wx: 132, wy: 142 },
        { wx: 118, wy: 134 }
      ];

      let cumulativeDist = 0;
      for (let k = 0; k < waypoints.length - 1; k++) {
        const p1 = waypoints[k];
        const p2 = waypoints[k + 1];
        
        const sx = (128 * 256 + p1.wx) / 65536;
        const sy = (128 * 256 + p1.wy) / 65536;
        const ex = (128 * 256 + p2.wx) / 65536;
        const ey = (128 * 256 + p2.wy) / 65536;
        const segDist = Math.hypot(ex - sx, ey - sy) * 10921;

        const segSamples = 25;
        for (let i = 0; i < segSamples; i++) {
          const t = i / (segSamples - 1);
          const gx = sx + (ex - sx) * t;
          const gy = sy + (ey - sy) * t;
          
          pointsList.push({ 
            gx, 
            gy, 
            dist: cumulativeDist + t * segDist 
          });
        }
        cumulativeDist += segDist;
      }
    } else if (profileTransect === 'Custom' && customLineCoords) {
      // Drawn on-screen path
      const [p1, p2] = customLineCoords;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / (totalSamples - 1);
        const gx = p1[0] + (p2[0] - p1[0]) * t;
        const gy = p1[1] + (p2[1] - p1[1]) * t;
        const dist = t * Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 10921;
        pointsList.push({ gx, gy, dist });
      }
    }

    return pointsList;
  };

  const renderProfileChart = () => {
    const canvas = profileCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = isGlitch ? '#040710' : '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 60;
    const padRight = 40;
    const padTop = 40;
    const padBottom = 40;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Draw axes
    ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.4)' : '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, h - padBottom);
    ctx.lineTo(w - padRight, h - padBottom);
    ctx.stroke();

    const profileData = getProfilePoints();
    if (profileData.length === 0) return;

    const maxDist = profileData[profileData.length - 1].dist || 1;

    // Plot grid ticks
    ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.08)' : 'rgba(100, 116, 139, 0.12)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = isGlitch ? '#00ffff' : '#475569';

    // Horizontal height gridlines
    const heights = [3000, 1000, -1000, -3000, -5000];
    heights.forEach((ht) => {
      // Normalise height from -6500m to +4200m
      const yNorm = (ht - (-6500)) / (4200 - (-6500));
      const yPos = h - padBottom - yNorm * chartH;

      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(w - padRight, yPos);
      ctx.stroke();
      ctx.fillText(`${ht} m`, 12, yPos + 3);
    });

    // Vertical distance gridlines
    const numTicks = 6;
    for (let k = 0; k <= numTicks; k++) {
      const dVal = (k / numTicks) * maxDist;
      const xPos = padLeft + (k / numTicks) * chartW;

      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, h - padBottom);
      ctx.stroke();
      ctx.fillText(`${dVal.toFixed(1)} km`, xPos - 12, h - padBottom + 15);
    }

    // Trace elevation profile line
    ctx.strokeStyle = isGlitch ? '#ff0055' : '#4f46e5';
    ctx.lineWidth = 3;
    ctx.beginPath();

    profileData.forEach((pt, index) => {
      const elev = getElevationAt(pt.gx, pt.gy);
      const xPos = padLeft + (pt.dist / maxDist) * chartW;
      const yNorm = (elev - (-6500)) / (4200 - (-6500));
      const yPos = h - padBottom - yNorm * chartH;

      if (index === 0) ctx.moveTo(xPos, yPos);
      else ctx.lineTo(xPos, yPos);
    });
    ctx.stroke();

    // Fill area below profile
    ctx.fillStyle = isGlitch ? 'rgba(255, 0, 85, 0.04)' : 'rgba(79, 70, 229, 0.04)';
    ctx.beginPath();
    ctx.moveTo(padLeft, h - padBottom);
    
    profileData.forEach((pt) => {
      const elev = getElevationAt(pt.gx, pt.gy);
      const xPos = padLeft + (pt.dist / maxDist) * chartW;
      const yNorm = (elev - (-6500)) / (4200 - (-6500));
      const yPos = h - padBottom - yNorm * chartH;
      ctx.lineTo(xPos, yPos);
    });
    ctx.lineTo(padLeft + chartW, h - padBottom);
    ctx.closePath();
    ctx.fill();

    // Trace slope hazard crossings (Slope > 15° highlighted in red)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)'; // semi-transparent red
    profileData.forEach((pt, index) => {
      if (index === 0) return;
      
      const prevPt = profileData[index - 1];
      const slope = getSlopeAt(pt.gx, pt.gy, 8);
      
      if (slope > 15) {
        // Highlight this interval as a critical hazard crossing
        const xPrev = padLeft + (prevPt.dist / maxDist) * chartW;
        const xCurr = padLeft + (pt.dist / maxDist) * chartW;
        
        ctx.fillRect(xPrev, padTop, xCurr - xPrev, chartH);
      }
    });

    // Hover Probe Reading
    if (hoverProfileX !== null && hoverProfileX >= padLeft && hoverProfileX <= w - padRight) {
      const xRatio = (hoverProfileX - padLeft) / chartW;
      const targetDist = xRatio * maxDist;

      // Find closest sample point
      let closestIdx = 0;
      let minDiff = Infinity;
      profileData.forEach((pt, idx) => {
        const diff = Math.abs(pt.dist - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      const activePt = profileData[closestIdx];
      const activeElev = getElevationAt(activePt.gx, activePt.gy);
      const activeSlope = getSlopeAt(activePt.gx, activePt.gy, 8);
      
      const yNorm = (activeElev - (-6500)) / (4200 - (-6500));
      const yPos = h - padBottom - yNorm * chartH;

      // Guide Line
      ctx.strokeStyle = isGlitch ? '#00ffff' : '#0284c7';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverProfileX, padTop);
      ctx.lineTo(hoverProfileX, h - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Circle node
      ctx.fillStyle = isGlitch ? '#00ffff' : '#0ea5e9';
      ctx.beginPath();
      ctx.arc(hoverProfileX, yPos, 5, 0, Math.PI * 2);
      ctx.fill();

      // Readout Tooltip Box
      const boxW = 125;
      const boxH = 50;
      let boxX = hoverProfileX + 15;
      if (boxX + boxW > w - 10) boxX = hoverProfileX - boxW - 15;

      ctx.fillStyle = isGlitch ? '#0d1525' : '#1e293b';
      ctx.strokeStyle = isGlitch ? '#00ffff' : '#475569';
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, yPos - 55, boxW, boxH);
      ctx.strokeRect(boxX, yPos - 55, boxW, boxH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`DIST: ${activePt.dist.toFixed(2)} km`, boxX + 8, yPos - 42);
      ctx.fillText(`ELEV: ${activeElev.toFixed(0)} m`, boxX + 8, yPos - 30);
      ctx.fillText(`SLOPE: ${activeSlope.toFixed(1)}°`, boxX + 8, yPos - 18);
    }

    // Title label
    ctx.fillStyle = isGlitch ? '#00ffff' : '#1e293b';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(`TRANSECT LONGITUDE CROSS-SECTION: ${profileTransect.toUpperCase()}`, padLeft, padTop - 15);
  };

  useEffect(() => {
    if (viewMode === 'PROFILE') {
      renderProfileChart();
    }
  }, [viewMode, profileTransect, customLineCoords, hoverProfileX]);

  return (
    <div
      id="gis-workspace-panel"
      className={`h-full flex flex-col transition-colors ${
        isGlitch ? 'bg-[#03060b] text-[#00ffff]' : 'bg-[#f3f4f6] text-[#1a1a1a]'
      }`}
    >
      {/* 1. View Mode Toggles above map */}
      <div
        id="gis-view-tabs"
        className={`flex items-end justify-between px-2 gap-px text-[11px] font-medium shrink-0 ${
          isGlitch
            ? 'px-4 gap-1 pt-2 bg-[#0a0f1d] border-b border-[#00ffff]/30'
            : 'h-8 bg-[#e5e7eb] border-b border-[#d1d5db]'
        }`}
      >
        <div className="flex items-end gap-px h-full">
          {([
            { id: 'MAP', label: 'INTERACTIVE MAP', icon: <Compass className="w-3.5 h-3.5" /> },
            { id: 'RADAR', label: 'DFSAR RADAR SCOPE', icon: <Radio className="w-3.5 h-3.5" /> },
            { id: '3D', label: 'LOLA 3D TOPO', icon: <Globe className="w-3.5 h-3.5" /> },
            { id: 'PROFILE', label: 'ELEVATION CHART', icon: <BarChart2 className="w-3.5 h-3.5" /> }
          ] as const).map((mode) => {
            const isActive = viewMode === mode.id;
            return (
              <button
                id={`view-mode-tab-${mode.id}`}
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`px-3 py-1.5 text-[11px] transition-all select-none cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? isGlitch
                      ? 'bg-cyan-950/30 border-t border-x border-cyan-400 border-b-transparent text-cyan-300 -mb-[1px]'
                      : 'bg-[#fdfdfd] border-t border-x border-[#ccc] text-[#1a1a1a] font-semibold -mb-[1px]'
                    : isGlitch
                      ? 'bg-transparent border-transparent text-gray-500 hover:text-cyan-400'
                      : 'hover:bg-[#ececec] text-[#555] border-t border-x border-transparent pb-1'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] font-mono opacity-65 select-none hidden md:block pb-1.5 pr-2">
          TARGET_FOCUS: Shackleton Crater Center Rim
        </div>
      </div>

      {/* 2. Interactive Screens Area */}
      <div id="gis-screen-stage" className="flex-1 relative overflow-hidden bg-[#090d16]">
        
        {/* VIEW 1: MAP VIEW (OPENLAYERS) */}
        <div
          id="ol-map-viewport"
          ref={mapElement}
          className="w-full h-full absolute inset-0 transition-opacity animate-fade-in"
          style={{
            opacity: viewMode === 'MAP' ? 1 : 0,
            zIndex: viewMode === 'MAP' ? 10 : 0,
            pointerEvents: viewMode === 'MAP' ? 'auto' : 'none',
            cursor: 'crosshair'
          }}
        />

        {/* Floating Map Controls Bar */}
        {viewMode === 'MAP' && (
          <div className={`absolute top-4 right-16 flex items-center gap-1.5 z-20 p-1.5 border text-xs rounded shadow-lg select-none ${
            isGlitch
              ? 'bg-black/90 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,255,255,0.15)]'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'
          }`}>
            <button 
              onClick={() => mapInstance.current?.getView().animate({ zoom: (mapInstance.current.getView().getZoom() || 8) + 1, duration: 250 })} 
              className="p-1 hover:bg-cyan-500 hover:text-black font-bold font-mono text-center w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors" 
              title="Zoom In"
            >
              +
            </button>
            <button 
              onClick={() => mapInstance.current?.getView().animate({ zoom: (mapInstance.current.getView().getZoom() || 8) - 1, duration: 250 })} 
              className="p-1 hover:bg-cyan-500 hover:text-black font-bold font-mono text-center w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors" 
              title="Zoom Out"
            >
              -
            </button>
            <span className="h-4 w-[1px] bg-current/20 mx-1" />
            <button 
              onClick={() => mapInstance.current?.getView().animate({ center: [0, 0], zoom: 8, duration: 400 })} 
              className="px-2 py-0.5 text-[9px] hover:bg-cyan-500 hover:text-black uppercase font-mono h-6 flex items-center rounded cursor-pointer transition-colors" 
              title="Reset View"
            >
              RESET
            </button>
            <button 
              onClick={() => mapInstance.current?.getView().animate({ center: [0, 0], zoom: 11, duration: 400 })} 
              className="px-2 py-0.5 text-[9px] hover:bg-cyan-500 hover:text-black uppercase font-mono h-6 flex items-center rounded cursor-pointer transition-colors" 
              title="Zoom to Target Crater"
            >
              CRATER
            </button>
            <button 
              onClick={() => {
                const lx = (128 * 256 + 140) / 65536;
                const ly = (128 * 256 + 100) / 65536;
                const mx = (lx - 0.5) * 40075016;
                const my = (0.5 - ly) * 40075016;
                mapInstance.current?.getView().animate({ center: [mx, my], zoom: 12, duration: 450 });
              }} 
              className="px-2 py-0.5 text-[9px] hover:bg-cyan-500 hover:text-black uppercase font-mono h-6 flex items-center rounded cursor-pointer transition-colors" 
              title="Zoom to Landing Site"
            >
              LSE-1
            </button>
          </div>
        )}

        {/* PROFILE DRAW HUD TOOLTIP ON MAP */}
        {viewMode === 'MAP' && isDrawingProfile && (
          <div className="absolute top-4 left-4 bg-red-600/90 border border-white text-white p-3 text-[10px] font-mono leading-tight z-30 max-w-sm rounded">
            <div className="font-bold flex items-center gap-1.5 mb-1 animate-pulse">
              <Pencil className="w-3.5 h-3.5" />
              <span>[PROFILE DRAW MODE ENGAGED]</span>
            </div>
            <div>Click 1: Establish START coordinate</div>
            <div>Click 2: Establish END coordinate to lock profile line</div>
          </div>
        )}

        {/* VIEW 2: RADAR VIEW */}
        {viewMode === 'RADAR' && (
          <div id="radar-viewport" className="w-full h-full absolute inset-0 p-3 flex gap-3 overflow-hidden text-[#00ffff]">
            {/* Left: Main Radar Display */}
            <div className={`flex-[1.4] border p-1.5 relative flex flex-col bg-black/80 rounded ${isGlitch ? 'border-[#00ffff]/30 shadow-[0_0_15px_rgba(0,255,255,0.05)]' : 'border-slate-700 shadow-xl'}`}>
              <div className="absolute top-2 left-2 z-10 font-mono text-[8px] bg-black/95 px-2 py-1 border border-cyan-500/30 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span>DFSAR MICROWAVE APERTURE GRID [SHACKLETON L3-MAP]</span>
              </div>
              <div className="flex-1 overflow-hidden relative border border-cyan-500/10 rounded">
                <canvas
                  id="radar-scope-canvas"
                  ref={radarCanvasRef}
                  width={640}
                  height={440}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const rx = ((e.clientX - rect.left) / rect.width) * e.currentTarget.width;
                    const ry = ((e.clientY - rect.top) / rect.height) * e.currentTarget.height;
                    
                    const gx = 0.495 + (rx / e.currentTarget.width) * 0.01;
                    const gy = 0.495 + (ry / e.currentTarget.height) * 0.01;
                    const coords = mapCoordsToLunar((gx - 0.5) * 40075016, (0.5 - gy) * 40075016);
                    
                    const elev = getElevationAt(gx, gy);
                    setRadarHover({
                      x: rx,
                      y: ry,
                      val: (elev + 6500) / 10700,
                      lat: coords.lat,
                      lon: coords.lon
                    });
                  }}
                  onMouseLeave={() => setRadarHover(null)}
                  className="w-full h-full block cursor-crosshair"
                />
                
                {radarHover && (() => {
                  const rx = radarHover.x;
                  const ry = radarHover.y;
                  const gx = 0.495 + (rx / 640) * 0.01;
                  const gy = 0.495 + (ry / 440) * 0.01;
                  const elev = getElevationAt(gx, gy);
                  const slope = getSlopeAt(gx, gy, 8);
                  const cprVal = getNormalizedCPR(gx, gy);
                  const dopVal = getNormalizedDOP(gx, gy);
                  const backscatterVal = getNormalizedBackscatter(gx, gy);
                  const terrainType = elev < -4000 ? 'PSR Cold Trap Basin' : slope > 15 ? 'Severe Hazard Sloped Wall' : slope > 5 ? 'Highland Traverse' : 'Lander-Safe Plain';
                  const pixelVal = Math.floor(cprVal * 255);
                  
                  return (
                    <div className="absolute bottom-4 left-4 bg-black/95 border border-cyan-500/50 p-2.5 text-[8px] font-mono leading-relaxed rounded shadow-[0_0_12px_rgba(0,255,255,0.2)] text-cyan-400 min-w-[195px] z-20">
                      <div className="font-bold border-b border-cyan-500/30 pb-0.5 mb-1.5 flex justify-between items-center text-pink-500">
                        <span>[PIXEL INSPECTOR]</span>
                        <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></span>
                      </div>
                      <div className="flex justify-between"><span>LATITUDE:</span><span className="font-bold">{radarHover.lat.toFixed(6)}° S</span></div>
                      <div className="flex justify-between"><span>LONGITUDE:</span><span className="font-bold">{radarHover.lon.toFixed(6)}° E</span></div>
                      <div className="border-t border-cyan-500/10 my-1"></div>
                      <div className="flex justify-between"><span>ELEVATION:</span><span className="text-emerald-400">{elev.toFixed(1)} m</span></div>
                      <div className="flex justify-between"><span>SLOPE:</span><span className="text-yellow-400">{slope.toFixed(2)}°</span></div>
                      <div className="flex justify-between"><span>TERRAIN:</span><span className="text-pink-400 font-bold text-[7px]">{terrainType}</span></div>
                      <div className="border-t border-cyan-500/10 my-1"></div>
                      <div className="flex justify-between"><span>BACKSCATTER:</span><span className="text-amber-400">{(10 * Math.log10(backscatterVal + 0.0001)).toFixed(2)} dB</span></div>
                      <div className="flex justify-between"><span>CPR (RATIO):</span><span className="text-purple-400">{(cprVal * radarGain).toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>DOP (POLAR):</span><span className="text-sky-400">{dopVal.toFixed(4)}</span></div>
                      <div className="flex justify-between border-t border-cyan-500/10 pt-1 mt-1 text-[9px] text-white"><span>PIXEL VALUE:</span><span className="font-bold">{pixelVal} DN</span></div>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom: Dedicated Radar Analysis Telemetry Stats Panel */}
              <div className="mt-2.5 p-2.5 bg-black/95 border border-cyan-500/20 rounded font-mono text-[8px] space-y-2 text-cyan-400">
                <div className="text-[9px] font-bold border-b border-cyan-500/20 pb-1 mb-1.5 flex justify-between items-center text-white">
                  <span>DFSAR EXTRACTION SUMMARY & ANALYTICS</span>
                  <span className="text-[7px] text-pink-400 opacity-80">CHANDRAYAAN-2 / L3 SYSTEM</span>
                </div>
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Average CPR Ratio</div>
                    <div className="text-[10px] font-bold text-white mt-0.5">{radarMetrics.avgCpr.toFixed(3)}</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Average DOP index</div>
                    <div className="text-[10px] font-bold text-white mt-0.5">{radarMetrics.avgDop.toFixed(3)}</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Max H2O Ice Score</div>
                    <div className="text-[10px] font-bold text-pink-500 mt-0.5">{radarMetrics.maxIceScore.toFixed(3)}</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Ice Volatiles coverage</div>
                    <div className="text-[10px] font-bold text-sky-400 mt-0.5">{radarMetrics.coveragePercent.toFixed(1)} %</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2.5 text-center mt-1">
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Estimated Ice Pixels</div>
                    <div className="text-[9px] text-white mt-0.5">{radarMetrics.estimatedIcePixels.toLocaleString()} px</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">SAR Quality Score</div>
                    <div className="text-[9px] text-emerald-400 mt-0.5">{radarMetrics.radarQuality}</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Telemetry Overhead</div>
                    <div className="text-[9px] text-white mt-0.5">{radarMetrics.processingTime} ms</div>
                  </div>
                  <div className="bg-cyan-950/20 p-1.5 border border-cyan-500/10 rounded">
                    <div className="opacity-60 uppercase text-[7px]">Confidence Rating</div>
                    <div className="text-[9px] text-emerald-400 mt-0.5">{radarMetrics.confidenceScore} %</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Radar Sidebar / Control Deck */}
            <div className={`w-72 shrink-0 border p-3 flex flex-col gap-2.5 text-[9px] bg-black/90 rounded overflow-y-auto ${isGlitch ? 'border-[#00ffff]/30' : 'border-slate-700 shadow-2xl'}`}>
              <div className="font-bold border-b pb-1 mb-1 text-[10px] flex items-center gap-1 text-white uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
                <span>DFSAR SCIENTIFIC CONSOLE</span>
              </div>

              {/* Action Pipeline Box */}
              <div className="bg-cyan-950/10 border border-cyan-500/20 p-2.5 rounded space-y-2">
                <span className="opacity-60 uppercase font-bold text-[8px] text-white">Analysis Pipeline Actions:</span>
                <button
                  onClick={runRadarAnalysis}
                  disabled={radarAnalysisState === 'ANALYZING'}
                  className={`w-full font-bold uppercase py-1.5 px-2.5 rounded border text-[10px] flex items-center justify-center gap-2 transition-all ${
                    radarAnalysisState === 'ANALYZING'
                      ? 'bg-cyan-950/30 text-cyan-600 border-cyan-500/10 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-900 to-cyan-700 hover:from-cyan-800 hover:to-cyan-600 text-white border-cyan-400/50 shadow-[0_0_8px_rgba(0,255,255,0.15)] active:scale-95'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>{radarAnalysisState === 'ANALYZING' ? 'PROCESSING PIPELINE...' : 'RUN RADAR ANALYSIS'}</span>
                </button>
                {getRadarLoadingVisualization()}
              </div>

              {/* Dataset select */}
              <div className="space-y-1 bg-black/30 p-2 border border-cyan-500/10 rounded">
                <span className="opacity-60 uppercase font-mono text-[8px] text-white">RADAR RASTER TARGET LAYER:</span>
                <select 
                  value={radarDataset} 
                  onChange={(e) => {
                    setRadarDataset(e.target.value as any);
                    addLog(`Radar active dataset shifted: ${e.target.value}`, 'SAR');
                  }}
                  className="w-full bg-black border border-cyan-500/30 p-1.5 text-[9px] text-cyan-400 rounded outline-none"
                >
                  <option value="DFSAR_BACKSCATTER">DFSAR Backscatter (S-band)</option>
                  <option value="CPR">CPR (Circular Polarisation Ratio)</option>
                  <option value="DOP">DOP (Degree of Polarisation)</option>
                  <option value="INCIDENCE_ANGLE">Radar Incidence Angle (θ)</option>
                  <option value="CONFIDENCE">Radar Quality Confidence Layer</option>
                  <option value="COMPOSITE">DFSAR Multi-Band RGB Composite</option>
                </select>
              </div>

              {/* Colormap Select */}
              <div className="space-y-1 bg-black/30 p-2 border border-cyan-500/10 rounded">
                <span className="opacity-60 uppercase font-mono text-[8px] text-white">Color Ramping Model:</span>
                <select 
                  value={radarColormap} 
                  onChange={(e) => {
                    setRadarColormap(e.target.value as any);
                    addLog(`Colormap model changed: ${e.target.value}`, 'SYSTEM');
                  }}
                  className="w-full bg-black border border-cyan-500/30 p-1.5 text-[9px] text-cyan-400 rounded outline-none"
                >
                  <option value="Gray">Grayscale (Orthochromatic)</option>
                  <option value="Blue">Blue Intensity Palette</option>
                  <option value="Viridis">Viridis GIS Standard</option>
                  <option value="Inferno">Inferno Thermal Range</option>
                  <option value="Engineering Blue">Engineering Deep Cyan-Blue</option>
                </select>
              </div>

              {/* Threshold Option Selection */}
              <div className="space-y-1.5 bg-black/30 p-2 border border-cyan-500/10 rounded">
                <div className="flex justify-between text-[8px]">
                  <span className="opacity-60 uppercase text-white font-bold">ICE PROBABILITY THRESHOLD:</span>
                  <span className="font-bold text-pink-400">≥ {(iceThreshold * 100).toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.30, 0.50, 0.70, 0.90].map((tVal) => (
                    <button
                      key={tVal}
                      onClick={() => {
                        setIceThreshold(tVal);
                        addLog(`Interactive volatile detection threshold adjusted to: ${(tVal * 100).toFixed(0)}%`, 'SYSTEM');
                      }}
                      className={`py-1 text-[8px] border font-bold rounded transition-all ${
                        iceThreshold === tVal
                          ? 'bg-pink-500 text-white border-pink-400'
                          : 'bg-cyan-950/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10'
                      }`}
                    >
                      {(tVal * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider for Gain */}
              <div className="space-y-1 bg-black/30 p-2 border border-cyan-500/10 rounded">
                <div className="flex justify-between text-[8px] opacity-65 text-white">
                  <span>RADAR SIGNAL GAIN MULTIPLIER:</span>
                  <span className="font-bold text-cyan-400">{radarGain.toFixed(1)}X</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.5" 
                  step="0.1" 
                  value={radarGain} 
                  onChange={(e) => setRadarGain(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400 cursor-ew-resize"
                />
              </div>

              {/* Speckle Filter Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer bg-black/30 p-2 border border-cyan-500/10 rounded">
                <input 
                  type="checkbox" 
                  checked={radarNoiseFilter} 
                  onChange={(e) => {
                    setRadarNoiseFilter(e.target.checked);
                    addLog(`Radar speckle noise filter: ${e.target.checked ? 'ENGAGED' : 'BYPASSED'}`, 'SAR');
                  }}
                  className="rounded border-cyan-500 text-cyan-500 focus:ring-0 accent-cyan-400 w-3 h-3 cursor-pointer"
                />
                <span className="opacity-70 font-mono text-[8px] text-white font-bold">ENGAGE MICROWAVE SPECKLE FILTER</span>
              </label>

              {/* Real-time Histogram Container */}
              <div className="flex-1 flex flex-col pt-2 border-t border-cyan-500/20 bg-black/40 p-2 rounded border border-cyan-500/10">
                <div className="flex justify-between items-center mb-1">
                  <span className="opacity-60 font-mono text-[8px] text-white uppercase">FREQUENCY DISTRIBUTION:</span>
                  <span className="text-[7px] text-pink-400 font-bold uppercase">HISTOGRAM</span>
                </div>
                
                {/* Tabs */}
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {(['BACKSCATTER', 'CPR', 'DOP', 'ICE_PROB'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveHistTab(tab)}
                      className={`text-[6px] py-0.5 border transition-all truncate font-bold uppercase rounded ${
                        activeHistTab === tab
                          ? 'bg-cyan-500 text-black border-cyan-400'
                          : 'bg-black/80 text-cyan-500 border-cyan-500/20 hover:bg-cyan-900/10'
                      }`}
                    >
                      {tab === 'BACKSCATTER' ? 'B-SCAT' : tab === 'ICE_PROB' ? 'ICE_PR' : tab}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <canvas
                    id="radar-hist-canvas"
                    ref={renderRadarHistogram}
                    width={180}
                    height={75}
                    onMouseMove={handleHistMouseMove}
                    onMouseLeave={() => setHoveredHistBin(null)}
                    className="w-full bg-black/80 border border-cyan-500/20 rounded cursor-crosshair"
                  />
                  
                  {hoveredHistBin && (
                    <div className="absolute top-1 left-1 bg-black/95 border border-cyan-500/50 p-1 text-[7px] font-mono rounded pointer-events-none text-white leading-tight">
                      <div>BIN: {hoveredHistBin.range}</div>
                      <div>QTY: {hoveredHistBin.value} px</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Export Tools Panel */}
              <div className="p-2 border border-cyan-500/20 rounded bg-cyan-950/10 space-y-1.5">
                <span className="opacity-60 uppercase font-bold text-[8px] text-white">GIS Space Export Tools:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => triggerExport('ICE_PROB')}
                    className="py-1 px-1.5 bg-black hover:bg-cyan-950 text-[7px] border border-cyan-500/30 text-cyan-400 font-bold rounded flex items-center justify-center gap-1 transition-all"
                  >
                    <span>GeoTIFF (Ice)</span>
                  </button>
                  <button
                    onClick={() => triggerExport('COMPOSITE')}
                    className="py-1 px-1.5 bg-black hover:bg-cyan-950 text-[7px] border border-cyan-500/30 text-cyan-400 font-bold rounded flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Composite Tif</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => triggerExport('PNG')}
                    className="py-1 px-1.5 bg-black hover:bg-cyan-950 text-[7px] border border-cyan-500/30 text-cyan-400 font-bold rounded flex items-center justify-center gap-1 transition-all"
                  >
                    <span>PNG Viewport</span>
                  </button>
                  <button
                    onClick={() => triggerExport('GEOJSON')}
                    className="py-1 px-1.5 bg-black hover:bg-cyan-950 text-[7px] border border-cyan-500/30 text-cyan-400 font-bold rounded flex items-center justify-center gap-1 transition-all"
                  >
                    <span>GeoJSON Meta</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 3: 3D TERRAIN VIEW */}
        {viewMode === '3D' && (
          <div id="terrain-3d-viewport" className="w-full h-full absolute inset-0 p-3 flex gap-3">
            {/* 3D Canvas */}
            <div className={`flex-1 border p-1 relative bg-black/40 ${isGlitch ? 'border-[#00ffff]/30' : 'border-gray-500'}`}>
              <canvas
                id="terrain-3d-canvas"
                ref={topoCanvasRef}
                width={640}
                height={440}
                className="w-full h-full block"
              />
            </div>

            {/* 3D Sidebar Control */}
            <div className={`w-52 shrink-0 border p-3 flex flex-col gap-3.5 text-[10px] bg-black/50 ${isGlitch ? 'border-[#00ffff]/30' : 'border-gray-500'}`}>
              <div className="font-bold border-b pb-1 mb-1 text-[11px] flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>3D ORBITAL CONTROLS</span>
              </div>

              {/* RotateYaw */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-65">
                  <span>ROTATE YAW:</span>
                  <span className="font-bold">{rot3d}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={rot3d} 
                  onChange={(e) => setRot3d(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400"
                />
              </div>

              {/* RotatePitch */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-65">
                  <span>ROTATE PITCH / TILT:</span>
                  <span className="font-bold">{tilt3d}°</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="85" 
                  value={tilt3d} 
                  onChange={(e) => setTilt3d(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400"
                />
              </div>

              {/* Zoom */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-65">
                  <span>CAMERA ZOOM:</span>
                  <span className="font-bold">{zoom3d.toFixed(1)}X</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="3.5" 
                  step="0.1" 
                  value={zoom3d} 
                  onChange={(e) => setZoom3d(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400"
                />
              </div>

              {/* Vertical Exaggeration */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-65">
                  <span>VERT EXAGGERATION:</span>
                  <span className="font-bold">{exaggerate3d.toFixed(1)}X</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="5.0" 
                  step="0.2" 
                  value={exaggerate3d} 
                  onChange={(e) => setExaggerate3d(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400"
                />
              </div>

              {/* Sun Azimuth */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-65">
                  <span>SUN AZIMUTH:</span>
                  <span className="font-bold">{sunAzimuth3d}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={sunAzimuth3d} 
                  onChange={(e) => setSunAzimuth3d(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 appearance-none rounded accent-cyan-400"
                />
              </div>

              <div className="text-[8px] opacity-50 font-mono leading-tight pt-2 border-t border-current/10">
                MESH ENGINE: LOLA DEM RASTER INTERPOLATOR ACTIVE. ROTATION MATRICES COMPILING OK.
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: ELEVATION PROFILE CHART */}
        {viewMode === 'PROFILE' && (
          <div id="profile-chart-viewport" className="w-full h-full absolute inset-0 p-3 flex gap-3">
            {/* Chart */}
            <div className={`flex-1 border p-1 relative bg-black/40 ${isGlitch ? 'border-[#00ffff]/30' : 'border-gray-500'}`}>
              <canvas
                id="elevation-profile-canvas"
                ref={profileCanvasRef}
                width={640}
                height={440}
                className="w-full h-full block cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scaleX = e.currentTarget.width / rect.width;
                  setHoverProfileX((e.clientX - rect.left) * scaleX);
                }}
                onMouseLeave={() => setHoverProfileX(null)}
              />
            </div>

            {/* Profile Sidebar */}
            <div className={`w-52 shrink-0 border p-3 flex flex-col gap-3 text-[10px] bg-black/50 ${isGlitch ? 'border-[#00ffff]/30' : 'border-gray-500'}`}>
              <div className="font-bold border-b pb-1 mb-1 text-[11px] flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>PROFILE CONTROLS</span>
              </div>

              {/* Transect select */}
              <div className="space-y-1">
                <span className="opacity-60 uppercase font-mono text-[9px]">Select Transect:</span>
                <select 
                  value={profileTransect} 
                  onChange={(e) => {
                    setProfileTransect(e.target.value as any);
                    addLog(`Active profile transect shifted: ${e.target.value}`, 'ALGO');
                  }}
                  className="w-full bg-black/80 border border-current p-1.5 text-[9px]"
                >
                  <option value="Standard">Lander to Shackleton S9 Floor</option>
                  <option value="Waypoints">Planned Rover Route Traverse</option>
                  {customLineCoords && <option value="Custom">Custom Map Drawn Transect</option>}
                </select>
              </div>

              {/* Draw button */}
              <button
                onClick={() => {
                  setViewMode('MAP');
                  setIsDrawingProfile(true);
                  setCustomLineCoords(null);
                  addLog("Map Transect drawing routine engaged. Awaiting pointer inputs on map...", "MAP");
                }}
                className={`w-full py-1.5 px-3 border uppercase font-mono text-[9px] font-bold tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                  isGlitch 
                    ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-400 hover:text-black' 
                    : 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                }`}
              >
                <Pencil className="w-3 h-3" />
                <span>DRAW NEW PROFILE</span>
              </button>

              {/* Metrics Readout Panel */}
              <div className="border-t pt-2.5 border-current/10 flex-1 space-y-2 font-mono text-[9px] leading-relaxed">
                <span className="opacity-60 uppercase text-[8px] font-bold">Scientific Transect Meta:</span>
                <div className="space-y-1">
                  <div>MAX_ELEV: {profileTransect === 'Standard' ? '2240m' : profileTransect === 'Waypoints' ? '1850m' : 'Dynamic'}</div>
                  <div>MIN_ELEV: {profileTransect === 'Standard' ? '-6100m' : profileTransect === 'Waypoints' ? '-3400m' : 'Dynamic'}</div>
                  <div className="text-red-500 font-bold">HAZARD CROSSINGS DETECTED</div>
                  <div className="text-[8px] text-amber-500 leading-snug">Red shaded vertical strips inside the chart highlight regions where local slope exceeds safety margin (&gt;15°).</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom HUD cursor display coordinates inside map (Visible for MAP mode) */}
        {viewMode === 'MAP' && (
          <div
            id="map-reticle-coordinates"
            className={`absolute bottom-4 right-4 pointer-events-none p-3 border text-[10px] font-mono leading-tight z-10 min-w-[210px] ${
              isGlitch
                ? 'bg-black/90 border-[#00ffff] text-[#00ffff] shadow-[0_0_15px_rgba(0,255,255,0.15)]'
                : 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-lg'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold border-b pb-1 mb-1.5 border-current">
              <Maximize2 className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span className="tracking-wider uppercase">LUNAR GIS INSPECTOR</span>
            </div>
            
            {hoverMapCoords && workspace ? (() => {
              const elev = getElevationAt(hoverMapCoords.gx, hoverMapCoords.gy);
              const slope = getSlopeAt(hoverMapCoords.gx, hoverMapCoords.gy, workspace.zoom);
              const cprVal = getNormalizedCPR(hoverMapCoords.gx, hoverMapCoords.gy);
              const dopVal = getNormalizedDOP(hoverMapCoords.gx, hoverMapCoords.gy);
              const backscatterVal = getNormalizedBackscatter(hoverMapCoords.gx, hoverMapCoords.gy);
              
              const pixelIntensity = Math.floor(
                (elev * 0.05 + 200) + (hash2D(Math.floor(hoverMapCoords.gx * 10000), Math.floor(hoverMapCoords.gy * 10000)) * 20)
              );
              const pixelDN = Math.min(255, Math.max(0, pixelIntensity));
              
              const latDir = cursorCoords ? (cursorCoords.lat < 0 ? 'S' : 'N') : 'S';
              const lonDir = cursorCoords ? (cursorCoords.lon < 0 ? 'W' : 'E') : 'E';
              const absLat = cursorCoords ? Math.abs(cursorCoords.lat).toFixed(6) : '0.000000';
              const absLon = cursorCoords ? Math.abs(cursorCoords.lon).toFixed(6) : '0.000000';

              const terrainType = elev < -4000 ? 'PSR Cold Trap Basin' : slope > 15 ? 'Severe Hazard Sloped Wall' : slope > 5 ? 'Highland Traverse' : 'Lander-Safe Plain';

              return (
                <div className="space-y-1">
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">LATITUDE:</span>
                    <span className="font-bold">{absLat}° {latDir}</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">LONGITUDE:</span>
                    <span className="font-bold">{absLon}° {lonDir}</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">ELEVATION:</span>
                    <span className={`font-bold ${elev < -4000 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      {elev.toFixed(1)} m
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">SURFACE SLOPE:</span>
                    <span className={`font-bold ${slope > 15 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {slope.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">TERRAIN TYPE:</span>
                    <span className="font-bold text-pink-500 uppercase text-[9px]">{terrainType}</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">PIXEL VALUE (DN):</span>
                    <span className="font-bold">{pixelDN} DN</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">CPR (RATIO):</span>
                    <span className="font-bold text-purple-400">{(cprVal * radarGain).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">DOP (POLARIZATION):</span>
                    <span className="font-bold text-cyan-400">{dopVal.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between border-b border-current/10 pb-1">
                    <span className="opacity-60 font-mono text-[8px]">BACKSCATTER (dB):</span>
                    <span className="font-bold text-amber-400">{(10 * Math.log10(backscatterVal + 0.0001)).toFixed(2)} dB</span>
                  </div>
                  <div className="flex justify-between text-[8px] opacity-50 pt-1">
                    <span>SUN_AZ: {sunAzimuth3d}°</span>
                    <span>SUN_EL: {sunElevation3d}°</span>
                  </div>
                </div>
              );
            })() : (
              <div className="space-y-1 py-1 text-center opacity-50">
                <p>HOVER RETICLE TO INSPECT</p>
                <p className="text-[8px]">SECTOR: SHACKLETON-S9</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Bottom System Console */}
      <div
        id="gis-terminal-console"
        className={`border-t flex flex-col font-mono text-[10px] transition-all overflow-hidden shrink-0 ${
          isConsoleExpanded ? 'h-32' : 'h-7'
        } ${
          isGlitch
            ? 'bg-[#040812] border-[#00ffff]/20 text-cyan-400'
            : 'bg-[#fafafa] border-[#ccc] text-gray-700'
        }`}
      >
        {/* Terminal Header Bar */}
        <div
          id="terminal-header"
          onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
          className={`px-3 py-1 border-b flex items-center justify-between cursor-pointer select-none shrink-0 ${
            isGlitch ? 'bg-[#0b101d] border-b-[#00ffff]/15' : 'bg-[#e5e7eb] border-b-[#ccc]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wider">
            <Terminal className="w-3.5 h-3.5" />
            <span>GIS ENGINE CONSOLE LOGS</span>
          </div>
          <div className="flex items-center gap-1">
            {isConsoleExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </div>
        </div>

        {/* Terminal Text Log Area */}
        {isConsoleExpanded && (
          <div
            id="terminal-log-area"
            className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-[9px] leading-relaxed selection:bg-cyan-500 selection:text-black"
          >
            {consoleLogs.map((log, index) => (
              <div key={index} className="truncate">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

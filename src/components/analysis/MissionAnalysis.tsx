/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { mapCoordsToLunar } from '../../utils/lunarGenerator';
import {
  Compass,
  MapPin,
  Activity,
  Maximize2,
  FileText,
  Clock,
  Shield,
  Radio,
  Battery,
  Sun,
  AlertTriangle,
  Play,
  FileSpreadsheet,
  Download,
  Cpu,
  Layers
} from 'lucide-react';

export const MissionAnalysis: React.FC = () => {
  const { 
    workspace, 
    cursorCoords, 
    selectedLayerId, 
    layers, 
    theme,
    landingAnalysis,
    setSelectedCandidateId,
    activeTab,
    traverseAnalysis,
    setTraverseTarget
  } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  // Find currently selected layer details
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || layers[layers.length - 1];

  const getStatusColor = (status: typeof workspace.status) => {
    switch (status) {
      case 'Active Planning':
        return isGlitch ? 'text-emerald-400 border-emerald-500/40' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'Simulation':
        return isGlitch ? 'text-amber-400 border-amber-500/40' : 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Locked':
        return isGlitch ? 'text-rose-400 border-rose-500/40' : 'text-rose-600 bg-rose-50 border-rose-200';
      default:
        return 'text-gray-500';
    }
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    window.dispatchEvent(new CustomEvent('lunar-log', { 
      detail: { msg: `LSE data export successful: ${filename}`, source: 'SYSTEM' } 
    }));
  };

  const exportLandingReport = () => {
    const header = `========================================================\n` +
                   `          CHANDRAYAAN-2 LUNAR LANDING SITE EVALUATION   \n` +
                   `               SAC GEOPROCESSING ALGO OUT / PDS4        \n` +
                   `========================================================\n` +
                   `Date: ${new Date().toISOString()}\n` +
                   `Target Region: ${workspace.targetCrater}\n` +
                   `Projection: ${workspace.projection}\n\n` +
                   `CONSTRAINTS APPLIED:\n` +
                   `- Max Allowable Slope: ${landingAnalysis.constraints.slopeMax}°\n` +
                   `- Max Hazard Index: ${landingAnalysis.constraints.hazardMax}\n` +
                   `- Min H2O Ice Probability: ${landingAnalysis.constraints.iceMin * 100}%\n` +
                   `- Min Sun Illumination: ${landingAnalysis.constraints.illumMin}%\n` +
                   `- Max Distance to PSR: ${landingAnalysis.constraints.psrRadiusMax}m\n\n` +
                   `MCDA FORMULA WEIGHTS:\n` +
                   `Score = 30% Ice + 25% Safety + 20% Illum + 15% Roughness + 10% PSR Proximity\n\n` +
                   `--------------------------------------------------------\n` +
                   `RANKED CANDIDATE SITES SUMMARY:\n` +
                   `--------------------------------------------------------\n` +
                   landingAnalysis.candidates.map(c => 
                     `Rank #${c.rank}: ${c.name} (ID: ${c.id})\n` +
                     `  - Coords: Lat ${c.coords.lat.toFixed(6)}°S, Lon ${c.coords.lon.toFixed(6)}°E\n` +
                     `  - Final MCDA Score: ${(c.score * 100).toFixed(2)}%\n` +
                     `  - Slope Angle: ${c.slope.toFixed(2)}°\n` +
                     `  - Hazard Index: ${c.hazardIndex.toFixed(3)}\n` +
                     `  - Ice Probability: ${(c.iceProbability * 100).toFixed(1)}%\n` +
                     `  - Solar Illum: ${(c.illumination * 100).toFixed(1)}%\n` +
                     `  - Dist to PSR: ${c.distanceToPSR.toFixed(1)}m\n` +
                     `  - Target Terrain: ${c.terrainType}\n`
                   ).join('\n') +
                   `========================================================\n` +
                   `              END OF LSE SYSTEM REPORT                  \n` +
                   `========================================================\n`;
    downloadFile(header, `Chandrayaan_LSE_MCDA_Report.txt`, 'text/plain');
  };

  const exportGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      metadata: {
        generator: "CryoPlan LSE MCDA Solver",
        target: workspace.targetCrater,
        crs: "EPSG:4326"
      },
      features: landingAnalysis.candidates.map(c => ({
        type: "Feature",
        id: c.id,
        geometry: {
          type: "Point",
          coordinates: [c.coords.lon, -c.coords.lat]
        },
        properties: {
          name: c.name,
          rank: c.rank,
          score: c.score,
          slope_deg: c.slope,
          hazard_index: c.hazardIndex,
          ice_prob: c.iceProbability,
          illumination: c.illumination,
          psr_distance_m: c.distanceToPSR,
          terrain_type: c.terrainType,
          elevation_m: c.elevation
        }
      }))
    };
    downloadFile(JSON.stringify(geojson, null, 2), `Chandrayaan_LSE_Candidates.geojson`, 'application/json');
  };

  const exportCSV = () => {
    let csv = "Rank,ID,Name,Latitude,Longitude,Score,Slope_Deg,Hazard_Index,Ice_Prob,Illum_Pct,PSR_Dist_M,Elevation_M,Terrain_Type\n";
    landingAnalysis.candidates.forEach(c => {
      csv += `${c.rank},${c.id},"${c.name}",-${c.coords.lat},${c.coords.lon},${(c.score * 100).toFixed(2)},${c.slope.toFixed(2)},${c.hazardIndex.toFixed(3)},${(c.iceProbability * 100).toFixed(2)},${(c.illumination * 100).toFixed(2)},${c.distanceToPSR.toFixed(1)},${c.elevation.toFixed(1)},"${c.terrainType}"\n`;
    });
    downloadFile(csv, `Chandrayaan_LSE_MCDA_Matrix.csv`, 'text/csv');
  };

  const exportMissionSummary = () => {
    const summary = {
      mission: "Chandrayaan-2 LSE Extension",
      timestamp_utc: new Date().toISOString(),
      evaluation_parameters: landingAnalysis.constraints,
      ranked_count: landingAnalysis.candidates.length,
      primary_candidate: landingAnalysis.candidates[0] || null,
      full_candidates_list: landingAnalysis.candidates
    };
    downloadFile(JSON.stringify(summary, null, 2), `Chandrayaan_LSE_Mission_Summary.json`, 'application/json');
  };

  const exportTraverseReport = () => {
    const header = `========================================================\n` +
                   `          PRAGYAN ROVER AUTONOMOUS MOBILITY PLANNER      \n` +
                   `               SAC NAVIGATION OPTIMISATION LAB          \n` +
                   `========================================================\n` +
                   `Date: ${new Date().toISOString()}\n` +
                   `Target Destination: ${traverseAnalysis.selectedTargetName}\n` +
                   `Search Engine: ${traverseAnalysis.algorithm}\n` +
                   `Optimisation Mode: ${traverseAnalysis.mode}\n\n` +
                   `TRAVERSE ANALYSIS METRICS:\n` +
                   `- Total Traverse Distance: ${traverseAnalysis.totalDistanceKm.toFixed(3)} km\n` +
                   `- Estimated Travel Time: ${(traverseAnalysis.estimatedDurationSeconds / 3600).toFixed(2)} hours\n` +
                   `- Average Rover Velocity: ${traverseAnalysis.avgSpeedKmh.toFixed(4)} km/h\n` +
                   `- Maximum Terrain Slope: ${traverseAnalysis.maxSlopeDeg}°\n` +
                   `- Net Battery Consumption: ${traverseAnalysis.batteryConsumptionPct}%\n` +
                   `- Solar Insolation Exposure: ${traverseAnalysis.solarExposurePct}%\n` +
                   `- Hazard Exposure Rating: ${traverseAnalysis.hazardExposureScore}\n` +
                   `- Success Margin: ${(traverseAnalysis.successProbability * 100).toFixed(0)}%\n\n` +
                   `--------------------------------------------------------\n` +
                   `WAYPOINT LOGS:\n` +
                   `--------------------------------------------------------\n` +
                   traverseAnalysis.waypoints.map(w => 
                     `Waypoint ID: ${w.id} - ${w.name}\n` +
                     `  - Coordinates: Lat ${w.coords.lat.toFixed(6)}°S, Lon ${w.coords.lon.toFixed(6)}°E\n` +
                     `  - Accumulated Distance: ${w.distance.toFixed(3)} km\n` +
                     `  - Terrain Slope: ${w.slope.toFixed(1)}°\n` +
                     `  - Elevation: ${w.elevation} m\n` +
                     `  - Local Hazard Index: ${w.hazardRating.toFixed(3)}\n` +
                     `  - Scheduled Arrival: ${w.arrivalTime}\n` +
                     `  - Estimated Battery: ${w.batteryRemaining}%\n`
                   ).join('\n') +
                   `========================================================\n` +
                   `             END OF ROVER NAVIGATION REPORT             \n` +
                   `========================================================\n`;
    downloadFile(header, `Pragyan_Rover_Traverse_Report.txt`, 'text/plain');
  };

  const exportWaypointCSV = () => {
    let csv = `WaypointID,Name,Latitude,Longitude,Distance_km,Slope_deg,Elevation_m,HazardRating,ArrivalTime,BatteryRemaining\n`;
    traverseAnalysis.waypoints.forEach(w => {
      csv += `"${w.id}","${w.name}",${w.coords.lat.toFixed(6)},${w.coords.lon.toFixed(6)},${w.distance},${w.slope},${w.elevation},${w.hazardRating},"${w.arrivalTime}",${w.batteryRemaining}\n`;
    });
    downloadFile(csv, `Pragyan_Rover_Waypoints.csv`, 'text/csv');
  };

  const exportTimelineJSON = () => {
    const data = {
      mission: "Chandrayaan-3 Pragyan Rover",
      destination: traverseAnalysis.selectedTargetName,
      algorithm: traverseAnalysis.algorithm,
      mode: traverseAnalysis.mode,
      metrics: {
        totalDistanceKm: traverseAnalysis.totalDistanceKm,
        durationSeconds: traverseAnalysis.estimatedDurationSeconds,
        batteryConsumptionPct: traverseAnalysis.batteryConsumptionPct,
        successProbability: traverseAnalysis.successProbability
      },
      timeline: traverseAnalysis.timeline
    };
    downloadFile(JSON.stringify(data, null, 2), `Pragyan_Rover_Timeline.json`, 'application/json');
  };

  const exportGeoJSONPath = () => {
    const coordinates = traverseAnalysis.path.map(pt => {
      const latLon = mapCoordsToLunar((pt.gx - 0.5) * 40075016, (0.5 - pt.gy) * 40075016);
      return [latLon.lon, latLon.lat];
    });

    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            mission: "Chandrayaan-3 Pragyan Rover Traverse",
            destination: traverseAnalysis.selectedTargetName,
            algorithm: traverseAnalysis.algorithm,
            mode: traverseAnalysis.mode,
            distanceKm: traverseAnalysis.totalDistanceKm
          },
          geometry: {
            type: "LineString",
            coordinates: coordinates
          }
        },
        ...traverseAnalysis.waypoints.map(wp => ({
          type: "Feature",
          properties: {
            id: wp.id,
            name: wp.name,
            distanceKm: wp.distance,
            batteryPct: wp.batteryRemaining
          },
          geometry: {
            type: "Point",
            coordinates: [wp.coords.lon, wp.coords.lat]
          }
        }))
      ]
    };
    downloadFile(JSON.stringify(geojson, null, 2), `Pragyan_Rover_Traverse_Path.geojson`, 'application/json');
  };

  const exportMissionPDF = () => {
    const pdfDoc = `========================================================\n` +
                   `     PDF EXPORT: PRAGYAN MISSION EXECUTIVE SUMMARY       \n` +
                   `          INDIAN SPACE RESEARCH ORGANISATION            \n` +
                   `========================================================\n\n` +
                   `MISSION SUMMARY:\n` +
                   `- Operations Area: Shackleton-9 South Pole Region\n` +
                   `- Selected Landing Site: ${workspace.targetCrater}\n` +
                   `- Path Destination target: ${traverseAnalysis.selectedTargetName}\n` +
                   `- Flight Clearance Status: COMPLETED\n\n` +
                   `ROVER RECONNAISSANCE TELEMETRY MATRIX:\n` +
                   `--------------------------------------------------------\n` +
                   `Total Distance  : ${traverseAnalysis.totalDistanceKm.toFixed(3)} km\n` +
                   `Estimated Time  : ${(traverseAnalysis.estimatedDurationSeconds / 3600).toFixed(2)} hours\n` +
                   `Maximum Slope   : ${traverseAnalysis.maxSlopeDeg}°\n` +
                   `Net Battery Draw: ${traverseAnalysis.batteryConsumptionPct}%\n` +
                   `Solar Charge Lux: ${traverseAnalysis.solarExposurePct}%\n` +
                   `Risk Level      : ${traverseAnalysis.hazardExposureScore}\n` +
                   `Compliance      : ISRO CLASS-1 FLIGHT CERTIFIED\n\n` +
                   `CHRONOLOGICAL ROADMAP:\n` +
                   `--------------------------------------------------------\n` +
                   traverseAnalysis.timeline.map(t => 
                     `[${t.time}] ${t.name}\n` +
                     `  └─ Dist: ${t.distance} km | Battery: ${t.battery}% | ${t.description}`
                   ).join('\n\n') +
                   `\n========================================================\n` +
                   `               END OF PDF SUMMARY TRANSMISSION           \n` +
                   `========================================================\n`;
    downloadFile(pdfDoc, `Pragyan_Rover_Mission_Summary_PDF.txt`, 'text/plain');
  };

  return (
    <div
      id="mission-analysis-container"
      className={`h-full flex flex-col transition-colors ${
        isGlitch
          ? 'bg-[#040710] border-l border-[#00ffff]/30 text-[#00ffff] font-mono'
          : 'bg-white border-l border-[#ccc] text-[#1a1a1a] font-sans'
      }`}
    >
      {/* Panel Header */}
      <div
        id="mission-analysis-header"
        className={`px-2 py-1 border-b flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider select-none ${
          isGlitch ? 'bg-[#0d1624] border-b-[#00ffff]/30' : 'bg-[#f3f4f6] border-b-[#ccc]'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span>Mission Analysis</span>
      </div>

      {/* Main Content Area */}
      <div id="mission-analysis-content" className="flex-1 overflow-y-auto p-2 space-y-3 select-none text-[11px]">
        {/* Section 1: Active Workspace Telemetry */}
        <div id="analysis-section-workspace" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60">
            <FileText className="w-3 h-3" />
            <span>Identity Details</span>
          </div>

          <div
            id="workspace-metadata-box"
            className={`p-2 border text-[11px] space-y-2 ${
              isGlitch ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-[#ccc]'
            }`}
          >
            <div>
              <div className="text-[9px] opacity-50 uppercase font-bold">PROJECT IDENTIFIER</div>
              <div className="font-bold truncate leading-tight mt-0.5" title={workspace.name}>
                {workspace.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">ANALYST_CODE</div>
                <div className="font-semibold text-[10px] truncate leading-tight">
                  ISRO_SAC / SCI_A
                </div>
              </div>
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">STAMP_UTC</div>
                <div className="font-mono text-[9px] leading-tight flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">2026-07-01</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-1.5 border-current/10">
              <div className="text-[9px] opacity-50 uppercase font-bold">CARTOGRAPHIC PROJECTION</div>
              <div className="font-semibold text-[10px] truncate leading-normal mt-0.5" title={workspace.projection}>
                {workspace.projection}
              </div>
            </div>

            <div className="border-t pt-1.5 border-current/10 flex items-center justify-between">
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">CURRENT STATUS</div>
                <div className="text-[10px] font-bold uppercase mt-0.5">{workspace.status}</div>
              </div>
              <span
                id="workspace-status-badge"
                className={`px-1.5 py-0.5 text-[8px] font-bold border ${getStatusColor(workspace.status)}`}
              >
                ● {workspace.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Real-time Cursor Coordinates Stream */}
        <div id="analysis-section-coordinates" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60">
            <Compass className="w-3 h-3" />
            <span>LUNAR TELEMETRY STREAM</span>
          </div>

          <div
            id="cursor-telemetry-box"
            className={`p-2 border text-[11px] space-y-2 ${
              isGlitch ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-[#ccc]'
            }`}
          >
            <div>
              <div className="text-[9px] opacity-50 uppercase font-bold">FOCAL LUNAR CRATER</div>
              <div className="font-semibold leading-tight flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">{workspace.targetCrater}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">MAP ZOOM LEVEL</div>
                <div className="font-mono font-bold text-[10px] mt-0.5">ZOOM {workspace.zoom}</div>
              </div>
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">MAP RATIO SCALE</div>
                <div className="font-mono font-bold text-[10px] mt-0.5">{workspace.scale}</div>
              </div>
            </div>

            <div className="border-t pt-1.5 border-current/10">
              <div className="text-[9px] opacity-50 uppercase font-bold">CUR_PROBE_COORDINATES</div>
              {cursorCoords ? (
                <div id="realtime-coordinates-display" className="font-mono text-[10px] leading-tight space-y-0.5 mt-1">
                  <div className="flex justify-between">
                    <span className="opacity-60">LATITUDE:</span>
                    <span className="font-bold text-current">
                      {cursorCoords.lat.toFixed(6)}° S
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-60">LONGITUDE:</span>
                    <span className="font-bold text-current">
                      {cursorCoords.lon.toFixed(6)}° E
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[9px] opacity-40 italic mt-1">
                  Move pointer over the active cartographic map to track telemetry.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Sensor Layer Meta */}
        {selectedLayer && (
          <div id="analysis-section-sensor" className="space-y-1.5">
            <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60">
              <Radio className="w-3 h-3" />
              <span>SENSOR OVERLAY ANALYSIS</span>
            </div>

            <div
              id="selected-layer-metadata-box"
              className={`p-2 border text-[11px] space-y-2 ${
                isGlitch ? 'bg-[#0a0f1d] border-slate-800' : 'bg-white border-[#ccc]'
              }`}
            >
              <div>
                <div className="text-[9px] opacity-50 uppercase font-bold">ACTIVE SELECTED LAYER</div>
                <div className="font-bold text-[10px] leading-snug mt-0.5" id="analysis-selected-layer-name">
                  {selectedLayer.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
                <div>
                  <div className="text-[9px] opacity-50 uppercase font-bold">GROUP CLASS</div>
                  <div className="text-[10px] font-semibold truncate leading-tight mt-0.5">
                    {selectedLayer.group}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] opacity-50 uppercase font-bold">RENDER_TRANSP</div>
                  <div className="font-mono text-[10px] font-bold leading-tight mt-0.5">
                    {Math.round(selectedLayer.opacity * 100)}%
                  </div>
                </div>
              </div>

              <div className="border-t pt-1.5 border-current/10">
                <div className="text-[9px] opacity-50 uppercase font-bold">INSTRUMENT DESCRIPTION</div>
                <p className="text-[9px] leading-relaxed opacity-85 mt-1 italic">
                  {selectedLayer.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: DFSAR Radar Analytics */}
        <div id="analysis-section-radar" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60">
            <Radio className="w-3 h-3 text-pink-500 animate-pulse" />
            <span>DFSAR Radar Analytics</span>
          </div>

          <div
            className={`p-2 border text-[11px] space-y-2 ${
              isGlitch ? 'bg-[#0a0f1d] border-slate-800 text-cyan-400' : 'bg-white border-[#ccc] text-slate-700'
            }`}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">AVG CPR RATIO:</span>
                <span className="font-bold text-white text-[10px]">0.380</span>
              </div>
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">AVG DOP INDEX:</span>
                <span className="font-bold text-white text-[10px]">0.420</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">MAX ICE PROB:</span>
                <span className="font-bold text-pink-500 text-[10px]">89.0 %</span>
              </div>
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">EST ICE COVERAGE:</span>
                <span className="font-bold text-sky-400 text-[10px]">18.2 %</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">RADAR CONFIDENCE:</span>
                <span className="font-bold text-emerald-400 text-[10px]">95.8% (EXC)</span>
              </div>
              <div>
                <span className="text-[8px] opacity-60 block uppercase font-mono">PROCESS STATUS:</span>
                <span className="font-bold text-cyan-400 text-[10px]">READY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Dynamic Evaluation Inspector depending on activeTab */}
        {activeTab !== 'Traverse' ? (
          <div id="analysis-section-landing-site" className="space-y-1.5 border-t pt-2 border-current/10">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider opacity-60">
              <div className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>Lunar Landing Safety Envelope</span>
              </div>
              {landingAnalysis.status === 'COMPLETED' && (
                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 font-mono">
                  MCDA SYSTEM READY
                </span>
              )}
            </div>

            {landingAnalysis.status === 'ANALYZING' && (
              <div className={`p-3 border text-center font-mono space-y-3 ${isGlitch ? 'bg-black/40 border-cyan-500/30 text-cyan-400' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
                <div className="text-[9px] uppercase tracking-widest text-emerald-400 animate-pulse">
                  [ RUNNING MULTI-CRITERIA DECISION SOLVER ]
                </div>
                <div className="text-[12px] font-bold">
                  EVALUATION IN PROGRESS: {landingAnalysis.progress}%
                </div>
                <div className="h-2 w-full bg-slate-800 p-[1px] border border-slate-700">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300" style={{ width: `${landingAnalysis.progress}%` }} />
                </div>
                <p className="text-[8px] text-left opacity-75 truncate uppercase">
                  {landingAnalysis.currentStep}
                </p>
                <div className="text-[7px] text-right text-gray-500 animate-pulse">
                  SCANNING DEM, SLOPE, ROUGHNESS, HAZARDS, PSR, SOLAR LUX...
                </div>
              </div>
            )}

            {landingAnalysis.status === 'COMPLETED' && (
              <div className="space-y-2.5">
                {/* LANDING INSPECTOR */}
                {(() => {
                  const selectedSite = landingAnalysis.candidates.find(c => c.id === landingAnalysis.selectedCandidateId) || landingAnalysis.candidates[0];
                  if (!selectedSite) return null;

                  const isSlopeSafe = selectedSite.slope <= landingAnalysis.constraints.slopeMax;
                  const isHazardSafe = selectedSite.hazardIndex <= landingAnalysis.constraints.hazardMax;
                  const isIceHigh = selectedSite.iceProbability >= landingAnalysis.constraints.iceMin;
                  const isIllumSafe = (selectedSite.illumination * 100) >= landingAnalysis.constraints.illumMin;
                  const isPsrOptimal = selectedSite.distanceToPSR <= landingAnalysis.constraints.psrRadiusMax;

                  return (
                    <div className={`p-2 border space-y-2 ${isGlitch ? 'bg-[#0a0f1d] border-slate-800' : 'bg-slate-50 border-[#ccc]'}`}>
                      <div className="flex items-center justify-between border-b border-current/10 pb-1.5">
                        <div>
                          <div className="text-[8px] opacity-60 font-mono">SELECTED ENVELOPE</div>
                          <div className="font-bold text-[11px] text-white flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            {selectedSite.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] opacity-60 font-mono">MCDA SCORE</div>
                          <div className="font-bold text-[11px] text-pink-500">
                            {(selectedSite.score * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-mono">
                        <div>
                          <span className="text-[8px] opacity-50 block uppercase">LATITUDE:</span>
                          <span className="font-bold text-gray-300">{selectedSite.coords.lat.toFixed(6)}° S</span>
                        </div>
                        <div>
                          <span className="text-[8px] opacity-50 block uppercase">LONGITUDE:</span>
                          <span className="font-bold text-gray-300">{selectedSite.coords.lon.toFixed(6)}° E</span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">SURFACE SLOPE:</span>
                          <span className={`font-bold ${isSlopeSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedSite.slope.toFixed(2)}° {isSlopeSafe ? '(SAFE)' : '(HIGH)'}
                          </span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">HAZARD INDEX:</span>
                          <span className={`font-bold ${isHazardSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedSite.hazardIndex.toFixed(3)} {isHazardSafe ? '(SAFE)' : '(CRITICAL)'}
                          </span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">ICE PROBABILITY:</span>
                          <span className={`font-bold ${isIceHigh ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {(selectedSite.iceProbability * 100).toFixed(1)}% {isIceHigh ? '(HIGH)' : '(LOW)'}
                          </span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">SOLAR ILLUM:</span>
                          <span className={`font-bold ${isIllumSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {(selectedSite.illumination * 100).toFixed(1)}% {isIllumSafe ? '(STABLE)' : '(LOW)'}
                          </span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">DISTANCE TO PSR:</span>
                          <span className={`font-bold ${isPsrOptimal ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedSite.distanceToPSR.toFixed(0)}m {isPsrOptimal ? '(OPTIMAL)' : '(TOO FAR)'}
                          </span>
                        </div>
                        <div className="border-t border-current/5 pt-1">
                          <span className="text-[8px] opacity-50 block uppercase">ELEVATION:</span>
                          <span className="font-bold text-sky-400">{selectedSite.elevation.toFixed(1)} m</span>
                        </div>
                      </div>

                      <div className="border-t border-current/10 pt-1.5 text-[9px]">
                        <span className="text-[8px] opacity-50 block uppercase">TARGET TERRAIN CLASS:</span>
                        <p className="font-semibold text-emerald-400 italic">"{selectedSite.terrainType}"</p>
                      </div>
                    </div>
                  );
                })()}

                {/* RANKED MATRIX TABLE */}
                <div className={`p-1.5 border ${isGlitch ? 'bg-black/30 border-slate-800' : 'bg-white border-[#ccc]'}`}>
                  <div className="text-[8px] font-bold opacity-60 mb-1 uppercase font-mono tracking-wider">
                    MCDA TOP-10 RANKED LANDING CANDIDATES:
                  </div>
                  <div className="max-h-[110px] overflow-y-auto space-y-1 pr-0.5">
                    {landingAnalysis.candidates.map((cand) => {
                      const isSelected = cand.id === landingAnalysis.selectedCandidateId;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => {
                            setSelectedCandidateId(cand.id);
                            window.dispatchEvent(new CustomEvent('lunar-log', {
                              detail: { msg: `Site selection shifted to LSE-${cand.id} (${cand.name}).`, source: 'ALGO' }
                            }));
                          }}
                          className={`flex items-center justify-between p-1 cursor-pointer transition-all border ${
                            isSelected
                              ? isGlitch
                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 font-bold'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-transparent border-transparent hover:bg-slate-800/40'
                          }`}
                        >
                          <span className="font-mono text-[9px] flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400 animate-ping' : 'bg-emerald-600/60'}`} />
                            #{cand.rank}: {cand.name}
                          </span>
                          <span className="font-mono text-[9px]">
                            {(cand.score * 100).toFixed(1)}% Score
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* EXPORT OPTIONS BAR */}
                <div className="space-y-1">
                  <div className="text-[8px] font-bold opacity-50 uppercase font-mono tracking-wider">
                    CARTOGRAPHIC EXPORT TERMINAL:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={exportLandingReport}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export full engineering text report"
                    >
                      Export Report (TXT)
                    </button>
                    <button
                      onClick={exportGeoJSON}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-pink-500/40 bg-pink-950/20 text-pink-400 hover:bg-pink-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export candidate spatial coordinates as standard GeoJSON"
                    >
                      Export GeoJSON
                    </button>
                    <button
                      onClick={exportCSV}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-yellow-500/40 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export candidates matrix as spreadsheet-compatible CSV"
                    >
                      Export CSV Matrix
                    </button>
                    <button
                      onClick={exportMissionSummary}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export structural JSON summary of mission parameter evaluations"
                    >
                      Export JSON Summary
                    </button>
                  </div>
                </div>
              </div>
            )}

            {landingAnalysis.status === 'IDLE' && (
              <div
                className={`p-2.5 border text-[10px] space-y-2 ${
                  isGlitch ? 'bg-[#0a0f1d] border-slate-800 text-cyan-400' : 'bg-white border-[#ccc] text-slate-700'
                }`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">SURFACE SLOPE:</span>
                    <span className="font-bold text-white text-[10px]">&lt; 15.0° (SAFE)</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">ROUGHNESS INDEX:</span>
                    <span className="font-bold text-white text-[10px]">0.08 m (LOW)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">TERRAIN HAZARDS:</span>
                    <span className="font-bold text-emerald-400 text-[10px]">NONE DETECTED</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">DESCENT ΔV BUDGET:</span>
                    <span className="font-bold text-pink-500 text-[10px]">1,680 m/s</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">SAFE LAUNCH WINDOW:</span>
                    <span className="font-bold text-white text-[10px]">JULY 14, 2026</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">SHADOW ILLUM:</span>
                    <span className="font-bold text-yellow-400 text-[10px]">18% SOLAR LUX</span>
                  </div>
                </div>

                <div className="border-t pt-1.5 border-current/10">
                  <span className="text-[8px] opacity-60 block uppercase font-mono">TARGET LANDER MASS:</span>
                  <span className="font-bold text-white text-[10px]">1,726 kg (CY-3 ENVELOPE)</span>
                </div>

                <div className="border-t pt-2 border-dashed border-cyan-500/20 text-[9px] text-amber-400 font-mono animate-pulse">
                  Awaiting LSE Evaluation sequence. Select "Landing Safety Envelope" tab in the Ribbon Toolbar and trigger "RUN MULTI-CRITERIA SITE SELECTION" to generate candidate envelopes on the map.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div id="analysis-section-rover-traverse" className="space-y-2 border-t pt-2 border-current/10 animate-fadeIn">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider opacity-60">
              <div className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>Pragyan Mobility Plan</span>
              </div>
              {traverseAnalysis.status === 'COMPLETED' && (
                <span className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.5 font-mono">
                  TRAVERSE ACTIVE
                </span>
              )}
            </div>

            {traverseAnalysis.status === 'IDLE' && (
              <div
                className={`p-2.5 border text-[10px] space-y-2 ${
                  isGlitch ? 'bg-[#0a0f1d] border-slate-800 text-cyan-400' : 'bg-white border-[#ccc] text-slate-700'
                }`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">ROVER NET MASS:</span>
                    <span className="font-bold text-white text-[10px]">26 kg</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">CHASSIS CLEARANCE:</span>
                    <span className="font-bold text-white text-[10px]">150 mm (6-Wheel Rocker-Bogie)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t pt-1.5 border-current/10">
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">MAX VELOCITY:</span>
                    <span className="font-bold text-emerald-400 text-[10px]">1 cm/sec (Autonomous)</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-60 block uppercase font-mono">COMMS LINK:</span>
                    <span className="font-bold text-pink-500 text-[10px]">Direct-to-Lander S-Band</span>
                  </div>
                </div>

                <div className="border-t pt-2 border-dashed border-cyan-500/20 text-[9px] text-amber-400 font-mono animate-pulse">
                  Select "Pragyan Mobility Plan" tab in the Ribbon Toolbar and click "GENERATE AUTONOMOUS ROVER TRAVERSE" to initiate the A*/Dijkstra optimal pathfinding solver across lunar slope, hazard, and illumination grids.
                </div>
              </div>
            )}

            {traverseAnalysis.status === 'ANALYZING' && (
              <div className={`p-3 border text-center font-mono space-y-3 ${isGlitch ? 'bg-black/40 border-amber-500/30 text-amber-400' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
                <div className="text-[9px] uppercase tracking-widest text-amber-400 animate-pulse">
                  [ RUNNING AUTONOMOUS KINEMATIC PATHFINDER ]
                </div>
                <div className="text-[12px] font-bold">
                  SOLVER STATUS: {traverseAnalysis.progress}%
                </div>
                <div className="h-2 w-full bg-slate-800 p-[1px] border border-slate-700">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300" style={{ width: `${traverseAnalysis.progress}%` }} />
                </div>
                <p className="text-[8px] text-left opacity-75 truncate uppercase">
                  {traverseAnalysis.currentStep}
                </p>
              </div>
            )}

            {traverseAnalysis.status === 'COMPLETED' && (
              <div className="space-y-2.5">
                {/* Traverse Metrics Grid */}
                <div className={`p-2 border space-y-2 ${isGlitch ? 'bg-[#0a0f1d] border-slate-800' : 'bg-slate-50 border-[#ccc]'}`}>
                  <div className="flex items-center justify-between border-b border-current/10 pb-1.5">
                    <div>
                      <div className="text-[8px] opacity-60 font-mono">PATH PROTOCOL</div>
                      <div className="font-bold text-[10px] text-white uppercase">
                        {traverseAnalysis.algorithm} / {traverseAnalysis.mode} MODE
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] opacity-60 font-mono">SUCCESS MARGIN</div>
                      <div className="font-bold text-[11px] text-emerald-400">
                        {(traverseAnalysis.successProbability * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-mono">
                    <div>
                      <span className="text-[8px] opacity-50 block uppercase">TOTAL DISTANCE:</span>
                      <span className="font-bold text-white">{traverseAnalysis.totalDistanceKm.toFixed(3)} km</span>
                    </div>
                    <div>
                      <span className="text-[8px] opacity-50 block uppercase">TRAVEL TIME:</span>
                      <span className="font-bold text-white">{(traverseAnalysis.estimatedDurationSeconds / 3600).toFixed(2)} hrs</span>
                    </div>
                    <div className="border-t border-current/5 pt-1">
                      <span className="text-[8px] opacity-50 block uppercase">MAX CLIMB SLOPE:</span>
                      <span className="font-bold text-amber-400">{traverseAnalysis.maxSlopeDeg.toFixed(1)}°</span>
                    </div>
                    <div className="border-t border-current/5 pt-1">
                      <span className="text-[8px] opacity-50 block uppercase">AVG ROVER SPEED:</span>
                      <span className="font-bold text-sky-400">{(traverseAnalysis.avgSpeedKmh * 1000 / 3600 * 100).toFixed(2)} cm/s</span>
                    </div>
                    <div className="border-t border-current/5 pt-1 col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-[8px] opacity-50 block uppercase">BATTERY STATUS:</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Battery className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-amber-400">{100 - traverseAnalysis.batteryConsumptionPct}% remaining</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] opacity-50 block uppercase">SOLAR INSOLATION:</span>
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <Sun className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="font-bold text-yellow-400">{traverseAnalysis.solarExposurePct}% solar exposure</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Waypoints List */}
                <div className={`p-1.5 border ${isGlitch ? 'bg-black/30 border-slate-800' : 'bg-white border-[#ccc]'}`}>
                  <div className="text-[8px] font-bold opacity-60 mb-1 uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>GENERATED NAVIGATION WAYPOINTS:</span>
                    <span className="text-[7px] opacity-50">CLICK TO TEST LOGS</span>
                  </div>
                  <div className="max-h-[110px] overflow-y-auto space-y-1 pr-0.5">
                    {traverseAnalysis.waypoints.map((wp) => (
                      <div
                        key={wp.id}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('lunar-log', {
                            detail: { msg: `Selected Waypoint ${wp.id} (${wp.name}). Lat: ${wp.coords.lat.toFixed(6)}°S, Lon: ${wp.coords.lon.toFixed(6)}°E. Terrain Slope: ${wp.slope.toFixed(1)}°. Battery: ${wp.batteryRemaining}%.`, source: 'TELEMETRY' }
                          }));
                        }}
                        className={`flex items-center justify-between p-1 cursor-pointer transition-all border border-slate-800 bg-transparent hover:bg-slate-800/40`}
                      >
                        <span className="font-mono text-[9px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          {wp.id}: {wp.name}
                        </span>
                        <span className="font-mono text-[9px] text-cyan-400">
                          {wp.distance.toFixed(3)} km
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 8: Mission Timeline Log */}
                <div className={`p-1.5 border ${isGlitch ? 'bg-black/30 border-slate-800' : 'bg-white border-[#ccc]'}`}>
                  <div className="text-[8px] font-bold opacity-60 mb-1 uppercase font-mono tracking-wider">
                    CHRONOLOGICAL MISSION TIMELINE EVENTS:
                  </div>
                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-0.5">
                    {traverseAnalysis.timeline.map((event, idx) => (
                      <div key={idx} className="border-l-2 border-amber-500 pl-2 py-0.5 font-mono text-[9px] space-y-0.5">
                        <div className="flex justify-between font-bold text-amber-400">
                          <span>[{event.time}] {event.name}</span>
                          <span>{event.battery}% BAT</span>
                        </div>
                        <p className="text-[8px] text-gray-400 leading-snug">{event.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cartographic Export Terminal */}
                <div className="space-y-1">
                  <div className="text-[8px] font-bold opacity-50 uppercase font-mono tracking-wider">
                    CARTOGRAPHIC EXPORT TERMINAL:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={exportTraverseReport}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export complete engineering traverse text report"
                    >
                      Export Report (TXT)
                    </button>
                    <button
                      onClick={exportGeoJSONPath}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-pink-500/40 bg-pink-950/20 text-pink-400 hover:bg-pink-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export dynamic path coordinates as GeoJSON LineString"
                    >
                      Export GeoJSON Path
                    </button>
                    <button
                      onClick={exportWaypointCSV}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-yellow-500/40 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export navigation waypoints as spreadsheet-compatible CSV"
                    >
                      Export Waypoints (CSV)
                    </button>
                    <button
                      onClick={exportTimelineJSON}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate block ${
                        isGlitch
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export chronological timeline events as structural JSON"
                    >
                      Export Timeline (JSON)
                    </button>
                    <button
                      onClick={exportMissionPDF}
                      className={`px-1.5 py-1 text-[9px] font-mono border rounded-none cursor-pointer transition-colors text-center uppercase truncate col-span-2 block ${
                        isGlitch
                          ? 'border-orange-500/40 bg-orange-950/20 text-orange-400 hover:bg-orange-500 hover:text-black'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Export complete mission executive summary as a print-ready document"
                    >
                      Export Mission Summary (PDF)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div
        id="mission-analysis-footer"
        className={`px-3 py-2 border-t text-[10px] select-none ${
          isGlitch
            ? 'bg-[#0a0f1d] border-t-[#00ffff]/20 text-cyan-500/80'
            : 'bg-gray-100 border-t-gray-200 text-gray-500'
        }`}
      >
        <div className="flex items-center gap-1 font-semibold uppercase tracking-wider mb-0.5">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          ISRO Safety Compliance:
        </div>
        <p className="leading-tight opacity-75">
          Plan conforms to Space Applications Centre ground telemetry standards.
        </p>
      </div>
    </div>
  );
};

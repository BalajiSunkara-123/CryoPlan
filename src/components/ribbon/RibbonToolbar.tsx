/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { generateLandingCandidates } from '../../utils/lunarGenerator';
import {
  FolderOpen,
  Save,
  FilePlus,
  Settings,
  Sliders,
  Info,
  Clock,
  Compass,
  Zap,
  Activity,
  Layers,
  MapPin,
  Mountain,
  Map,
  Grid
} from 'lucide-react';

export const RibbonToolbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setActiveDialog,
    theme,
    workspace,
    recentProjects,
    loadProject,
    landingAnalysis,
    setLandingConstraints,
    setLandingAnalysisState,
    setLandingCandidates,
    traverseAnalysis,
    setTraverseAlgorithm,
    setTraverseMode,
    setTraverseTarget,
    runTraverseAnalysis
  } = useWorkstationStore();

  const isGlitch = theme === 'Retro-Futurist Glitch';

  const tabs = [
    { id: 'Mission', label: 'Mission Operations' },
    { id: 'Radar Analysis', label: 'DFSAR Radar Analysis' },
    { id: 'Terrain', label: 'LOLA Topography' },
    { id: 'Landing', label: 'Landing Safety Envelope' },
    { id: 'Traverse', label: 'Pragyan Mobility Plan' },
    { id: 'Resources', label: 'Lunar Volatiles/H2O' },
    { id: 'Reports', label: 'Mission Reports' },
    { id: 'Export', label: 'Cartographic Export' }
  ];

  const handleNewWorkspace = () => {
    if (confirm('Create a new workspace? This will reset the current configuration.')) {
      loadProject('Untitled Lunar Mission Workspace');
    }
  };

  const runLandingSiteAnalysis = () => {
    const triggerLog = (msg: string, source = 'SYSTEM') => {
      window.dispatchEvent(new CustomEvent('lunar-log', { detail: { msg, source } }));
    };

    triggerLog('Initiating Safe Landing Site Evaluation (LSE) analysis workflow...', 'ALGO');
    setLandingAnalysisState('ANALYZING', 0, 'Running Landing Analysis...');
    
    setTimeout(() => {
      triggerLog('Loading Lunar Reconnaissance Orbiter (LRO) LOLA Digital Elevation Model (DEM)...', 'IO');
      setLandingAnalysisState('ANALYZING', 15, '██░░░░░░░░ Computing Slope Matrix...');
    }, 800);

    setTimeout(() => {
      triggerLog('DEM loaded. Calculating surface slope gradients & aspect factors...', 'ALGO');
      setLandingAnalysisState('ANALYZING', 35, '████░░░░░░ Generating Multi-Criteria Hazard Map...');
    }, 1600);

    setTimeout(() => {
      triggerLog('Surface Roughness (local elevation variance) and boulder hazards computed.', 'ALGO');
      setLandingAnalysisState('ANALYZING', 55, '██████░░░░ Simulating Sun Angle Illumination...');
    }, 2400);

    setTimeout(() => {
      const az = (window as any).lunarSunAzimuth ?? 315;
      const el = (window as any).lunarSunElevation ?? 45;
      triggerLog(`Evaluating direct sun illumination at sun vectors (Azimuth: ${az}°, Elevation: ${el}°)...`, 'SOLAR');
      setLandingAnalysisState('ANALYZING', 75, '████████░░ Calculating H2O Volatiles & Ice Probabilities...');
    }, 3200);

    setTimeout(() => {
      triggerLog('Synthesizing Chandrayaan-2 DFSAR CPR/DOP data streams for H2O ice exposure likelihood...', 'SAR');
      setLandingAnalysisState('ANALYZING', 90, '██████████ Executing MCDA Weighted Multi-Criteria Overlay...');
    }, 4000);

    setTimeout(() => {
      triggerLog('Running Multi-Criteria Decision Analysis (MCDA) optimization solver...', 'ALGO');
      triggerLog('Weights: 30% Ice, 25% Safety, 20% Illumination, 15% Roughness, 10% PSR Proximity', 'MCDA');
    }, 4500);

    setTimeout(() => {
      const candidatesList = generateLandingCandidates(landingAnalysis.constraints);
      const bestSite = candidatesList[0] || null;
      
      setLandingCandidates(candidatesList, bestSite);
      setLandingAnalysisState('COMPLETED', 100, 'Mission Ready.');
      
      triggerLog('MCDA Solver complete! 10 landing candidate safety envelopes generated and ranked.', 'ALGO');
      if (bestSite) {
        triggerLog(`PRIMARY LANDING SITE IDENTIFIED: ${bestSite.name} (Rank #1) with score ${(bestSite.score * 100).toFixed(1)}%.`, 'ALGO');
        triggerLog(`LSE-1 Coordinates: Lat ${bestSite.coords.lat.toFixed(6)}°, Lon ${bestSite.coords.lon.toFixed(6)}°. Terrain: ${bestSite.terrainType}.`, 'INFO');
      }
    }, 5000);
  };

  return (
    <div
      id="ribbon-bar"
      className={`transition-colors shrink-0 ${
        isGlitch
          ? 'bg-[#060a12] border-b border-[#00ffff]/30 text-[#00ffff] font-mono'
          : 'bg-[#f3f4f6] border-b border-[#ccc] text-[#1a1a1a] font-sans'
      }`}
    >
      {/* 1. Ribbon Tab Headers */}
      <div
        id="ribbon-tabs"
        className={`flex items-end px-2 gap-px text-[11px] font-medium ${
          isGlitch
            ? 'px-4 gap-1 pt-2 bg-[#060a12] border-b border-[#00ffff]/30'
            : 'h-8 bg-[#e5e7eb] border-b border-[#d1d5db]'
        }`}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              id={`ribbon-tab-${t.id.replace(/\s+/g, '-')}`}
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1 text-[11px] transition-all select-none cursor-pointer ${
                isActive
                  ? isGlitch
                    ? 'bg-[#0d1624] border-t border-x border-[#00ffff]/60 border-b-transparent text-[#00ffff] font-bold shadow-[0_-2px_6px_rgba(0,255,255,0.15)] -mb-[1px] py-1.5'
                    : 'bg-[#fdfdfd] border-t border-x border-[#ccc] text-[#1a1a1a] font-semibold -mb-[1px]'
                  : isGlitch
                    ? 'bg-[#03060c] border-[#00ffff]/10 border-b-[#00ffff]/30 text-gray-500 hover:text-cyan-400 hover:bg-[#080d16] py-1.5'
                    : 'hover:bg-[#ececec] text-[#555] border-t border-x border-transparent'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 2. Ribbon Content Container */}
      <div
        id="ribbon-contents"
        className={`px-4 py-2 flex items-stretch gap-6 min-h-[84px] ${
          isGlitch ? 'bg-[#0d1624]' : 'bg-[#f3f4f6]'
        }`}
      >
        {activeTab === 'Mission' ? (
          <>
            {/* Group 1: File Control */}
            <div
              id="ribbon-group-file"
              className={`flex flex-col pr-4 ${
                isGlitch ? 'border-r border-[#00ffff]/20' : 'border-r border-[#d1d5db]'
              }`}
            >
              <div id="ribbon-group-file-buttons" className="flex items-center gap-4 flex-1">
                {/* New Workspace */}
                <button
                  id="ribbon-btn-new"
                  onClick={handleNewWorkspace}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Create a pristine planning canvas (resets Workspace settings)"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <FilePlus className="w-5 h-5 text-cyan-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">New<br/>Plan</span>
                </button>

                {/* Open Project */}
                <button
                  id="ribbon-btn-open"
                  onClick={() => setActiveDialog('open_project')}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Open an existing Chandrayaan mission study"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <FolderOpen className="w-5 h-5 text-sky-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">Open<br/>Project</span>
                </button>

                {/* Save Project */}
                <button
                  id="ribbon-btn-save"
                  onClick={() => setActiveDialog('save_project')}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Save current waypoints and layer visibilities"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <Save className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">Save<br/>Project</span>
                </button>
              </div>
            </div>

            {/* Group 2: Configuration */}
            <div
              id="ribbon-group-config"
              className={`flex flex-col pr-4 ${
                isGlitch ? 'border-r border-[#00ffff]/20' : 'border-r border-[#d1d5db]'
              }`}
            >
              <div id="ribbon-group-config-buttons" className="flex items-center gap-4 flex-1">
                {/* Workspace Settings */}
                <button
                  id="ribbon-btn-settings"
                  onClick={() => setActiveDialog('workspace_settings')}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Modify target coordinates, projections and analyst references"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <Settings className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">Workspace<br/>Settings</span>
                </button>

                {/* Theme Toggle */}
                <button
                  id="ribbon-btn-theme"
                  onClick={() => setActiveDialog('theme')}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Toggle GUI styles (Light Professional vs. Retro-Futurist Glitch)"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <Sliders className="w-5 h-5 text-fuchsia-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">Software<br/>Theme</span>
                </button>
              </div>
            </div>

            {/* Group 3: Quick Select Project */}
            <div
              id="ribbon-group-recent"
              className={`flex flex-col pr-4 ${
                isGlitch ? 'border-r border-[#00ffff]/20' : 'border-r border-[#d1d5db]'
              }`}
            >
              <div className="flex flex-col justify-center flex-1 min-w-[200px]">
                <label className="text-[10px] uppercase tracking-wider mb-1 font-bold text-gray-500">
                  Recent Projects
                </label>
                <div className="flex flex-col gap-1 items-start">
                  {recentProjects.slice(0, 2).map((proj, i) => (
                    <button
                      key={i}
                      onClick={() => loadProject(proj)}
                      className="text-[11px] text-blue-700 hover:underline cursor-pointer text-left truncate max-w-[260px]"
                      title={proj}
                    >
                      {proj.length > 36 ? proj.substring(0, 36) + '...' : proj}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Group 4: Diagnostics */}
            <div id="ribbon-group-diagnostics" className="flex flex-col">
              <div id="ribbon-group-diagnostics-buttons" className="flex items-center gap-4 flex-1">
                {/* About System */}
                <button
                  id="ribbon-btn-about"
                  onClick={() => setActiveDialog('about')}
                  className="flex flex-col items-center gap-1 group cursor-pointer"
                  title="Metadata, build numbers and tech stack"
                >
                  <div
                    className={`transition-colors ${
                      isGlitch
                        ? 'p-2 border border-transparent group-hover:bg-cyan-950/40 group-hover:border-[#00ffff]/40'
                        : 'w-10 h-10 bg-white border border-[#ccc] flex items-center justify-center group-hover:bg-blue-50'
                    }`}
                  >
                    <Info className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-[10px] text-center leading-tight text-current">System<br/>Info</span>
                </button>

                {/* System Status Indicators */}
                <div className="flex flex-col text-[10px] space-y-1 justify-center pl-2 opacity-85">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                    <span className="text-[10px]">DDS Connection Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                    <span className="text-[10px]">PDS4 Schema Valid</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'Landing' ? (
          <>
            {/* Group 1: Landing Constraints */}
            <div
              className={`flex flex-col pr-4 justify-center ${
                isGlitch ? 'border-r border-[#00ffff]/20' : 'border-r border-[#d1d5db]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Max Slope</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={landingAnalysis.constraints.slopeMax}
                      onChange={(e) => setLandingConstraints({ slopeMax: parseFloat(e.target.value) || 10 })}
                      className="w-12 px-1 py-0.5 text-[10px] font-mono bg-black/50 text-cyan-400 border border-slate-700 focus:outline-none text-center"
                      min="1" max="45"
                    />
                    <span className="text-[8px] opacity-60 font-mono">deg</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Max Hazard</label>
                  <input
                    type="number"
                    step="0.05"
                    value={landingAnalysis.constraints.hazardMax}
                    onChange={(e) => setLandingConstraints({ hazardMax: parseFloat(e.target.value) || 0.35 })}
                    className="w-12 px-1 py-0.5 text-[10px] font-mono bg-black/50 text-cyan-400 border border-slate-700 focus:outline-none text-center"
                    min="0.1" max="1.0"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Min Ice Prob</label>
                  <input
                    type="number"
                    step="0.05"
                    value={landingAnalysis.constraints.iceMin}
                    onChange={(e) => setLandingConstraints({ iceMin: parseFloat(e.target.value) || 0.45 })}
                    className="w-12 px-1 py-0.5 text-[10px] font-mono bg-black/50 text-cyan-400 border border-slate-700 focus:outline-none text-center"
                    min="0.0" max="1.0"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Min Illum</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={landingAnalysis.constraints.illumMin}
                      onChange={(e) => setLandingConstraints({ illumMin: parseFloat(e.target.value) || 35 })}
                      className="w-12 px-1 py-0.5 text-[10px] font-mono bg-black/50 text-cyan-400 border border-slate-700 focus:outline-none text-center"
                      min="0" max="100"
                    />
                    <span className="text-[8px] opacity-60 font-mono">%</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Max PSR Dist</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={landingAnalysis.constraints.psrRadiusMax}
                      onChange={(e) => setLandingConstraints({ psrRadiusMax: parseInt(e.target.value) || 2000 })}
                      className="w-16 px-1 py-0.5 text-[10px] font-mono bg-black/50 text-cyan-400 border border-slate-700 focus:outline-none text-center"
                      min="500" max="10000"
                    />
                    <span className="text-[8px] opacity-60 font-mono">m</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Run Controls */}
            <div className="flex items-center gap-4 pl-4 flex-1">
              <button
                onClick={runLandingSiteAnalysis}
                disabled={landingAnalysis.status === 'ANALYZING'}
                className={`px-4 py-2 text-[10px] font-bold font-mono border select-none cursor-pointer transition-all flex items-center gap-2 ${
                  landingAnalysis.status === 'ANALYZING'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed animate-pulse'
                    : isGlitch
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${landingAnalysis.status === 'ANALYZING' ? 'animate-spin text-emerald-400' : ''}`} />
                <span>
                  {landingAnalysis.status === 'ANALYZING'
                    ? `ANALYZING ENVELOPE [${landingAnalysis.progress}%]...`
                    : 'RUN MULTI-CRITERIA SITE SELECTION (MCDA)'}
                </span>
              </button>

              {landingAnalysis.status === 'ANALYZING' && (
                <div className="flex-1 max-w-[200px] space-y-1.5 pl-2">
                  <div className="text-[8px] font-mono text-cyan-400 uppercase animate-pulse truncate">
                    {landingAnalysis.currentStep}
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 border border-slate-700 p-[1px]">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${landingAnalysis.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {landingAnalysis.status === 'COMPLETED' && (
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 px-2 py-1">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>10 ENVELOPES IDENTIFIED & RANKED</span>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'Traverse' ? (
          <>
            {/* Group 1: Path Targets */}
            <div
              className={`flex flex-col pr-4 justify-center ${
                isGlitch ? 'border-r border-[#00ffff]/20' : 'border-r border-[#d1d5db]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Scientific Target</label>
                  <select
                    value={traverseAnalysis.selectedTargetName}
                    onChange={(e) => setTraverseTarget(e.target.value)}
                    className="w-44 px-1.5 py-0.5 text-[10px] font-mono bg-black/70 text-cyan-400 border border-slate-700 focus:outline-none h-6"
                  >
                    <option value="Shackleton Crater Rim">Shackleton Crater Rim</option>
                    <option value="Shoemaker Basin">Shoemaker Basin</option>
                    <option value="Nobile Mount">Nobile Mount</option>
                    <option value="Faustini Valle">Faustini Valle</option>
                  </select>
                </div>

                {/* Search Engine Selection */}
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Search Engine</label>
                  <div className="flex border border-slate-700 h-6">
                    <button
                      onClick={() => setTraverseAlgorithm('A*')}
                      className={`px-3 py-0 text-[9px] font-bold font-mono transition-colors ${
                        traverseAnalysis.algorithm === 'A*' 
                          ? 'bg-cyan-500 text-black font-extrabold' 
                          : 'bg-black/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      A*
                    </button>
                    <button
                      onClick={() => setTraverseAlgorithm('Dijkstra')}
                      className={`px-3 py-0 text-[9px] font-bold font-mono transition-colors ${
                        traverseAnalysis.algorithm === 'Dijkstra' 
                          ? 'bg-cyan-500 text-black font-extrabold' 
                          : 'bg-black/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      DIJKSTRA
                    </button>
                  </div>
                </div>

                {/* Optimisation Protocol */}
                <div className="flex flex-col">
                  <label className="text-[8px] uppercase tracking-wider block font-bold text-gray-400 font-mono">Optimisation Protocol</label>
                  <div className="flex border border-slate-700 h-6">
                    {(['SAFEST', 'SHORTEST', 'ENERGY'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setTraverseMode(mode)}
                        className={`px-2.5 py-0 text-[9px] font-bold font-mono transition-colors border-r last:border-r-0 border-slate-700 ${
                          traverseAnalysis.mode === mode 
                            ? 'bg-amber-500 text-black font-extrabold' 
                            : 'bg-black/50 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Run Controls */}
            <div className="flex items-center gap-4 pl-4 flex-1">
              <button
                onClick={runTraverseAnalysis}
                disabled={traverseAnalysis.status === 'ANALYZING'}
                className={`px-4 py-2 text-[10px] font-bold font-mono border select-none cursor-pointer transition-all flex items-center gap-2 ${
                  traverseAnalysis.status === 'ANALYZING'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed animate-pulse'
                    : isGlitch
                      ? 'bg-amber-950/40 border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-black shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-amber-600 border-amber-700 text-white hover:bg-amber-700'
                }`}
              >
                <Compass className={`w-3.5 h-3.5 ${traverseAnalysis.status === 'ANALYZING' ? 'animate-spin text-amber-400' : ''}`} />
                <span>
                  {traverseAnalysis.status === 'ANALYZING'
                    ? `PLANNING TRAVERSE [${traverseAnalysis.progress}%]...`
                    : 'GENERATE AUTONOMOUS ROVER TRAVERSE'}
                </span>
              </button>

              {traverseAnalysis.status === 'ANALYZING' && (
                <div className="flex-1 max-w-[200px] space-y-1.5 pl-2">
                  <div className="text-[8px] font-mono text-cyan-400 uppercase animate-pulse truncate">
                    {traverseAnalysis.currentStep}
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 border border-slate-700 p-[1px]">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                      style={{ width: `${traverseAnalysis.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {traverseAnalysis.status === 'COMPLETED' && (
                <div className="flex items-center gap-2 text-[9px] font-mono text-amber-400 border border-amber-500/30 bg-amber-950/20 px-2 py-1">
                  <Activity className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  <span>TRAVERSE COMPLETED ({traverseAnalysis.totalDistanceKm.toFixed(3)} KM)</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div id="ribbon-placeholder" className="flex items-center gap-4 py-2 pl-4 text-xs">
            <div
              className={`p-1.5 border rounded-none ${
                isGlitch
                  ? 'border-amber-500/50 bg-amber-950/20 text-amber-400'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider">
                {activeTab} Workspace Module
              </div>
              <div className="opacity-75">
                This engineering module is planned for a subsequent development milestone (Milestone 2+).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

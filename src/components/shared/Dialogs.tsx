/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { X, FolderOpen, Save, Settings, Info, Cpu, Globe, Anchor } from 'lucide-react';

export const OpenProjectDialog: React.FC = () => {
  const { activeDialog, setActiveDialog, recentProjects, loadProject, theme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  if (activeDialog !== 'open_project') return null;

  return (
    <div id="dialog-overlay-open" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        id="dialog-container-open"
        className={`w-full max-w-lg border p-6 transition-all shadow-xl ${
          isGlitch
            ? 'bg-[#0a0f1d] border-[#00ffff] text-[#00ffff] font-mono'
            : 'bg-white border-gray-300 text-gray-800 font-sans'
        }`}
      >
        <div id="dialog-header-open" className="flex justify-between items-center border-b pb-3 mb-4 border-current">
          <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            [SYSTEM_LOAD]: LOAD PROJECT WORKSPACE
          </h3>
          <button
            id="close-dialog-open"
            onClick={() => setActiveDialog(null)}
            className={`p-1 hover:opacity-80 transition-opacity cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs mb-4 opacity-80 leading-relaxed">
          Select a SAC (Space Applications Centre) archive file or raw Chandrayaan series telemetry mapping database:
        </p>

        <div id="project-list" className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
          {recentProjects.map((proj, idx) => (
            <button
              id={`proj-btn-${idx}`}
              key={idx}
              onClick={() => loadProject(proj)}
              className={`w-full text-left p-3 border text-xs transition-colors flex items-center justify-between cursor-pointer ${
                isGlitch
                  ? 'border-gray-800 hover:border-[#ff0080] hover:bg-pink-950/20 text-[#00ffff]'
                  : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="font-semibold truncate pr-2">{proj}</div>
              <div className="text-[10px] opacity-60 font-mono shrink-0">
                {idx === 0 ? 'ACTIVE_SET' : 'ARCHIVE_BIN'}
              </div>
            </button>
          ))}
        </div>

        <div id="dialog-footer-open" className="flex justify-end gap-2 pt-2 border-t border-current/20">
          <button
            id="cancel-load-project"
            onClick={() => setActiveDialog(null)}
            className={`px-4 py-1.5 text-xs font-semibold cursor-pointer border ${
              isGlitch
                ? 'border-[#00ffff] hover:bg-[#00ffff]/10 text-[#00ffff]'
                : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            ABORT
          </button>
        </div>
      </div>
    </div>
  );
};

export const SaveProjectDialog: React.FC = () => {
  const { activeDialog, setActiveDialog, workspace, theme, setWorkspaceValue } = useWorkstationStore();
  const [projName, setProjName] = useState(workspace.name);
  const isGlitch = theme === 'Retro-Futurist Glitch';

  if (activeDialog !== 'save_project') return null;

  const handleSave = () => {
    setWorkspaceValue('name', projName);
    setWorkspaceValue('creationDate', new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    setActiveDialog(null);
  };

  return (
    <div id="dialog-overlay-save" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        id="dialog-container-save"
        className={`w-full max-w-md border p-6 transition-all shadow-xl ${
          isGlitch
            ? 'bg-[#0a0f1d] border-[#00ffff] text-[#00ffff] font-mono'
            : 'bg-white border-gray-300 text-gray-800 font-sans'
        }`}
      >
        <div id="dialog-header-save" className="flex justify-between items-center border-b pb-3 mb-4 border-current">
          <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Save className="w-4 h-4" />
            [SYSTEM_WRITE]: SAVE PROJECT STATE
          </h3>
          <button
            id="close-dialog-save"
            onClick={() => setActiveDialog(null)}
            className="p-1 hover:opacity-80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold opacity-80">
              Workspace Filename / Descriptor:
            </label>
            <input
              id="input-project-name"
              type="text"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className={`w-full px-3 py-2 border text-xs focus:outline-hidden ${
                isGlitch
                  ? 'bg-slate-950 border-[#ff0080] text-white font-mono focus:border-[#00ffff]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-500'
              }`}
            />
          </div>

          <div className="p-3 border border-dashed border-current/20 text-[10px] space-y-1 opacity-70">
            <div>TARGET DIR: SAC_WORKSPACE_LOCAL/CHANDRAYAAN/PLANNING/</div>
            <div>SECTOR STAMP: SOUTH_POLE_PSR_09</div>
            <div>STATUS: VERIFIED</div>
          </div>
        </div>

        <div id="dialog-footer-save" className="flex justify-end gap-2">
          <button
            id="cancel-save-project"
            onClick={() => setActiveDialog(null)}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'border-[#00ffff] hover:bg-[#00ffff]/10'
                : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            ABORT
          </button>
          <button
            id="confirm-save-project"
            onClick={handleSave}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'bg-[#ff0080] border-[#ff0080] text-white hover:bg-pink-700'
                : 'bg-gray-800 border-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            WRITE TO DISC
          </button>
        </div>
      </div>
    </div>
  );
};

export const WorkspaceSettingsDialog: React.FC = () => {
  const { activeDialog, setActiveDialog, workspace, setWorkspaceValue, theme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  const [creator, setCreator] = useState(workspace.projectCreator);
  const [projection, setProjection] = useState(workspace.projection);
  const [targetCrater, setTargetCrater] = useState(workspace.targetCrater);

  if (activeDialog !== 'workspace_settings') return null;

  const handleSave = () => {
    setWorkspaceValue('projectCreator', creator);
    setWorkspaceValue('projection', projection);
    setWorkspaceValue('targetCrater', targetCrater);
    setActiveDialog(null);
  };

  return (
    <div id="dialog-overlay-settings" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        id="dialog-container-settings"
        className={`w-full max-w-md border p-6 transition-all shadow-xl ${
          isGlitch
            ? 'bg-[#0a0f1d] border-[#00ffff] text-[#00ffff] font-mono'
            : 'bg-white border-gray-300 text-gray-800 font-sans'
        }`}
      >
        <div id="dialog-header-settings" className="flex justify-between items-center border-b pb-3 mb-4 border-current">
          <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Settings className="w-4 h-4" />
            [SYSTEM_CONFIG]: WORKSPACE SETTINGS
          </h3>
          <button
            id="close-dialog-settings"
            onClick={() => setActiveDialog(null)}
            className="p-1 hover:opacity-80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold opacity-80">
              Responsible Scientist (ISRO / SAC):
            </label>
            <input
              id="input-workspace-creator"
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              className={`w-full px-3 py-1.5 border text-xs focus:outline-hidden ${
                isGlitch
                  ? 'bg-slate-950 border-[#ff0080] text-white font-mono focus:border-[#00ffff]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold opacity-80">
              Cartographic Projection Matrix:
            </label>
            <select
              id="select-projection"
              value={projection}
              onChange={(e) => setProjection(e.target.value)}
              className={`w-full px-3 py-1.5 border text-xs focus:outline-hidden ${
                isGlitch
                  ? 'bg-slate-950 border-[#ff0080] text-white font-mono focus:border-[#00ffff]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-500'
              }`}
            >
              <option value="Lunar South Pole Polar Stereographic (EPSG:30112)">
                Lunar South Pole Polar Stereographic (EPSG:30112)
              </option>
              <option value="Lunar Equidistant Cylindrical (EPSG:30111)">
                Lunar Equidistant Cylindrical (EPSG:30111)
              </option>
              <option value="Lunar Lambert Conformal Conic (EPSG:30113)">
                Lunar Lambert Conformal Conic (EPSG:30113)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold opacity-80">
              Target Crater Focal Center Coordinates:
            </label>
            <input
              id="input-target-crater"
              type="text"
              value={targetCrater}
              onChange={(e) => setTargetCrater(e.target.value)}
              className={`w-full px-3 py-1.5 border text-xs focus:outline-hidden ${
                isGlitch
                  ? 'bg-slate-950 border-[#ff0080] text-white font-mono focus:border-[#00ffff]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-500'
              }`}
            />
          </div>
        </div>

        <div id="dialog-footer-settings" className="flex justify-end gap-2">
          <button
            id="cancel-settings"
            onClick={() => setActiveDialog(null)}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'border-[#00ffff] hover:bg-[#00ffff]/10'
                : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            ABORT
          </button>
          <button
            id="confirm-settings"
            onClick={handleSave}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'bg-[#00ffff] text-black hover:bg-[#00e5e5]'
                : 'bg-gray-800 border-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            COMMIT SETS
          </button>
        </div>
      </div>
    </div>
  );
};

export const ThemeDialog: React.FC = () => {
  const { activeDialog, setActiveDialog, theme, setTheme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  if (activeDialog !== 'theme') return null;

  return (
    <div id="dialog-overlay-theme" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        id="dialog-container-theme"
        className={`w-full max-w-sm border p-6 transition-all shadow-xl ${
          isGlitch
            ? 'bg-[#0a0f1d] border-[#00ffff] text-[#00ffff] font-mono'
            : 'bg-white border-gray-300 text-gray-800 font-sans'
        }`}
      >
        <div id="dialog-header-theme" className="flex justify-between items-center border-b pb-3 mb-4 border-current">
          <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Globe className="w-4 h-4" />
            [THEME_SELECT]: INTERFACE DEVISE
          </h3>
          <button
            id="close-dialog-theme"
            onClick={() => setActiveDialog(null)}
            className="p-1 hover:opacity-80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs mb-4 opacity-80 leading-relaxed">
          Toggle the visual presentation environment:
        </p>

        <div className="space-y-3 mb-6">
          <button
            id="select-theme-light"
            onClick={() => setTheme('Light Professional')}
            className={`w-full p-4 border text-left flex justify-between items-center cursor-pointer ${
              theme === 'Light Professional'
                ? 'border-gray-800 bg-gray-50 text-gray-900 font-bold'
                : 'border-gray-200 hover:border-gray-400 text-gray-500 font-normal'
            }`}
          >
            <div>
              <div className="text-xs font-semibold">Light Professional</div>
              <div className="text-[10px] opacity-75">ISRO SAC Standard Standard Gray UI</div>
            </div>
            {theme === 'Light Professional' && <Anchor className="w-4 h-4" />}
          </button>

          <button
            id="select-theme-glitch"
            onClick={() => setTheme('Retro-Futurist Glitch')}
            className={`w-full p-4 border text-left flex justify-between items-center cursor-pointer ${
              theme === 'Retro-Futurist Glitch'
                ? 'border-[#00ffff] bg-slate-900/60 text-[#00ffff] font-bold font-mono shadow-[0_0_10px_#00ffff44]'
                : 'border-gray-800 hover:border-[#ff0080] text-gray-400 font-mono'
            }`}
          >
            <div>
              <div className="text-xs font-semibold">[RETRO_GLITCH]</div>
              <div className="text-[10px] opacity-75">Glitch Art / Cyan & Magenta CRT Overlay</div>
            </div>
            {theme === 'Retro-Futurist Glitch' && <Cpu className="w-4 h-4 text-[#ff0080]" />}
          </button>
        </div>

        <div id="dialog-footer-theme" className="flex justify-end pt-2 border-t border-current/20">
          <button
            id="close-theme-btn"
            onClick={() => setActiveDialog(null)}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'border-[#00ffff] hover:bg-[#00ffff]/10'
                : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
};

export const AboutDialog: React.FC = () => {
  const { activeDialog, setActiveDialog, theme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  if (activeDialog !== 'about') return null;

  return (
    <div id="dialog-overlay-about" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div
        id="dialog-container-about"
        className={`w-full max-w-md border p-6 transition-all shadow-xl ${
          isGlitch
            ? 'bg-[#0a0f1d] border-[#00ffff] text-[#00ffff] font-mono'
            : 'bg-white border-gray-300 text-gray-800 font-sans'
        }`}
      >
        <div id="dialog-header-about" className="flex justify-between items-center border-b pb-3 mb-4 border-current">
          <h3 className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
            <Info className="w-4 h-4" />
            [SYSTEM_CORE]: ABOUT CRYOPLAN
          </h3>
          <button
            id="close-dialog-about"
            onClick={() => setActiveDialog(null)}
            className="p-1 hover:opacity-80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex gap-4 items-start">
            <div className={`p-2 border rounded-none ${isGlitch ? 'border-[#ff0080]' : 'border-gray-300'}`}>
              <Cpu className={`w-8 h-8 ${isGlitch ? 'text-[#ff0080] animate-pulse' : 'text-gray-600'}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest">CryoPlan Workspace</h2>
              <p className="text-[10px] opacity-70">Integrated Lunar South Pole Mission Planning Workstation</p>
              <p className="text-[10px] opacity-50 mt-1">Milestone Version: 1.0.0 (SAC Stable)</p>
            </div>
          </div>

          <div className="border-t border-dashed border-current/20 pt-3 space-y-2 text-[11px] leading-relaxed">
            <p>
              CryoPlan is the flagship GIS software system engineered by the **ISRO Space Applications Centre (SAC)** in Ahmedabad. It serves as the primary ground integration portal for rover traverse logistics and landing safety assessment.
            </p>
            <p>
              In Milestone 1, the core OpenLayers cartographic canvas has been completed alongside state synchronization routines, laying the foundations for future rover autonomous route optimization modules (Milestone 2) and DFSAR processing filters (Milestone 3).
            </p>
          </div>

          <div className={`p-2 border text-[9px] font-mono leading-tight space-y-0.5 ${isGlitch ? 'bg-slate-950 border-[#ff0080]' : 'bg-gray-50 border-gray-200'}`}>
            <div>BUILD: ISRO-SAC_CRYO_M1_20260701_v1</div>
            <div>ENGINE: OpenLayers 10.3 + Zustand v4</div>
            <div>STATION: Ground Integration Terminal [ACTIVE]</div>
          </div>
        </div>

        <div id="dialog-footer-about" className="flex justify-end pt-2 border-t border-current/20">
          <button
            id="close-about-btn"
            onClick={() => setActiveDialog(null)}
            className={`px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
              isGlitch
                ? 'border-[#00ffff] hover:bg-[#00ffff]/10'
                : 'border-gray-300 hover:bg-gray-100 text-gray-600'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

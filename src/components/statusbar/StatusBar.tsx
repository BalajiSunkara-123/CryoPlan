/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import {
  Compass,
  Map,
  Activity,
  Layers,
  Search,
  CheckCircle,
  Database
} from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { workspace, cursorCoords, selectedLayerId, layers, theme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  // Find currently selected layer details
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  return (
    <div
      id="status-bar"
      className={`h-7 px-4 border-t flex items-center justify-between text-[10px] select-none transition-colors overflow-hidden ${
        isGlitch
          ? 'bg-[#03060c] border-[#00ffff]/20 text-[#00ffff] font-mono shadow-[0_-1px_6px_rgba(0,255,255,0.08)]'
          : 'bg-[#f3f4f6] border-[#ccc] text-[#1a1a1a] font-sans'
      }`}
    >
      {/* Left side: Projection and Scale */}
      <div
        id="status-left"
        className={`flex items-center divide-x h-full ${
          isGlitch ? 'divide-[#00ffff]/15' : 'divide-[#ccc]'
        }`}
      >
        {/* Projection */}
        <div id="status-cell-projection" className="flex items-center gap-1.5 pr-3 h-full">
          <Compass className="w-3.5 h-3.5 text-sky-600" />
          <span className="font-semibold opacity-60">PROJ:</span>
          <span className="truncate max-w-[200px]" title={workspace.projection}>
            {workspace.projection}
          </span>
        </div>

        {/* Scale */}
        <div id="status-cell-scale" className="flex items-center gap-1.5 px-3 h-full">
          <Map className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold opacity-60">SCALE:</span>
          <span className="font-mono">{workspace.scale}</span>
        </div>

        {/* Zoom */}
        <div id="status-cell-zoom" className="flex items-center gap-1.5 px-3 h-full">
          <Search className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-semibold opacity-60">ZOOM:</span>
          <span className="font-mono font-bold">LVL_{workspace.zoom}</span>
        </div>
      </div>

      {/* Middle side: Dynamic Cursor position */}
      <div
        id="status-middle"
        className={`flex items-center divide-x h-full hidden lg:flex ${
          isGlitch ? 'divide-[#00ffff]/15' : 'divide-[#ccc]'
        }`}
      >
        <div id="status-cell-coordinates" className="flex items-center gap-2 px-3 h-full">
          <Activity className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
          <span className="font-semibold opacity-60">CURSOR:</span>
          {cursorCoords ? (
            <span className="font-mono font-bold">
              {cursorCoords.lat.toFixed(5)}° S, {cursorCoords.lon.toFixed(5)}° E
            </span>
          ) : (
            <span className="font-mono opacity-40">POINTER_OUT_OF_BOUNDS</span>
          )}
        </div>
      </div>

      {/* Right side: Selected layer and workstation state */}
      <div
        id="status-right"
        className={`flex items-center divide-x h-full ${
          isGlitch ? 'divide-[#00ffff]/15' : 'divide-[#ccc]'
        }`}
      >
        {/* Active Layer */}
        <div id="status-cell-layer" className="flex items-center gap-1.5 px-3 h-full max-w-[250px]">
          <Layers className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
          <span className="font-semibold opacity-60 truncate">ACTIVE:</span>
          <span className="truncate font-bold text-current" title={selectedLayer?.name}>
            {selectedLayer ? selectedLayer.name : 'NONE_SELECTED'}
          </span>
        </div>

        {/* Sync state */}
        <div id="status-cell-sync" className="flex items-center gap-1.5 pl-3 h-full">
          <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="font-mono flex items-center gap-1 text-[9px] font-bold">
            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
            STATION_SYNC_OK
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { Layer } from '../../types';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Compass,
  Radar,
  Activity,
  Milestone
} from 'lucide-react';

export const LayerManager: React.FC = () => {
  const {
    layers,
    toggleLayerVisibility,
    toggleLayerExpanded,
    setLayerOpacity,
    reorderLayer,
    selectedLayerId,
    setSelectedLayerId,
    theme
  } = useWorkstationStore();

  const isGlitch = theme === 'Retro-Futurist Glitch';

  // Group expansion states
  const [expandedGroups, setExpandedGroups] = useState({
    'Mission': true,
    'Analysis': true,
    'Radar': true,
    'Base Layers': true
  });

  const toggleGroup = (group: keyof typeof expandedGroups) => {
    setExpandedGroups({
      ...expandedGroups,
      [group]: !expandedGroups[group]
    });
  };

  const groups: { id: keyof typeof expandedGroups; label: string; icon: React.ReactNode }[] = [
    { id: 'Mission', label: 'Active Mission Layering', icon: <Milestone className="w-3.5 h-3.5 text-rose-500" /> },
    { id: 'Analysis', label: 'Scientific Hazard Analysis', icon: <Activity className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: 'Radar', label: 'Chandrayaan Radar (DFSAR)', icon: <Radar className="w-3.5 h-3.5 text-purple-500" /> },
    { id: 'Base Layers', label: 'Planetary Base Maps', icon: <Compass className="w-3.5 h-3.5 text-sky-500" /> }
  ];

  const renderLegend = (layer: Layer) => {
    if (layer.legendType === 'single-color') {
      return (
        <div id={`legend-${layer.id}`} className="mt-1 flex items-center gap-2 pl-6">
          <span
            id={`swatch-${layer.id}`}
            className="w-3 h-3 border border-current/20 inline-block shrink-0"
            style={{ backgroundColor: layer.legendColor }}
          />
          <span className="text-[10px] opacity-75 font-semibold">Boundary Indicator</span>
        </div>
      );
    }

    if (layer.legendType === 'color-ramp' && layer.legendColors && layer.legendLabels) {
      return (
        <div id={`legend-${layer.id}`} className="mt-1.5 pl-6 pr-2">
          {/* Color bar */}
          <div
            id={`color-bar-${layer.id}`}
            className="h-2 w-full border border-current/10"
            style={{
              background: `linear-gradient(to right, ${layer.legendColors.join(', ')})`
            }}
          />
          {/* Labels */}
          <div id={`labels-${layer.id}`} className="flex justify-between text-[8px] opacity-70 mt-0.5 font-mono">
            <span>{layer.legendLabels[0]}</span>
            {layer.legendLabels.length > 2 && <span>{layer.legendLabels[1]}</span>}
            <span>{layer.legendLabels[layer.legendLabels.length - 1]}</span>
          </div>
        </div>
      );
    }

    if (layer.legendType === 'radar-intensity') {
      return (
        <div id={`legend-${layer.id}`} className="mt-1.5 pl-6 pr-2">
          {/* Smooth grayscale bar */}
          <div
            id={`radar-bar-${layer.id}`}
            className={`h-2 w-full border border-current/10 ${
              isGlitch
                ? 'bg-gradient-to-right from-black via-cyan-950 to-[#00ffff]'
                : 'bg-gradient-to-right from-black via-gray-500 to-white'
            }`}
          />
          <div id={`radar-labels-${layer.id}`} className="flex justify-between text-[8px] opacity-70 mt-0.5 font-mono">
            <span>0.0 (Null Return)</span>
            <span>1.0 (Saturation)</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      id="layer-manager-container"
      className={`h-full flex flex-col transition-colors ${
        isGlitch
          ? 'bg-[#040710] border-r border-[#00ffff]/30 text-[#00ffff] font-mono'
          : 'bg-white border-r border-[#ccc] text-[#1a1a1a] font-sans'
      }`}
    >
      {/* Panel Header */}
      <div
        id="layer-manager-header"
        className={`px-2 py-1 border-b flex items-center justify-between font-bold text-[11px] uppercase tracking-wider select-none ${
          isGlitch ? 'bg-[#0d1624] border-b-[#00ffff]/30' : 'bg-[#f3f4f6] border-b-[#ccc]'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          Layer Manager
        </span>
        <span className="text-[10px] font-mono opacity-60">
          Z_TILES: {layers.length}
        </span>
      </div>

      {/* Layer Groups Container */}
      <div id="layer-groups-list" className="flex-1 overflow-y-auto p-2 space-y-3 select-none text-[11px]">
        {groups.map((group) => {
          const groupLayers = layers.filter((l) => l.group === group.id);
          const isExpanded = expandedGroups[group.id];

          return (
            <div
              id={`group-container-${group.id as string}`}
              key={group.id}
              className={`mb-3 transition-all`}
            >
              {/* Group Toggle Header */}
              <button
                id={`group-hdr-btn-${group.id as string}`}
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide cursor-pointer text-left focus:outline-hidden mb-1.5`}
              >
                <div className="flex items-center gap-1">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-[#1a1a1a] opacity-80" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[#1a1a1a] opacity-80" />
                  )}
                  <span className={`${isGlitch ? 'text-cyan-400' : 'text-[#1a1a1a]'}`}>{group.id}</span>
                </div>
              </button>

              {/* Group Layer Items */}
              {isExpanded && (
                <div id={`group-items-${group.id as string}`} className="p-1 space-y-1">
                  {groupLayers.length === 0 ? (
                    <div className="text-[10px] opacity-50 p-2 italic">
                      No active indices loaded.
                    </div>
                  ) : (
                    groupLayers.map((layer) => {
                      const isSelected = selectedLayerId === layer.id;
                      return (
                        <div
                          id={`layer-item-${layer.id}`}
                          key={layer.id}
                          className={`border p-2 transition-all ${
                            isSelected
                              ? isGlitch
                                ? 'bg-cyan-950/20 border-cyan-400 shadow-[inset_0_0_8px_rgba(0,255,255,0.15)]'
                                : 'bg-blue-50 border-blue-400'
                              : isGlitch
                                ? 'border-transparent hover:bg-slate-900/40 hover:border-slate-800'
                                : 'border-transparent hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedLayerId(layer.id)}
                        >
                          {/* Title and Toggles Row */}
                          <div id={`layer-row-${layer.id}`} className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-2 flex-1 truncate">
                              {/* Visibility Checkbox */}
                              <input
                                id={`layer-visible-checkbox-${layer.id}`}
                                type="checkbox"
                                checked={layer.visible}
                                onChange={() => {
                                  toggleLayerVisibility(layer.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="accent-blue-600 cursor-pointer h-3.5 w-3.5 shrink-0"
                              />

                              {/* Layer Name */}
                              <span
                                id={`layer-name-${layer.id}`}
                                className={`text-[11px] font-bold truncate leading-tight cursor-pointer ${
                                  layer.visible ? 'opacity-100' : 'opacity-40 italicLineThrough'
                                }`}
                                title={layer.name}
                              >
                                {layer.name}
                              </span>
                            </div>

                            {/* Actions (Reordering and Details Expand) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                id={`layer-up-${layer.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reorderLayer(layer.id, 'up');
                                }}
                                className={`p-1 hover:bg-current/10 cursor-pointer ${
                                  isGlitch ? 'text-[#00ffff]' : 'text-gray-600'
                                }`}
                                title="Move up in stacking order"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                id={`layer-down-${layer.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reorderLayer(layer.id, 'down');
                                }}
                                className={`p-1 hover:bg-current/10 cursor-pointer ${
                                  isGlitch ? 'text-[#00ffff]' : 'text-gray-600'
                                }`}
                                title="Move down in stacking order"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                id={`layer-detail-btn-${layer.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLayerExpanded(layer.id);
                                }}
                                className={`p-1 hover:bg-current/10 cursor-pointer ${
                                  isGlitch ? 'text-[#ff0080]' : 'text-gray-500'
                                }`}
                              >
                                {layer.expanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {layer.expanded && (
                            <div id={`layer-details-${layer.id}`} className="mt-2 pt-1 border-t border-current/5 pl-2">
                              {/* Description text */}
                              <p className="text-[9px] opacity-75 leading-relaxed italic">
                                {layer.description}
                              </p>

                              {/* Opacity slider */}
                              <div id={`opacity-slider-${layer.id}`} className="mt-2 flex items-center gap-2 pl-4 pr-1">
                                <span className="text-[8px] opacity-65 font-mono uppercase">OPACITY:</span>
                                <input
                                  id={`input-opacity-${layer.id}`}
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={layer.opacity}
                                  onChange={(e) => {
                                    setLayerOpacity(layer.id, parseFloat(e.target.value));
                                  }}
                                  className={`flex-1 h-1 bg-current/15 rounded-lg appearance-none cursor-pointer accent-current ${
                                    isGlitch ? 'accent-cyan-400' : 'accent-blue-500'
                                  }`}
                                />
                                <span className="text-[9px] font-mono shrink-0 font-bold">
                                  {Math.round(layer.opacity * 100)}%
                                </span>
                              </div>

                              {/* Legend */}
                              {renderLegend(layer)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer Manager Footer */}
      <div
        id="layer-manager-footer"
        className={`px-3 py-2 border-t text-[10px] select-none ${
          isGlitch
            ? 'bg-[#0a0f1d] border-t-[#00ffff]/20 text-cyan-500/80'
            : 'bg-gray-100 border-t-gray-200 text-gray-500'
        }`}
      >
        <div className="font-semibold uppercase tracking-wider mb-0.5">Stack Rendering Order:</div>
        <p className="leading-tight opacity-75">
          Layers render sequentially from top (Mission coordinates) to bottom (Base elevation). Adjust stacking using vertical selectors.
        </p>
      </div>
    </div>
  );
};

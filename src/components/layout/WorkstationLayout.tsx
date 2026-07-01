/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useWorkstationStore } from '../../store/useWorkstationStore';
import { RibbonToolbar } from '../ribbon/RibbonToolbar';
import { LayerManager } from '../layer-manager/LayerManager';
import { GISWorkspace } from '../gis/GISWorkspace';
import { MissionAnalysis } from '../analysis/MissionAnalysis';
import { StatusBar } from '../statusbar/StatusBar';
import {
  OpenProjectDialog,
  SaveProjectDialog,
  WorkspaceSettingsDialog,
  ThemeDialog,
  AboutDialog
} from '../shared/Dialogs';

export const WorkstationLayout: React.FC = () => {
  const { theme } = useWorkstationStore();
  const isGlitch = theme === 'Retro-Futurist Glitch';

  // Resizable panel width states
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(320);

  const handleLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setLeftWidth(Math.max(240, Math.min(480, startWidth + delta)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setRightWidth(Math.max(260, Math.min(500, startWidth - delta))); // moving mouse left increases width
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      id="cryoplan-desktop-container"
      className={`h-screen w-screen flex flex-col overflow-hidden select-none transition-colors duration-200 ${
        isGlitch
          ? 'bg-[#01040a] text-cyan-400 font-mono'
          : 'bg-[#fdfdfd] text-[#1a1a1a] font-sans'
      }`}
    >
      {/* 1. TOP RIBBON BAR */}
      <div id="layout-ribbon-wrapper" className="shrink-0 z-20">
        <RibbonToolbar />
      </div>

      {/* 2. THREE PANEL SYSTEM */}
      <div
        id="layout-panel-body"
        className={`flex-1 flex items-stretch overflow-hidden relative ${
          isGlitch ? '' : 'bg-[#e0e0e0]'
        }`}
      >
        {/* Left Panel: Layer Manager */}
        <div
          id="layout-left-panel"
          style={{ width: `${leftWidth}px` }}
          className="h-full shrink-0 overflow-hidden relative"
        >
          <LayerManager />
        </div>

        {/* Drag handle 1 (Left to Center) */}
        <div
          id="drag-handle-left"
          onMouseDown={handleLeftResize}
          className={`w-1 h-full cursor-col-resize hover:bg-current/40 active:bg-current/70 transition-colors shrink-0 z-30 flex items-center justify-center ${
            isGlitch ? 'bg-[#00ffff]/10' : 'bg-gray-300 border-x border-[#ccc]'
          }`}
          title="Drag to resize Layer Control Panel"
        >
          <div className="w-0.5 h-6 bg-current/30 rounded-full" />
        </div>

        {/* Center Workspace: Map and Views */}
        <div id="layout-center-workspace" className="flex-1 h-full overflow-hidden relative">
          <GISWorkspace />
        </div>

        {/* Drag handle 2 (Center to Right) */}
        <div
          id="drag-handle-right"
          onMouseDown={handleRightResize}
          className={`w-1 h-full cursor-col-resize hover:bg-current/40 active:bg-current/70 transition-colors shrink-0 z-30 flex items-center justify-center ${
            isGlitch ? 'bg-[#00ffff]/10' : 'bg-gray-300 border-x border-[#ccc]'
          }`}
          title="Drag to resize Mission Analysis Telemetry"
        >
          <div className="w-0.5 h-6 bg-current/30 rounded-full" />
        </div>

        {/* Right Panel: Mission Analysis */}
        <div
          id="layout-right-panel"
          style={{ width: `${rightWidth}px` }}
          className="h-full shrink-0 overflow-hidden relative"
        >
          <MissionAnalysis />
        </div>
      </div>

      {/* 3. BOTTOM STATUS BAR */}
      <div id="layout-statusbar-wrapper" className="shrink-0 z-20">
        <StatusBar />
      </div>

      {/* 4. MODAL DIALOGS */}
      <div id="modal-dialogs-portal">
        <OpenProjectDialog />
        <SaveProjectDialog />
        <WorkspaceSettingsDialog />
        <ThemeDialog />
        <AboutDialog />
      </div>

      {/* Retro CRT overlay if glitch theme is active */}
      {isGlitch && (
        <div
          id="retro-scanline-crt-overlay"
          className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.15)_100%)] mix-blend-overlay shadow-[inset_0_0_80px_rgba(0,0,0,0.4)] opacity-70"
        />
      )}
    </div>
  );
};

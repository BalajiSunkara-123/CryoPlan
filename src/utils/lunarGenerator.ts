/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveTheme } from '../types';
import { useWorkstationStore } from '../store/useWorkstationStore';

// Fast, high-performance 2D integer hash (no trig calls, extremely robust)
export function hash2D(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) ^ 279110627;
  h = Math.imul(h, 2654435761);
  return (h >>> 0) / 4294967296;
}

// Deterministic hash based on cell coordinates
export function hashCell(cx: number, cy: number, seed = 0): number {
  let h = Math.imul(cx, 12.9898 * 10000) + Math.imul(cy, 78.233 * 10000) + Math.imul(seed, 437.19 * 10000) ^ 279110627;
  h = Math.imul(h, 2654435761);
  return ((h >>> 0) / 4294967296) - Math.floor((h >>> 0) / 4294967296);
}

// Bilinear Value Noise in 2D
export function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep interpolation (3t^2 - 2t^3)
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a * (1 - ux) * (1 - uy) +
         b * ux * (1 - uy) +
         c * (1 - ux) * uy +
         d * ux * uy;
}

// Fractal Brownian Motion for multi-scale topography
export function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.48;
  }
  return value;
}

// Smooth crater profile function representing central peaks, sloped walls, sharp rims, and ejecta
export function getCraterElevation(dist: number, r: number, depth: number): number {
  const u = dist / r;
  if (u < 0.22) {
    // Center floor of crater: flat basin with a possible central peak
    const centralPeak = (r > 0.001) ? Math.max(0, 0.22 - u / 0.22) * depth * 0.45 : 0;
    return -depth * 0.90 + centralPeak;
  } else if (u < 0.82) {
    // Sloped crater walls rising up
    const t = (u - 0.22) / 0.60; // 0 to 1
    const p = Math.sin(t * Math.PI / 2); // rounded wall profile
    return -depth * 0.90 * (1 - p) + depth * 0.20 * p;
  } else if (u < 1.0) {
    // Sharp crater rim ridge
    const t = (u - 0.82) / 0.18; // 0 to 1
    return depth * 0.20 + t * depth * 0.15;
  } else if (u < 2.0) {
    // Ejecta blanket decaying outside the crater
    const t = (u - 1.0) / 1.0; // 0 to 1
    return depth * 0.35 * Math.exp(-t * 3.0);
  }
  return 0;
}

// Returns the true height/elevation of the Moon at global fractional coordinates (gx, gy)
// Height is centered in meters: ranges from -6500m (Shackleton floor) to +4200m (peaks)
export function getElevationAt(gx: number, gy: number): number {
  // 1. Continental macro-relief from FBM (hills, ridges, and maria plains)
  let height = -2000; // Baseline depth

  const macro = fbm(gx * 70, gy * 70, 4) * 1900; // Large ridges
  height += macro;

  // Add sharp mountain ridges to simulate lunar ring structures
  const ridge = (1.0 - Math.abs(noise2D(gx * 140, gy * 140) * 2.0 - 1.0)) * 750;
  height += ridge;

  const micro = fbm(gx * 500, gy * 500, 2) * 120; // Surface roughness
  height += micro;

  // 2. Primary Fixed Planetary Craters with Geologic Coordinates
  // Adding domain warping to simulate weathered, natural, non-perfectly round crater structures
  const warpX = fbm(gx * 250, gy * 250, 2) * 0.00018;
  const warpY = fbm(gx * 250 + 20, gy * 250 + 20, 2) * 0.00018;
  const wgx = gx + warpX;
  const wgy = gy + warpY;

  const craters = [
    { name: 'Shackleton', cx: 0.5000, cy: 0.5000, r: 220 / 65536, d: 4300 },
    { name: 'Shoemaker', cx: 0.5060, cy: 0.4930, r: 180 / 65536, d: 3300 },
    { name: 'Nobile', cx: 0.4930, cy: 0.5080, r: 145 / 65536, d: 2600 },
    { name: 'Faustini', cx: 0.5090, cy: 0.5050, r: 155 / 65536, d: 2800 },
    { name: 'Haworth', cx: 0.4910, cy: 0.4960, r: 165 / 65536, d: 2900 }
  ];

  craters.forEach((c) => {
    const dist = Math.hypot(wgx - c.cx, wgy - c.cy);
    if (dist < c.r * 2.2) {
      // Modulate depth with high-frequency noise on crater walls for terraces
      const wallTerraces = 1.0 + fbm(gx * 1200, gy * 1200, 1) * 0.08;
      height += getCraterElevation(dist, c.r, c.d * wallTerraces);
    }
  });

  // 3. Natural secondary impact clusters (instead of geometric uniform grids)
  const scNoise = noise2D(gx * 1200, gy * 1200);
  if (scNoise > 0.84) {
    const depth = Math.pow((scNoise - 0.84) / 0.16, 2) * 450;
    height -= depth;
  }

  // 4. Landing Zone LSE-1 Plateau: Smooth flat region for landing safety
  const lzX = (128 * 256 + 140) / 65536;
  const lzY = (128 * 256 + 100) / 65536;
  const distLZ = Math.hypot(gx - lzX, gy - lzY);
  const rLZ = 45 / 65536; // radius of landing zone

  if (distLZ < rLZ * 1.6) {
    const flattenFactor = Math.max(0, Math.min(1, (distLZ / (rLZ * 1.6))));
    const flatTargetHeight = -1200; // Flat plateau height
    height = height * flattenFactor + flatTargetHeight * (1 - flattenFactor);
  }

  return height;
}

// Calculate slope in degrees at a point (gx, gy)
export function getSlopeAt(gx: number, gy: number, z: number): number {
  const step = 0.5 / (256 * Math.pow(2, Math.max(3, z)));
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hB = getElevationAt(gx, gy + step);
  
  // Convert coordinate offset to approximate meters (Moon circumference is ~10,921 km)
  const distMeters = step * 10921000;
  
  const slopeX = (hR - h) / distMeters;
  const slopeY = (hB - h) / distMeters;
  const rad = Math.atan(Math.sqrt(slopeX * slopeX + slopeY * slopeY));
  
  return rad * (180 / Math.PI);
}

export function getAspectAt(gx: number, gy: number, z: number): number {
  const step = 0.5 / (256 * Math.pow(2, Math.max(3, z)));
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hB = getElevationAt(gx, gy + step);
  const distMeters = step * 10921000;
  const slopeX = (hR - h) / distMeters;
  const slopeY = (hB - h) / distMeters;
  let angle = Math.atan2(slopeY, slopeX) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

export function getCurvatureAt(gx: number, gy: number, z: number): number {
  const step = 0.5 / (256 * Math.pow(2, Math.max(3, z)));
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hL = getElevationAt(gx - step, gy);
  const hB = getElevationAt(gx, gy + step);
  const hT = getElevationAt(gx, gy - step);
  const distMeters = step * 10921000;
  const curv = (hR + hL + hB + hT - 4 * h) / (distMeters * distMeters);
  return curv * 150000; // scaled up for clear visual ramp
}

export function getRoughnessAt(gx: number, gy: number, z: number): number {
  const step = 0.5 / (256 * Math.pow(2, Math.max(3, z)));
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hL = getElevationAt(gx - step, gy);
  const hB = getElevationAt(gx, gy + step);
  const hT = getElevationAt(gx, gy - step);
  
  const mean = (h + hR + hL + hB + hT) / 5;
  const variance = (
    Math.pow(h - mean, 2) +
    Math.pow(hR - mean, 2) +
    Math.pow(hL - mean, 2) +
    Math.pow(hB - mean, 2) +
    Math.pow(hT - mean, 2)
  ) / 5;
  
  return Math.sqrt(variance); // roughness in meters
}

export function getLocalReliefAt(gx: number, gy: number, z: number): number {
  const step = 0.5 / (256 * Math.pow(2, Math.max(3, z)));
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hL = getElevationAt(gx - step, gy);
  const hB = getElevationAt(gx, gy + step);
  const hT = getElevationAt(gx, gy - step);
  
  const maxVal = Math.max(h, hR, hL, hB, hT);
  const minVal = Math.min(h, hR, hL, hB, hT);
  return maxVal - minVal; // difference in meters
}

export function getIlluminationAt(gx: number, gy: number, sunAz = 315, sunEl = 45): number {
  const step = 0.5 / (256 * 256);
  const shade = getLommelSeeligerShade(gx, gy, step, sunAz, sunEl);
  return shade / 255;
}

export function getHazardIndexAt(gx: number, gy: number, z = 8): number {
  const slope = getSlopeAt(gx, gy, z);
  const roughness = getRoughnessAt(gx, gy, z);
  const illumination = getIlluminationAt(gx, gy);
  
  const slopeScore = Math.min(1, slope / 20); // steep slope risk
  const roughScore = Math.min(1, roughness / 12); // boulder risk
  const illumScore = Math.max(0, 1 - illumination); // low sunlight hazard
  
  const haz = 0.5 * slopeScore + 0.3 * roughScore + 0.2 * illumScore;
  return Math.min(1, Math.max(0, haz));
}

// Lommel-Seeliger scattering model for realistic lunar photometry
// Reflectance = dot(Normal, Sun) / (dot(Normal, Sun) + normal.z)
export function getLommelSeeligerShade(
  gx: number,
  gy: number,
  step: number,
  azDeg = 315,
  elDeg = 45
): number {
  const h = getElevationAt(gx, gy);
  const hR = getElevationAt(gx + step, gy);
  const hB = getElevationAt(gx, gy + step);
  
  const distMeters = step * 10921000;
  const slopeX = (hR - h) / distMeters;
  const slopeY = (hB - h) / distMeters;
  
  // Calculate normals (with scaling for depth)
  const nx = -slopeX * 1.6;
  const ny = -slopeY * 1.6;
  const nz = 1.0;
  const lenN = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const normalX = nx / lenN;
  const normalY = ny / lenN;
  const normalZ = nz / lenN;
  
  // Calculate Sun Azimuth/Elevation direction vector
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;
  
  const sx = Math.cos(elRad) * Math.sin(azRad);
  const sy = -Math.cos(elRad) * Math.cos(azRad);
  const sz = Math.sin(elRad);
  
  const dot = normalX * sx + normalY * sy + normalZ * sz;
  
  if (dot <= 0) {
    return 0; // pitch black shadow on airless moon
  }
  
  // Lommel-Seeliger formula
  const intensity = dot / (dot + normalZ);
  return Math.min(255, Math.max(0, Math.floor(intensity * 330)));
}

// ----------------------------------------------------------------------
// SCIENTIFIC DFSAR RADAR SIMULATION MATH MODELS
// ----------------------------------------------------------------------
export function getNormalizedBackscatter(gx: number, gy: number, step = 0.0001): number {
  const h = getElevationAt(gx, gy);
  const radarShade = getLommelSeeligerShade(gx, gy, step, 270, 35); // West-looking SAR geometry
  const rawB = radarShade / 255;
  const speckle = 0.5 + hash2D(Math.floor(gx * 120000), Math.floor(gy * 120000)) * 0.9;
  return Math.max(0.01, Math.min(1.0, rawB * speckle));
}

export function getNormalizedCPR(gx: number, gy: number): number {
  const h = getElevationAt(gx, gy);
  const isPSR = h < -4000;
  const rVal = hash2D(Math.floor(gx * 60000), Math.floor(gy * 60000));
  const cpr = isPSR ? (0.68 + rVal * 0.32) : (rVal > 0.985 ? 0.55 + rVal * 0.25 : rVal * 0.12);
  return Math.max(0.02, Math.min(1.0, cpr));
}

export function getNormalizedDOP(gx: number, gy: number): number {
  const h = getElevationAt(gx, gy);
  const isPSR = h < -3800;
  const rVal = hash2D(Math.floor(gx * 40000), Math.floor(gy * 40000));
  const dop = isPSR ? (0.40 + rVal * 0.50) : (0.15 + rVal * 0.15);
  return Math.max(0.01, Math.min(1.0, dop));
}

export function getRadarIncidenceAngle(gx: number, gy: number): number {
  const slope = getSlopeAt(gx, gy, 8);
  const angle = 35 + slope * 1.2 + hash2D(Math.floor(gx * 80000), Math.floor(gy * 80000)) * 5;
  return Math.max(20, Math.min(75, angle));
}

export function getRadarConfidence(gx: number, gy: number): number {
  const h = getElevationAt(gx, gy);
  const slope = getSlopeAt(gx, gy, 8);
  let confidence = 0.95 - (slope / 45) * 0.4 - (h < -4000 ? 0.12 : 0.0);
  confidence += hash2D(Math.floor(gx * 50000), Math.floor(gy * 50000)) * 0.1;
  return Math.max(0.1, Math.min(1.0, confidence));
}

export function getIceProbability(gx: number, gy: number): number {
  const cpr = getNormalizedCPR(gx, gy);
  const dop = getNormalizedDOP(gx, gy);
  const backscatter = getNormalizedBackscatter(gx, gy);
  // IceScore = 0.45 × Normalized CPR + 0.30 × Normalized DOP + 0.25 × Normalized Backscatter
  const score = 0.45 * cpr + 0.30 * dop + 0.25 * backscatter;
  return Math.max(0, Math.min(1.0, score));
}

export function generateLandingCandidates(constraints: {
  slopeMax: number;
  hazardMax: number;
  iceMin: number;
  illumMin: number;
  psrRadiusMax: number;
}) {
  const pool = [
    { gx: 0.502136, gy: 0.501525, name: 'LSE-Alpha' },
    { gx: 0.501250, gy: 0.503400, name: 'LSE-Beta' },
    { gx: 0.498500, gy: 0.502800, name: 'LSE-Gamma' },
    { gx: 0.503800, gy: 0.497500, name: 'LSE-Delta' },
    { gx: 0.495200, gy: 0.498100, name: 'LSE-Epsilon' },
    { gx: 0.504200, gy: 0.505500, name: 'LSE-Zeta' },
    { gx: 0.496800, gy: 0.506200, name: 'LSE-Eta' },
    { gx: 0.501500, gy: 0.494200, name: 'LSE-Theta' },
    { gx: 0.493800, gy: 0.501100, name: 'LSE-Iota' },
    { gx: 0.507200, gy: 0.503800, name: 'LSE-Kappa' },
    { gx: 0.497500, gy: 0.493500, name: 'LSE-Lambda' },
    { gx: 0.505500, gy: 0.495800, name: 'LSE-Mu' },
    { gx: 0.491500, gy: 0.499500, name: 'LSE-Nu' },
    { gx: 0.508500, gy: 0.499800, name: 'LSE-Xi' },
    { gx: 0.492500, gy: 0.506500, name: 'LSE-Omicron' }
  ];

  const results = pool.map((item, idx) => {
    const gx = item.gx;
    const gy = item.gy;
    const slope = getSlopeAt(gx, gy, 8);
    const hazardIndex = getHazardIndexAt(gx, gy, 8);
    const iceProbability = getIceProbability(gx, gy);
    const illumination = getIlluminationAt(gx, gy) * 100; // in %
    const roughness = getRoughnessAt(gx, gy, 8);
    const elevation = getElevationAt(gx, gy);
    
    // Distance to Shackleton Crater Center PSR (0.5, 0.5)
    const distanceToPSR = Math.hypot(gx - 0.5000, gy - 0.5000) * 10921000; // in meters

    // MCDA Normalizations
    const safety = 1 - hazardIndex;
    const normIce = iceProbability;
    const normIllum = illumination / 100;
    const normRough = 1 - Math.min(1, roughness / 15);
    const normDist = 1 - Math.min(1, distanceToPSR / 5000);

    // Score computation
    const score = 0.30 * normIce + 0.25 * safety + 0.20 * normIllum + 0.15 * normRough + 0.10 * normDist;
    const confidence = Math.round(safety * 100);

    // Map to Lunar coordinates
    const coords = mapCoordsToLunar((gx - 0.5) * 40075016, (0.5 - gy) * 40075016);

    const terrainType = elevation < -3000 ? 'Deep Crater Floor' : (slope < 6 ? 'Smooth Mare Plateau' : 'Crater Rim Massif');
    
    let recommendation = 'OPTIONAL';
    if (slope > constraints.slopeMax || hazardIndex > constraints.hazardMax || distanceToPSR > constraints.psrRadiusMax) {
      recommendation = 'DO NOT LAND';
    } else if (score > 0.65) {
      recommendation = 'PRIMARY CHOICE';
    } else if (score > 0.5) {
      recommendation = 'SECONDARY BACKUP';
    }

    return {
      id: idx + 1,
      name: item.name,
      rank: 0, // set later
      score: Math.min(1, Math.max(0, score)),
      coords,
      gx,
      gy,
      distanceToPSR,
      slope,
      hazardIndex,
      illumination,
      roughness,
      iceProbability,
      elevation,
      confidence,
      terrainType,
      recommendation
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Assign ranks
  results.forEach((item, index) => {
    item.rank = index + 1;
  });

  return results.slice(0, 10); // Return top 10 candidates
}

// Orchestrates drawing dynamic tiles for OpenLayers
export function drawLunarTile(
  ctx: CanvasRenderingContext2D,
  z: number,
  x: number,
  y: number,
  layerId: string,
  theme: ActiveTheme
) {
  const isGlitch = theme === 'Retro-Futurist Glitch';

  // Get active Sun position from window settings or default to standard GIS light direction
  const sunAz = (window as any).lunarSunAzimuth ?? 315;
  const sunEl = (window as any).lunarSunElevation ?? 45;

  const isBaseDataset = [
    'terrain-elevation',
    'lola-hillshade',
    'ohrc-imagery',
    'dfsar-backscatter',
    'cpr',
    'dop',
    'radar-incidence',
    'radar-confidence',
    'radar-composite',
    'illumination',
    'slope-map',
    'aspect-map',
    'curvature-map',
    'roughness-map',
    'relief-map',
    'hazard-heatmap',
    'cost-surface'
  ].includes(layerId);
  
  if (isBaseDataset) {
    const res = 128;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = res;
    tempCanvas.height = res;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      const imgData = tempCtx.createImageData(res, res);
      const data = imgData.data;
      const numTiles = Math.pow(2, z);
      const step = 0.5 / (res * numTiles);
      
      for (let py = 0; py < res; py++) {
        for (let px = 0; px < res; px++) {
          const idx = (py * res + px) * 4;
          const gx = (x + px / res) / numTiles;
          const gy = (y + py / res) / numTiles;
          
          const h = getElevationAt(gx, gy);
          
          if (layerId === 'terrain-elevation') {
            // LOLA DEM Layer: scientific color ramp representation (blue to red to white)
            // Normalize elevation: -6500m to +4200m -> 0.0 to 1.0
            const norm = (h - (-6500)) / (4200 - (-6500));
            const c = Math.min(1.0, Math.max(0.0, norm));
            
            // Generate professional color ramp:
            let rCol = 0, gCol = 0, bCol = 0;
            if (isGlitch) {
              rCol = 0;
              gCol = Math.floor(c * 200);
              bCol = Math.floor(100 + c * 155);
            } else {
              // Scientific rainbow-topo ramp
              if (c < 0.2) {
                // Deep Basin: Dark Blue to Cyan
                rCol = Math.floor(17 * (1 - c/0.2) + 24 * (c/0.2));
                gCol = Math.floor(24 * (1 - c/0.2) + 115 * (c/0.2));
                bCol = Math.floor(39 * (1 - c/0.2) + 184 * (c/0.2));
              } else if (c < 0.5) {
                // Lowlands: Cyan to Green
                const t = (c - 0.2) / 0.3;
                rCol = Math.floor(24 * (1 - t) + 34 * t);
                gCol = Math.floor(115 * (1 - t) + 197 * t);
                bCol = Math.floor(184 * (1 - t) + 94 * t);
              } else if (c < 0.75) {
                // Highlands: Green to Yellow-Orange
                const t = (c - 0.5) / 0.25;
                rCol = Math.floor(34 * (1 - t) + 217 * t);
                gCol = Math.floor(197 * (1 - t) + 119 * t);
                bCol = Math.floor(94 * (1 - t) + 6 * t);
              } else {
                // Peaks: Orange to Red to White
                const t = (c - 0.75) / 0.25;
                rCol = Math.floor(217 * (1 - t) + 255 * t);
                gCol = Math.floor(119 * (1 - t) + 255 * t);
                bCol = Math.floor(6 * (1 - t) + 255 * t);
              }
            }
            
            data[idx] = rCol;
            data[idx + 1] = gCol;
            data[idx + 2] = bCol;
            data[idx + 3] = 255;
            
          } else if (layerId === 'lola-hillshade') {
            // Dynamic Hillshade from DEM with active lighting controls
            const shade = getLommelSeeligerShade(gx, gy, step, sunAz, sunEl);
            
            data[idx] = isGlitch ? 0 : shade;
            data[idx + 1] = isGlitch ? Math.floor(shade * 0.82) : shade;
            data[idx + 2] = shade;
            data[idx + 3] = 255;
            
          } else if (layerId === 'illumination') {
            // Binary Illumination Layer (Sun lit vs Shadowed)
            const shade = getLommelSeeligerShade(gx, gy, step, sunAz, sunEl);
            if (shade <= 12) {
              data[idx] = 10;
              data[idx + 1] = 15;
              data[idx + 2] = 28;
              data[idx + 3] = 220; // Dark shadows
            } else {
              data[idx + 3] = 0; // Fully lit transparent
            }
            
          } else if (layerId === 'slope-map') {
            // Live GIS Slope angle mapping
            const slope = getSlopeAt(gx, gy, z);
            if (slope < 5) {
              // Flat: Transparent Emerald Green
              data[idx] = 16;
              data[idx + 1] = 185;
              data[idx + 2] = 129;
              data[idx + 3] = 60;
            } else if (slope < 15) {
              // Moderate: Yellow Orange
              data[idx] = 234;
              data[idx + 1] = 179;
              data[idx + 2] = 8;
              data[idx + 3] = 80;
            } else {
              // High: Red
              data[idx] = 239;
              data[idx + 1] = 68;
              data[idx + 2] = 68;
              data[idx + 3] = 140;
            }
            
          } else if (layerId === 'ohrc-imagery') {
            // Planetary Base Raster: Grayscale orthorectified spacecraft photography
            // Apply Lommel-Seeliger shading using active sun vectors
            let shade = getLommelSeeligerShade(gx, gy, step, sunAz, sunEl);
            
            // Synthesis 1: Albedo variation (older vs newer materials)
            const albedo = 0.85 + fbm(gx * 14, gy * 14, 3) * 0.22;
            shade = Math.floor(shade * albedo);
            
            // Synthesis 2: High Albedo Radial Ejecta Rays around young impact sites (Shackleton & Shoemaker)
            // Shackleton Center (0.500, 0.500)
            const shDist = Math.hypot(gx - 0.5, gy - 0.5);
            if (shDist < 0.018) {
              const shAngle = Math.atan2(gy - 0.5, gx - 0.5);
              const shRays = Math.pow(Math.sin(shAngle * 7 + fbm(gx * 150, gy * 150, 2) * 6), 2);
              const shIntensity = shRays * Math.exp(-shDist * 160) * 85;
              shade = Math.min(255, shade + shIntensity);
            }
            // Shoemaker Center (0.506, 0.493)
            const shoeDist = Math.hypot(gx - 0.5060, gy - 0.4930);
            if (shoeDist < 0.015) {
              const shoeAngle = Math.atan2(gy - 0.4930, gx - 0.5060);
              const shoeRays = Math.pow(Math.sin(shoeAngle * 5 + fbm(gx * 120, gy * 120, 2) * 4), 2);
              const shoeIntensity = shoeRays * Math.exp(-shoeDist * 180) * 70;
              shade = Math.min(255, shade + shoeIntensity);
            }
            
            // Synthesis 3: Regolith fine-scale dust grain and microscopic noise
            const rVal = hash2D(Math.floor(gx * 150000), Math.floor(gy * 150000));
            const grain = (rVal - 0.5) * 16;
            
            // Synthesis 4: Micro-boulders and shadows on high slopes
            const bNoise = hash2D(Math.floor(gx * 200000), Math.floor(gy * 200000));
            const slope = getSlopeAt(gx, gy, z);
            if (bNoise > 0.9995 && slope > 12) {
              shade = 255; // Boulder reflecting light
              // We inject a shadow right next to it
              const nextIdx = idx + 4;
              if (nextIdx < data.length) {
                data[nextIdx] = 0;
                data[nextIdx + 1] = 0;
                data[nextIdx + 2] = 0;
              }
            }
            
            shade = Math.min(255, Math.max(0, shade + grain - 4));
            
            data[idx] = isGlitch ? 0 : shade;
            data[idx + 1] = isGlitch ? Math.floor(shade * 0.80) : shade;
            data[idx + 2] = shade;
            data[idx + 3] = 255;
            
          } else if (layerId === 'dfsar-backscatter') {
            const val = getNormalizedBackscatter(gx, gy, step);
            const finalVal = Math.floor(val * 255);
            data[idx] = isGlitch ? 0 : finalVal;
            data[idx + 1] = isGlitch ? Math.floor(finalVal * 0.9) : finalVal;
            data[idx + 2] = isGlitch ? finalVal : Math.floor(finalVal * 0.75);
            data[idx + 3] = 255;
            
          } else if (layerId === 'cpr') {
            const val = getNormalizedCPR(gx, gy);
            if (val > 0) {
              data[idx] = isGlitch ? 255 : Math.floor(130 + val * 125);
              data[idx + 1] = isGlitch ? 0 : Math.floor(40 + val * 130);
              data[idx + 2] = isGlitch ? 255 : Math.floor(210 + val * 45);
              data[idx + 3] = Math.floor(val * 220);
            } else {
              data[idx + 3] = 0;
            }
            
          } else if (layerId === 'dop') {
            const val = getNormalizedDOP(gx, gy);
            if (val > 0) {
              data[idx] = 0;
              data[idx + 1] = isGlitch ? 255 : Math.floor(90 + val * 165);
              data[idx + 2] = isGlitch ? 255 : Math.floor(170 + val * 85);
              data[idx + 3] = Math.floor(val * 190);
            } else {
              data[idx + 3] = 0;
            }

          } else if (layerId === 'radar-incidence') {
            const angle = getRadarIncidenceAngle(gx, gy);
            const t = (angle - 20) / 55;
            const rCol = Math.floor(30 * (1 - t) + 129 * t);
            const gCol = Math.floor(27 * (1 - t) + 140 * t);
            const bCol = Math.floor(75 * (1 - t) + 248 * t);
            data[idx] = rCol;
            data[idx + 1] = gCol;
            data[idx + 2] = bCol;
            data[idx + 3] = 255;

          } else if (layerId === 'radar-confidence') {
            const conf = getRadarConfidence(gx, gy);
            let rCol = 0, gCol = 0, bCol = 0;
            if (conf < 0.5) {
              const t = conf / 0.5;
              rCol = Math.floor(127 * (1 - t) + 180 * t);
              gCol = Math.floor(29 * (1 - t) + 83 * t);
              bCol = Math.floor(29 * (1 - t) + 9 * t);
            } else {
              const t = (conf - 0.5) / 0.5;
              rCol = Math.floor(180 * (1 - t) + 21 * t);
              gCol = Math.floor(83 * (1 - t) + 128 * t);
              bCol = Math.floor(9 * (1 - t) + 61 * t);
            }
            data[idx] = rCol;
            data[idx + 1] = gCol;
            data[idx + 2] = bCol;
            data[idx + 3] = 255;

          } else if (layerId === 'radar-composite') {
            const b = getNormalizedBackscatter(gx, gy, step);
            const c = getNormalizedCPR(gx, gy);
            const d = getNormalizedDOP(gx, gy);
            data[idx] = Math.floor(b * 255);
            data[idx + 1] = Math.floor(c * 255);
            data[idx + 2] = Math.floor(d * 255);
            data[idx + 3] = 255;
          } else if (layerId === 'aspect-map') {
            const asp = getAspectAt(gx, gy, z);
            const norm = asp / 360;
            data[idx] = Math.floor(Math.sin(norm * Math.PI) * 150 + 105);
            data[idx + 1] = Math.floor(Math.sin((norm + 0.33) * Math.PI) * 180 + 40);
            data[idx + 2] = Math.floor(Math.sin((norm + 0.66) * Math.PI) * 150 + 105);
            data[idx + 3] = 140;
          } else if (layerId === 'curvature-map') {
            const curv = getCurvatureAt(gx, gy, z);
            const norm = Math.max(-1, Math.min(1, curv));
            if (norm < 0) {
              data[idx] = Math.floor(40 * (1 + norm));
              data[idx + 1] = Math.floor(100 * (1 + norm) + 100);
              data[idx + 2] = 255;
            } else {
              data[idx] = 255;
              data[idx + 1] = Math.floor(50 * (1 - norm) + 50);
              data[idx + 2] = Math.floor(50 * (1 - norm));
            }
            data[idx + 3] = 140;
          } else if (layerId === 'roughness-map') {
            const rough = getRoughnessAt(gx, gy, z);
            const norm = Math.min(1, rough / 15);
            if (norm < 0.5) {
              const t = norm / 0.5;
              data[idx] = Math.floor(34 * (1 - t) + 234 * t);
              data[idx + 1] = Math.floor(197 * (1 - t) + 179 * t);
              data[idx + 2] = Math.floor(94 * (1 - t) + 8 * t);
            } else {
              const t = (norm - 0.5) / 0.5;
              data[idx] = Math.floor(234 * (1 - t) + 239 * t);
              data[idx + 1] = Math.floor(179 * (1 - t) + 68 * t);
              data[idx + 2] = Math.floor(8 * (1 - t) + 68 * t);
            }
            data[idx + 3] = 150;
          } else if (layerId === 'relief-map') {
            const relief = getLocalReliefAt(gx, gy, z);
            const norm = Math.min(1, relief / 120);
            data[idx] = Math.floor(20 + norm * 210);
            data[idx + 1] = Math.floor(30 * (1 - norm));
            data[idx + 2] = Math.floor(80 + norm * 140);
            data[idx + 3] = 140;
          } else if (layerId === 'hazard-heatmap') {
            const haz = getHazardIndexAt(gx, gy, z);
            if (haz < 0.35) {
              const t = haz / 0.35;
              data[idx] = Math.floor(16 * (1 - t) + 234 * t);
              data[idx + 1] = Math.floor(185 * (1 - t) + 179 * t);
              data[idx + 2] = Math.floor(129 * (1 - t) + 8 * t);
              data[idx + 3] = Math.floor(40 + t * 40);
            } else if (haz < 0.7) {
              const t = (haz - 0.35) / 0.35;
              data[idx] = Math.floor(234 * (1 - t) + 239 * t);
              data[idx + 1] = Math.floor(179 * (1 - t) + 68 * t);
              data[idx + 2] = Math.floor(8 * (1 - t) + 68 * t);
              data[idx + 3] = Math.floor(80 + t * 40);
            } else {
              data[idx] = 239;
              data[idx + 1] = 68;
              data[idx + 2] = 68;
              data[idx + 3] = 140;
            }
          } else if (layerId === 'cost-surface') {
            const mode = (window as any).traversePlanningMode || 'SAFEST';
            const slope = Math.min(30, getSlopeAt(gx, gy, 8));
            const hazard = getHazardIndexAt(gx, gy, 8);
            const roughness = getRoughnessAt(gx, gy, 8);
            const illum = getIlluminationAt(gx, gy, 315, 45);
            const illumPenalty = 1.0 - illum;

            const normSlope = slope / 30;
            const normRoughness = Math.min(15, roughness) / 15;

            let wSlope = 0.35;
            let wHazard = 0.25;
            let wRoughness = 0.15;
            let wIllum = 0.15;
            let wDist = 0.10;

            if (mode === 'SHORTEST') {
              wSlope = 0.15;
              wHazard = 0.10;
              wRoughness = 0.05;
              wIllum = 0.10;
              wDist = 0.60;
            } else if (mode === 'SAFEST') {
              wSlope = 0.45;
              wHazard = 0.35;
              wRoughness = 0.15;
              wIllum = 0.05;
              wDist = 0.00;
            } else if (mode === 'ENERGY') {
              wSlope = 0.25;
              wHazard = 0.15;
              wRoughness = 0.10;
              wIllum = 0.40;
              wDist = 0.10;
            }

            const cost = (wSlope * normSlope +
                         wHazard * hazard +
                         wRoughness * normRoughness +
                         wIllum * illumPenalty) / (1.0 - wDist);

            const c = Math.max(0.0, Math.min(1.0, cost));

            if (c < 0.5) {
              const t = c / 0.5;
              data[idx] = Math.floor(16 * (1 - t) + 234 * t);
              data[idx + 1] = Math.floor(185 * (1 - t) + 179 * t);
              data[idx + 2] = Math.floor(129 * (1 - t) + 8 * t);
            } else {
              const t = (c - 0.5) / 0.5;
              data[idx] = Math.floor(234 * (1 - t) + 239 * t);
              data[idx + 1] = Math.floor(179 * (1 - t) + 68 * t);
              data[idx + 2] = Math.floor(8 * (1 - t) + 68 * t);
            }
            data[idx + 3] = 140;
          }
        }
      }
      
      tempCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tempCanvas, 0, 0, 256, 256);
    }
  } else {
    // Vector Overlay & Map Overlays (contours, hazards, landing candidates, labels)
    ctx.clearRect(0, 0, 256, 256);
    
    if (layerId === 'contours') {
      drawDynamicContourLines(ctx, z, x, y, isGlitch);
    } else if (layerId === 'hazards') {
      drawDynamicHazardsLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'ice-prob') {
      drawDynamicIceProbability(ctx, z, x, y, isGlitch, sunAz, sunEl);
    } else if (layerId === 'landing-zones') {
      renderLandingZonesLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'traverse') {
      renderTraversePathLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'waypoints') {
      renderWaypointsLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'rejected-routes') {
      renderRejectedRoutesLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'mission-timeline') {
      renderMissionTimelineLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'labels') {
      renderLabelsLayer(ctx, z, x, y, isGlitch);
    } else if (layerId === 'target-crater') {
      renderTargetCraterLayer(ctx, z, x, y, isGlitch);
    }
  }

  // Draw coordinate grids
  drawCoordinateGridOverlay(ctx, z, x, y, isGlitch);
}

// Coordinate grid: professional thin coordinates overlay
function drawCoordinateGridOverlay(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  // We draw a light coordinate grid at 1000m intervals
  const numTiles = Math.pow(2, z);
  const step = 1 / numTiles;
  
  // 1000m in fractional is 1000 / 10921000 = 1 / 10921
  const gridFraction = 1 / 10921;
  
  ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.04)' : 'rgba(100, 116, 139, 0.06)';
  ctx.lineWidth = 0.5;
  ctx.font = '7px "JetBrains Mono", monospace';
  ctx.fillStyle = isGlitch ? 'rgba(0, 255, 255, 0.35)' : 'rgba(100, 116, 139, 0.45)';
  
  const startGx = x * step;
  const startGy = y * step;
  
  // Align to grid multiplier
  const minGxi = Math.ceil(startGx / gridFraction);
  const maxGxi = Math.floor((startGx + step) / gridFraction);
  const minGyi = Math.ceil(startGy / gridFraction);
  const maxGyi = Math.floor((startGy + step) / gridFraction);
  
  for (let gxi = minGxi; gxi <= maxGxi; gxi++) {
    const gx = gxi * gridFraction;
    const px = ((gx - startGx) / step) * 256;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, 256);
    ctx.stroke();
  }
  
  for (let gyi = minGyi; gyi <= maxGyi; gyi++) {
    const gy = gyi * gridFraction;
    const py = ((gy - startGy) / step) * 256;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(256, py);
    ctx.stroke();
  }
}

// 1. Contours drawing: pixel-perfect isolines every 500m of elevation
function drawDynamicContourLines(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const numTiles = Math.pow(2, z);
  const size = 256;
  const interval = 500;
  
  const res = 64; // Grid sizing
  const grid = new Float32Array(res * res);
  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const gx = (x + px / res) / numTiles;
      const gy = (y + py / res) / numTiles;
      grid[py * res + px] = getElevationAt(gx, gy);
    }
  }
  
  ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.25)' : 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 0.7;
  
  for (let py = 0; py < res - 1; py++) {
    for (let px = 0; px < res - 1; px++) {
      const h00 = grid[py * res + px];
      const h10 = grid[py * res + (px + 1)];
      const h01 = grid[(py + 1) * res + px];
      
      const v00 = Math.floor(h00 / interval);
      const v10 = Math.floor(h10 / interval);
      const v01 = Math.floor(h01 / interval);
      
      if (v00 !== v10 || v00 !== v01) {
        const sx = (px / res) * size;
        const sy = (py / res) * size;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

// 2. Hazards: True Slope > 15° rendered as diagonal engineering hatching
function drawDynamicHazardsLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const numTiles = Math.pow(2, z);
  const size = 256;
  const res = 64;
  
  ctx.strokeStyle = isGlitch ? 'rgba(255, 0, 85, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 1.0;
  
  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const gx = (x + px / res) / numTiles;
      const gy = (y + py / res) / numTiles;
      
      const slope = getSlopeAt(gx, gy, z);
      
      if (slope > 15) {
        const sx = (px / res) * size;
        const sy = (py / res) * size;
        
        // Red engineering hatch
        if ((px + py) % 4 === 0) {
          ctx.beginPath();
          ctx.moveTo(sx - 2, sy + 2);
          ctx.lineTo(sx + 2, sy - 2);
          ctx.stroke();
        }
      }
    }
  }
}

// 3. Ice Probability: Glowing Screen-blend blue inside permanently shadowed basins relative to IceScore and threshold
function drawDynamicIceProbability(
  ctx: CanvasRenderingContext2D,
  z: number,
  x: number,
  y: number,
  isGlitch: boolean,
  sunAz: number,
  sunEl: number
) {
  const numTiles = Math.pow(2, z);
  const size = 256;
  const res = 64;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = res;
  tempCanvas.height = res;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (tempCtx) {
    const imgData = tempCtx.createImageData(res, res);
    const data = imgData.data;
    
    for (let py = 0; py < res; py++) {
      for (let px = 0; px < res; px++) {
        const idx = (py * res + px) * 4;
        const gx = (x + px / res) / numTiles;
        const gy = (y + py / res) / numTiles;
        
        const iceScore = getIceProbability(gx, gy);
        const threshold = (window as any).lunarIceThreshold ?? 0.50;
        
        if (iceScore >= threshold) {
          // Display blue only where probability exceeds threshold
          // Each category has a different blue intensity:
          // Very Low (<0.2), Low (0.2-0.4), Moderate (0.4-0.6), High (0.6-0.8), Very High (0.8-1.0)
          let r = 2, g = 132, b = 199; // Default Very High (Vibrant Deep Blue)
          if (iceScore < 0.2) {
            r = 186; g = 230; b = 253; // Very Low: light icy blue
          } else if (iceScore < 0.4) {
            r = 125; g = 211; b = 252; // Low
          } else if (iceScore < 0.6) {
            r = 56; g = 189; b = 248;  // Moderate
          } else if (iceScore < 0.8) {
            r = 14; g = 165; b = 233;  // High
          }
          
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          
          const opacityFactor = 0.35 + ((iceScore - threshold) / (1.0 - threshold + 0.0001)) * 0.65;
          data[idx + 3] = Math.floor(Math.min(1.0, Math.max(0.2, opacityFactor)) * 190);
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(tempCanvas, 0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// 4. Landing Candidates LSE-1 Primary Envelope Ellipse Overlay
function renderLandingZonesLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const store = useWorkstationStore.getState();
  const { status, candidates, selectedCandidateId } = store.landingAnalysis;

  // Fallback if no candidates are generated yet
  if (candidates.length === 0) {
    const flatX = 140;
    const flatY = 100;
    const flatRadius = 45;

    const scale = Math.pow(2, z - 8);
    const localX = (128 - x * scale) * 256 + flatX * scale;
    const localY = (128 - y * scale) * 256 + flatY * scale;
    const localR = flatRadius * scale;

    if (localX + localR > 0 && localX - localR < 256 &&
        localY + localR > 0 && localY - localR < 256) {
      ctx.strokeStyle = isGlitch ? '#00ff80' : '#10b981';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = isGlitch ? 'rgba(0, 255, 128, 0.05)' : 'rgba(16, 185, 129, 0.07)';
      
      ctx.beginPath();
      ctx.ellipse(localX, localY, localR, localR * 0.72, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = isGlitch ? '#00ff80' : '#059669';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(localX - 8, localY); ctx.lineTo(localX + 8, localY);
      ctx.moveTo(localX, localY - 8); ctx.lineTo(localX, localY + 8);
      ctx.stroke();
    }
    return;
  }

  // Draw candidates!
  const numTiles = Math.pow(2, z);
  const scale = Math.pow(2, z - 8);
  const flatRadius = 45;

  candidates.forEach((cand) => {
    // Stagger display if in ANALYZING state based on rank and progress
    if (status === 'ANALYZING' && cand.rank > 5) {
      return; // only show first 5 during analysis simulation
    }

    const localX = (cand.gx * numTiles - x) * 256;
    const localY = (cand.gy * numTiles - y) * 256;
    const localR = flatRadius * scale;

    if (localX + localR > -20 && localX - localR < 276 &&
        localY + localR > -20 && localY - localR < 276) {
      
      const isSelected = cand.id === selectedCandidateId;
      const strokeColor = isSelected 
        ? (isGlitch ? '#ff00ff' : '#ec4899') // Pink/magenta for selected
        : (isGlitch ? '#00ff80' : '#10b981'); // Green for candidate
      
      const fillColor = isSelected
        ? (isGlitch ? 'rgba(255, 0, 255, 0.09)' : 'rgba(236, 72, 153, 0.12)')
        : (isGlitch ? 'rgba(0, 255, 128, 0.04)' : 'rgba(16, 185, 129, 0.06)');

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.fillStyle = fillColor;

      ctx.beginPath();
      ctx.ellipse(localX, localY, localR, localR * 0.72, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw crosshair
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(localX - 6, localY); ctx.lineTo(localX + 6, localY);
      ctx.moveTo(localX, localY - 6); ctx.lineTo(localX, localY + 6);
      ctx.stroke();

      // Rank text bubble
      ctx.fillStyle = isSelected ? '#ec4899' : '#10b981';
      ctx.beginPath();
      ctx.arc(localX - localR * 0.7, localY - localR * 0.5, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${cand.rank}`, localX - localR * 0.7, localY - localR * 0.5);

      // Score / details text right below the bubble
      ctx.fillStyle = isSelected ? (isGlitch ? '#ff00ff' : '#ec4899') : (isGlitch ? '#00ff80' : '#047857');
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(`${(cand.score * 100).toFixed(0)}%`, localX - localR * 0.7, localY - localR * 0.5 + 12);

      // Blinking dash ring around the selected best candidate
      if (isSelected) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = - (Math.floor(Date.now() / 150) % 8);
        ctx.beginPath();
        ctx.arc(localX, localY, localR * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Draw Safe Corridor starting from selected candidate to the nearest deep basin point (Shackleton crater floor is at 0.5, 0.5)
        ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.22)';
        ctx.lineWidth = 12 * scale;
        ctx.beginPath();
        ctx.moveTo(localX, localY);
        const basinX = (0.5 * numTiles - x) * 256;
        const basinY = (0.5 * numTiles - y) * 256;
        ctx.lineTo(basinX, basinY);
        ctx.stroke();

        ctx.strokeStyle = isGlitch ? 'rgba(0, 255, 255, 0.75)' : 'rgba(16, 185, 129, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(localX, localY);
        ctx.lineTo(basinX, basinY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = isGlitch ? '#00ffff' : '#047857';
        ctx.textAlign = 'left';
        ctx.fillText('SAFE TRANSITION CORRIDOR', (localX + basinX) / 2 + 8, (localY + basinY) / 2);
      }
    }
  });
}

// 5. Traverse Pathfinder Path: Bright engineering yellow line with animated crawling dashes
function renderTraversePathLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  let pathPts: { gx: number; gy: number }[] = (window as any).lunarRoverPath;
  
  if (!pathPts || pathPts.length === 0) {
    // Fallback default path using global coords
    const fallbackWps = [
      { wx: 110, wy: 110 },
      { wx: 124, wy: 116 },
      { wx: 138, wy: 130 },
      { wx: 132, wy: 142 },
      { wx: 118, wy: 134 }
    ];
    pathPts = fallbackWps.map(wp => ({
      gx: (128 * 256 + wp.wx) / 65536,
      gy: (128 * 256 + wp.wy) / 65536
    }));
  }

  const numTiles = Math.pow(2, z);
  const projected = pathPts.map((pt) => ({
    px: (pt.gx * numTiles - x) * 256,
    py: (pt.gy * numTiles - y) * 256
  }));

  ctx.strokeStyle = '#eab308'; // Bright engineering yellow
  ctx.lineWidth = isGlitch ? 2.5 : 2.0;
  
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = - (Math.floor(Date.now() / 140) % 10);
  
  ctx.beginPath();
  projected.forEach((wp, i) => {
    if (i === 0) ctx.moveTo(wp.px, wp.py);
    else ctx.lineTo(wp.px, wp.py);
  });
  ctx.stroke();
  ctx.setLineDash([]); // reset
}

// 6. Pragyan Waypoint Nodes
function renderWaypointsLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  let waypoints = (window as any).lunarRoverWaypoints;

  if (!waypoints || waypoints.length === 0) {
    // Fallback default waypoints
    const fallbackWps = [
      { wx: 110, wy: 110, name: 'Lander' },
      { wx: 124, wy: 116, name: 'WP-1' },
      { wx: 138, wy: 130, name: 'WP-2' },
      { wx: 132, wy: 142, name: 'WP-3' },
      { wx: 118, wy: 134, name: 'WP-4' }
    ];
    waypoints = fallbackWps.map((wp, idx) => ({
      id: idx === 0 ? 'WP-LND' : idx === fallbackWps.length - 1 ? 'WP-TGT' : `WP-0${idx}`,
      name: wp.name,
      gx: (128 * 256 + wp.wx) / 65536,
      gy: (128 * 256 + wp.wy) / 65536
    }));
  }

  const numTiles = Math.pow(2, z);
  waypoints.forEach((wp: any, index: number) => {
    const px = (wp.gx * numTiles - x) * 256;
    const py = (wp.gy * numTiles - y) * 256;

    if (px >= -10 && px <= 266 && py >= -10 && py <= 266) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(px, py, 9.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1.2;
      
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = index === 0 ? '#ef4444' : '#eab308';
      ctx.beginPath();
      ctx.arc(px, py, 2.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.0;
      ctx.strokeText(wp.id || `WP-0${index}`, px + 7, py + 3);
      ctx.fillText(wp.id || `WP-0${index}`, px + 7, py + 3);
    }
  });
}

// 6b. Rejected Path Candidates
function renderRejectedRoutesLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const rejected = (window as any).lunarRoverRejectedPaths;
  if (!rejected || rejected.length === 0) return;

  const numTiles = Math.pow(2, z);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; // Faint red
  ctx.lineWidth = 1.5;

  rejected.forEach((pathPts: any[]) => {
    const projected = pathPts.map((pt) => ({
      px: (pt.gx * numTiles - x) * 256,
      py: (pt.gy * numTiles - y) * 256
    }));

    ctx.beginPath();
    projected.forEach((wp, i) => {
      if (i === 0) ctx.moveTo(wp.px, wp.py);
      else ctx.lineTo(wp.px, wp.py);
    });
    ctx.stroke();
  });
}

// 6c. Mobility Phase Markers
function renderMissionTimelineLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const waypoints = (window as any).lunarRoverWaypoints;
  if (!waypoints || waypoints.length === 0) return;

  const numTiles = Math.pow(2, z);
  waypoints.forEach((wp: any, index: number) => {
    if (index === 0 || index === Math.floor(waypoints.length / 2) || index === waypoints.length - 1) {
      const px = (wp.gx * numTiles - x) * 256;
      const py = (wp.gy * numTiles - y) * 256;

      if (px >= 10 && px <= 246 && py >= 10 && py <= 246) {
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#c084fc'; // Purple-400
        
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.0;
        const name = index === 0 ? 'START' : index === waypoints.length - 1 ? 'SAMPLING' : 'MIDPOINT';
        ctx.strokeText(name, px - 18, py - 14);
        ctx.fillText(name, px - 18, py - 14);
      }
    }
  });
}

// 7. labels: Planetary Feature Labels with elegant cartographic styling
function renderLabelsLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const labelsList = [
    { name: 'SHACKLETON CRATER', cx: 0.5000, cy: 0.5000, color: '#f43f5e' },
    { name: 'SHOEMAKER BASIN', cx: 0.5060, cy: 0.4930, color: '#a855f7' },
    { name: 'NOBILE MOUNT', cx: 0.4930, cy: 0.5080, color: '#3b82f6' },
    { name: 'FAUSTINI VALLE', cx: 0.5090, cy: 0.5050, color: '#06b6d4' },
    { name: 'LSE-1 LANDING ZONE', cx: 0.502136, cy: 0.501525, color: '#10b981' }
  ];

  const numTiles = Math.pow(2, z);
  labelsList.forEach((lbl) => {
    const px = (lbl.cx * numTiles - x) * 256;
    const py = (lbl.cy * numTiles - y) * 256;
    
    if (px >= 5 && px <= 251 && py >= 10 && py <= 246) {
      ctx.font = isGlitch ? 'bold 8px "JetBrains Mono", monospace' : 'bold 9px "Inter", sans-serif';
      
      // Black background shadow for high cartographic contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(px - 4, py - 9, ctx.measureText(lbl.name).width + 8, 13);
      
      ctx.strokeStyle = isGlitch ? '#00ffff' : '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 4, py - 9, ctx.measureText(lbl.name).width + 8, 13);
      
      ctx.fillStyle = isGlitch ? '#00ffff' : '#ffffff';
      ctx.fillText(lbl.name, px, py);
    }
  });
}

// 8. Target Operational Boundary (Shackleton Rim dashed indicator)
function renderTargetCraterLayer(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, isGlitch: boolean) {
  const scale = Math.pow(2, z - 8);
  const localX = (128 - x * scale) * 256 + 128 * scale;
  const localY = (128 - y * scale) * 256 + 128 * scale;
  const localR = 220 * scale; // Shackleton radius in pixels at zoom 8

  if (localX + localR > 0 && localX - localR < 256 &&
      localY + localR > 0 && localY - localR < 256) {
    
    ctx.strokeStyle = '#ef4444'; // Red boundary
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(localX, localY, localR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // reset
  }
}

// Coordinate translation: maps OpenLayers projection meters to Lunar Latitude/Longitude
export function mapCoordsToLunar(x: number, y: number): { lon: number; lat: number } {
  const dist = Math.sqrt(x * x + y * y);
  
  // 1 degree latitude is approximately 30,270 meters on the Moon
  const latOffset = dist / 30270;
  const lat = -90 + latOffset;

  let lon = Math.atan2(y, x) * (180 / Math.PI);
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  return {
    lat: Math.min(-60, Math.max(-90, lat)),
    lon: lon
  };
}

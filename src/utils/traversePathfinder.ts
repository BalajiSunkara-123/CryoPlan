import { 
  getElevationAt, 
  getSlopeAt, 
  getHazardIndexAt, 
  getIlluminationAt, 
  getRoughnessAt, 
  mapCoordsToLunar 
} from './lunarGenerator';
import { RoverWaypoint, MissionTimelineEvent, TraverseAnalysisState } from '../types';

// Constants
const LUNAR_CIRCUMFERENCE_M = 10921000; // circumference in meters
const ROVER_CAPACITY_WH = 1200; // 1.2 kWh Pragyan-style battery
const ROVER_BASE_SPEED_KMH = 0.06; // 60 meters per hour baseline (1.6 cm/s)

/**
 * Calculates traversability cost of a point gx, gy from 0.0 to 1.0.
 */
export function getTraversabilityCost(
  gx: number,
  gy: number,
  startGx: number,
  startGy: number,
  mode: 'SHORTEST' | 'SAFEST' | 'ENERGY'
): number {
  const slope = Math.min(30, getSlopeAt(gx, gy, 8));
  const hazard = getHazardIndexAt(gx, gy, 8);
  const roughness = getRoughnessAt(gx, gy, 8);
  const illum = getIlluminationAt(gx, gy, 315, 45); // Direct Sun illumination 0 to 1
  const illumPenalty = 1.0 - illum;

  // Normalized variables between 0 and 1
  const normSlope = slope / 30;
  const normRoughness = Math.min(15, roughness) / 15;
  const distToStart = Math.hypot(gx - startGx, gy - startGy) / 0.015; // normalized local distance
  const normDistance = Math.min(1.0, distToStart);

  // Default weights:
  // Cost = 0.35 * Slope + 0.25 * Hazard + 0.15 * Roughness + 0.15 * Illumination Penalty + 0.10 * Distance
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
    wIllum = 0.40; // favors illuminated solar paths
    wDist = 0.10;
  }

  const cost = wSlope * normSlope +
               wHazard * hazard +
               wRoughness * normRoughness +
               wIllum * illumPenalty +
               wDist * normDistance;

  return Math.max(0.0, Math.min(1.0, cost));
}

// Convert global fractional delta to meters
export function getDistanceInMeters(gx1: number, gy1: number, gx2: number, gy2: number): number {
  const dx = (gx2 - gx1) * LUNAR_CIRCUMFERENCE_M;
  const dy = (gy2 - gy1) * LUNAR_CIRCUMFERENCE_M;
  return Math.sqrt(dx * dx + dy * dy);
}

interface PathNode {
  x: number;
  y: number;
  gx: number;
  gy: number;
  g: number;
  f: number;
  parent: PathNode | null;
}

/**
 * Executes pathfinding (A* or Dijkstra) from landing site to a target site.
 * Grid-based local search inside a dynamically sized bounding box.
 */
export function computeRoverTraverse(
  startGx: number,
  startGy: number,
  endGx: number,
  endGy: number,
  algorithm: 'A*' | 'Dijkstra',
  mode: 'SHORTEST' | 'SAFEST' | 'ENERGY'
): {
  path: { gx: number; gy: number }[];
  rejectedPaths: { gx: number; gy: number }[][];
  nodesExplored: number;
  pathCost: number;
  runtimeMs: number;
} {
  const startTime = performance.now();

  // 1. Establish Bounding Box with margin
  const margin = 0.006;
  const minGx = Math.min(startGx, endGx) - margin;
  const maxGx = Math.max(startGx, endGx) + margin;
  const minGy = Math.min(startGy, endGy) - margin;
  const maxGy = Math.max(startGy, endGy) + margin;

  // 2. Define grid dimensions
  const GRID_SIZE = 40; // 40x40 node grid
  
  const getCoords = (x: number, y: number) => {
    const gx = minGx + (x / GRID_SIZE) * (maxGx - minGx);
    const gy = minGy + (y / GRID_SIZE) * (maxGy - minGy);
    return { gx, gy };
  };

  const getGridPos = (gx: number, gy: number) => {
    const x = Math.round(((gx - minGx) / (maxGx - minGx)) * GRID_SIZE);
    const y = Math.round(((gy - minGy) / (maxGy - minGy)) * GRID_SIZE);
    return {
      x: Math.max(0, Math.min(GRID_SIZE, x)),
      y: Math.max(0, Math.min(GRID_SIZE, y))
    };
  };

  const startPos = getGridPos(startGx, startGy);
  const endPos = getGridPos(endGx, endGy);

  // A* / Dijkstra structures
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const allNodesMap = new Map<string, PathNode>();

  const startNode: PathNode = {
    x: startPos.x,
    y: startPos.y,
    gx: startGx,
    gy: startGy,
    g: 0,
    f: 0,
    parent: null
  };

  openSet.push(startNode);
  allNodesMap.set(`${startPos.x},${startPos.y}`, startNode);

  let nodesExplored = 0;
  let targetNode: PathNode | null = null;
  const poppedNodes: PathNode[] = []; // for rejected paths visualization

  while (openSet.length > 0) {
    // Sort open set to pop the minimum f (or g) node
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    nodesExplored++;
    
    poppedNodes.push(current);

    const key = `${current.x},${current.y}`;
    closedSet.add(key);

    // Target check
    if (current.x === endPos.x && current.y === endPos.y) {
      targetNode = current;
      break;
    }

    // Neighbors (8-connectivity)
    const dirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1]
    ];

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || nx > GRID_SIZE || ny < 0 || ny > GRID_SIZE) continue;
      if (closedSet.has(`${nx},${ny}`)) continue;

      const { gx: ngx, gy: ngy } = getCoords(nx, ny);

      // Evaluate traversability and hazard avoidance constraints
      const slope = getSlopeAt(ngx, ngy, 8);
      const hazard = getHazardIndexAt(ngx, ngy, 8);
      const roughness = getRoughnessAt(ngx, ngy, 8);

      // Severe hazard threshold blocking (Dijkstra/A* completely avoids unsafe zones)
      const isUnsafe = slope > 16 || hazard > 0.45 || roughness > 10;
      if (isUnsafe && mode === 'SAFEST') {
        continue; // Completely avoid
      }

      const costValue = getTraversabilityCost(ngx, ngy, startGx, startGy, mode);
      const dist = getDistanceInMeters(current.gx, current.gy, ngx, ngy);
      
      // Cost multiplier to highly penalize difficult terrain
      const terrainWeight = 1.0 + costValue * 15.0 + (isUnsafe ? 40.0 : 0.0);
      const transitionCost = dist * terrainWeight;
      const tentativeG = current.g + transitionCost;

      const nKey = `${nx},${ny}`;
      let neighbor = allNodesMap.get(nKey);

      if (!neighbor) {
        neighbor = {
          x: nx,
          y: ny,
          gx: ngx,
          gy: ngy,
          g: Infinity,
          f: Infinity,
          parent: null
        };
        allNodesMap.set(nKey, neighbor);
      }

      if (tentativeG < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentativeG;
        
        if (algorithm === 'A*') {
          // A* uses a straight-line heuristic in meters to end point
          const h = getDistanceInMeters(ngx, ngy, endGx, endGy);
          neighbor.f = tentativeG + h * 1.5; // slight target-biasing multiplier
        } else {
          // Dijkstra is purely g-based
          neighbor.f = tentativeG;
        }

        if (!openSet.some(node => node.x === nx && node.y === ny)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  // Backtrack optimal path
  const path: { gx: number; gy: number }[] = [];
  if (targetNode) {
    let curr: PathNode | null = targetNode;
    while (curr) {
      path.unshift({ gx: curr.gx, gy: curr.gy });
      curr = curr.parent;
    }
  } else {
    // Fallback direct path if search somehow blocked
    path.push({ gx: startGx, gy: startGy });
    path.push({ gx: endGx, gy: endGy });
  }

  // 3. Generate "Rejected Paths" for cartographic visual
  // We can construct 3-4 interesting alternative branches that were explored but discarded
  const rejectedPaths: { gx: number; gy: number }[][] = [];
  
  // Pick some branch nodes from poppedNodes that are not in the final path
  const finalKeys = new Set(path.map(p => `${getGridPos(p.gx, p.gy).x},${getGridPos(p.gx, p.gy).y}`));
  const nonPathPopped = poppedNodes.filter(n => !finalKeys.has(`${n.x},${n.y}`));

  // Generate 4 distinct rejected branches
  const numBranches = Math.min(4, Math.floor(nonPathPopped.length / 4));
  for (let b = 0; b < numBranches; b++) {
    const startNodeIdx = Math.floor((b + 1) * (nonPathPopped.length / (numBranches + 1)));
    let node: PathNode | null = nonPathPopped[startNodeIdx];
    const branch: { gx: number; gy: number }[] = [];
    
    let depth = 0;
    while (node && depth < 8) {
      branch.unshift({ gx: node.gx, gy: node.gy });
      node = node.parent;
      depth++;
    }
    if (branch.length > 2) {
      rejectedPaths.push(branch);
    }
  }

  // If no branches generated, add a couple of simulated direct hazard-blocked lines
  if (rejectedPaths.length === 0) {
    rejectedPaths.push([
      { gx: startGx, gy: startGy },
      { gx: startGx + (endGx - startGx) * 0.4, gy: startGy + (endGy - startGy) * 0.35 + 0.001 },
      { gx: startGx + (endGx - startGx) * 0.45, gy: startGy + (endGy - startGy) * 0.3 }
    ]);
  }

  const runtimeMs = performance.now() - startTime;
  const pathCost = targetNode ? targetNode.g : 0;

  return {
    path,
    rejectedPaths,
    nodesExplored,
    pathCost,
    runtimeMs
  };
}

/**
 * Extrapolates detailed metrics, waypoints, and timeline events along the path.
 */
export function generateTraverseDetails(
  path: { gx: number; gy: number }[],
  mode: 'SHORTEST' | 'SAFEST' | 'ENERGY'
): {
  waypoints: RoverWaypoint[];
  timeline: MissionTimelineEvent[];
  metrics: {
    totalDistanceKm: number;
    estimatedDurationSeconds: number;
    avgSpeedKmh: number;
    maxSlopeDeg: number;
    batteryConsumptionPct: number;
    solarExposurePct: number;
    hazardExposureScore: number;
    successProbability: number;
  }
} {
  const waypoints: RoverWaypoint[] = [];
  const timeline: MissionTimelineEvent[] = [];

  let totalDistanceM = 0;
  let totalTimeSeconds = 0;
  let currentBattery = 100.0;
  let maxSlope = 0;
  let totalHazard = 0;
  let solarIllumSum = 0;

  // Detailed traversal segment calculation
  const segmentsData: {
    gx: number;
    gy: number;
    distM: number;
    slope: number;
    hazard: number;
    rough: number;
    illum: number;
    elev: number;
    speed: number;
    timeSec: number;
    slip: number;
    res: number;
    batteryUse: number;
  }[] = [];

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    const slope = getSlopeAt(pt.gx, pt.gy, 8);
    const hazard = getHazardIndexAt(pt.gx, pt.gy, 8);
    const rough = getRoughnessAt(pt.gx, pt.gy, 8);
    const illum = getIlluminationAt(pt.gx, pt.gy, 315, 45);
    const elev = getElevationAt(pt.gx, pt.gy);

    let distM = 0;
    if (i > 0) {
      const prev = path[i - 1];
      distM = getDistanceInMeters(prev.gx, prev.gy, pt.gx, pt.gy);
    }

    // Terrain resistance and wheel slip
    const slip = 0.05 + (slope / 30) * 0.25; // 5% to 30% wheel slip
    const resistance = 0.08 + (rough / 15) * 0.42; // rolling resistance factor

    // Speed reduction on slopes and rough terrain
    // Base speed = 0.06 km/h. High slopes slow the rover down, descending might speed up slightly or keep controlled.
    let speed = ROVER_BASE_SPEED_KMH;
    if (slope > 5) {
      speed *= Math.max(0.2, 1.0 - (slope / 20)); // Slow down by up to 80% on steep climbs
    }
    if (rough > 6) {
      speed *= Math.max(0.4, 1.0 - (rough / 12)); // Slow down in rough boulder fields
    }

    const speedMps = (speed * 1000) / 3600;
    const timeSec = speedMps > 0 ? distM / speedMps : 0;

    // Energy consumption model: power draw (Watts)
    // base draw = 60W. Climbing slope draws more power.
    let powerDraw = 65.0; // Watts base
    if (slope > 0) powerDraw += slope * 4.5; // uphill energy draw
    powerDraw += (rough / 15) * 45.0; // rough terrain motor strain

    // Solar charging
    // solar panel produces up to 85 Watts in full sun
    const solarCharging = illum * 80.0;
    const netPower = powerDraw - solarCharging; // Net draw

    const energyUseWh = (netPower * (timeSec / 3600));

    segmentsData.push({
      gx: pt.gx,
      gy: pt.gy,
      distM,
      slope,
      hazard,
      rough,
      illum,
      elev,
      speed,
      timeSec,
      slip,
      res: resistance,
      batteryUse: energyUseWh
    });

    totalDistanceM += distM;
    totalTimeSeconds += timeSec;
    maxSlope = Math.max(maxSlope, slope);
    totalHazard += hazard;
    solarIllumSum += illum;
  }

  // Dynamic Waypoint Generation
  // Spacing waypoints evenly along the path (5 total waypoints, plus start and end)
  const numWaypoints = 6;
  const targetIndexes: number[] = [];
  
  if (path.length > 0) {
    targetIndexes.push(0); // Start site
    for (let k = 1; k < numWaypoints - 1; k++) {
      const idx = Math.floor((k / (numWaypoints - 1)) * (path.length - 1));
      if (!targetIndexes.includes(idx)) {
        targetIndexes.push(idx);
      }
    }
    if (!targetIndexes.includes(path.length - 1)) {
      targetIndexes.push(path.length - 1);
    }
  }

  targetIndexes.sort((a, b) => a - b);

  let cumDistM = 0;
  let cumTimeSec = 0;

  targetIndexes.forEach((pIdx, wIdx) => {
    // accumulate up to this index
    let distSum = 0;
    let timeSum = 0;
    let batteryDrawSum = 0;

    for (let j = 0; j <= pIdx; j++) {
      distSum += segmentsData[j].distM;
      timeSum += segmentsData[j].timeSec;
      batteryDrawSum += segmentsData[j].batteryUse;
    }

    const pt = segmentsData[pIdx];
    const batteryPct = Math.max(10, Math.min(100, 100 - (batteryDrawSum / ROVER_CAPACITY_WH) * 100));

    // Format Arrival time
    const totalHours = Math.floor(timeSum / 3600);
    const totalMins = Math.floor((timeSum % 3600) / 60);
    const totalSecs = Math.floor(timeSum % 60);
    const arrivalTimeStr = `+${totalHours.toString().padStart(2, '0')}h ${totalMins.toString().padStart(2, '0')}m`;

    const latLon = mapCoordsToLunar((pt.gx - 0.5) * 40075016, (0.5 - pt.gy) * 40075016);

    const wpName = wIdx === 0 
      ? 'Landing Site (LSE)'
      : wIdx === targetIndexes.length - 1
        ? 'Scientific Target'
        : `Autonomous WP-0${wIdx}`;

    waypoints.push({
      id: wIdx === 0 ? 'WP-LND' : wIdx === targetIndexes.length - 1 ? 'WP-TGT' : `WP-0${wIdx}`,
      name: wpName,
      coords: latLon,
      gx: pt.gx,
      gy: pt.gy,
      distance: Number((distSum / 1000).toFixed(3)),
      elevation: Math.round(pt.elev),
      slope: Number(pt.slope.toFixed(1)),
      arrivalTime: arrivalTimeStr,
      batteryRemaining: Math.round(batteryPct),
      hazardRating: Number(pt.hazard.toFixed(3))
    });
  });

  // Timeline events generation (Step 8)
  const totalHours = Math.floor(totalTimeSeconds / 3600);
  const totalMins = Math.floor((totalTimeSeconds % 3600) / 60);

  timeline.push({
    id: 'E1',
    name: 'Landing & Checkout',
    time: '+00h 00m',
    battery: 100,
    distance: 0,
    description: 'Vikram lander touchdown. Systems check nominal. Deploying solar array.'
  });

  timeline.push({
    id: 'E2',
    name: 'Deploy Pragyan Rover',
    time: '+00h 45m',
    battery: 98,
    distance: 0,
    description: 'Ramp deployed successfully. Pragyan rover rolled down onto lunar regolith.'
  });

  // Intermediate waypoints in timeline
  waypoints.forEach((wp, idx) => {
    if (idx > 0 && idx < waypoints.length - 1) {
      timeline.push({
        id: `E-WP${idx}`,
        name: `Traverse to ${wp.name}`,
        time: wp.arrivalTime,
        battery: wp.batteryRemaining,
        distance: wp.distance,
        description: `Autonomous mobility phase completed. Navigating around local slope of ${wp.slope}°`
      });
    }
  });

  timeline.push({
    id: 'E3',
    name: 'Scientific Sampling',
    time: `+${(totalHours * 0.95).toFixed(0).padStart(2, '0')}h ${(totalMins * 0.95).toFixed(0).padStart(2, '0')}m`,
    battery: Math.round(waypoints[waypoints.length - 1].batteryRemaining),
    distance: Number((totalDistanceM / 1000).toFixed(2)),
    description: `Target crater rim reached. Active laser spectroscopy chemical soil analysis triggered.`
  });

  timeline.push({
    id: 'E4',
    name: 'Mission Phase Complete',
    time: `+${totalHours.toString().padStart(2, '0')}h ${totalMins.toString().padStart(2, '0')}m`,
    battery: Math.round(waypoints[waypoints.length - 1].batteryRemaining - 4),
    distance: Number((totalDistanceM / 1000).toFixed(2)),
    description: 'Scientific telemetry package transmitted to Vikram lander. Static battery safety standby initiated.'
  });

  // Metrics (Step 9)
  const totalDistanceKm = Number((totalDistanceM / 1000).toFixed(3));
  const avgSpeedKmh = Number((totalDistanceKm / (totalTimeSeconds / 3600)).toFixed(4));
  const batteryConsumptionPct = Number((100 - waypoints[waypoints.length - 1].batteryRemaining).toFixed(1));
  const solarExposurePct = Math.round((solarIllumSum / path.length) * 100);
  const avgHazard = totalHazard / path.length;
  
  // Calculate success probability based on mode, max slope, and hazard index
  let baseSuccess = 0.98;
  if (maxSlope > 15) baseSuccess -= (maxSlope - 15) * 0.02;
  baseSuccess -= avgHazard * 0.15;
  if (mode === 'SAFEST') baseSuccess += 0.03;
  if (mode === 'SHORTEST') baseSuccess -= 0.04;
  const successProbability = Number(Math.max(0.65, Math.min(0.99, baseSuccess)).toFixed(2));

  return {
    waypoints,
    timeline,
    metrics: {
      totalDistanceKm,
      estimatedDurationSeconds: Math.round(totalTimeSeconds),
      avgSpeedKmh,
      maxSlopeDeg: Number(maxSlope.toFixed(1)),
      batteryConsumptionPct,
      solarExposurePct,
      hazardExposureScore: Number(avgHazard.toFixed(3)),
      successProbability
    }
  };
}

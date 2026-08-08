import { load as loadYaml } from "js-yaml";

export type MapInfo = {
  resolution: number;
  originX: number;
  originY: number;
  originYaw: number;
};

export type Waypoint = {
  id: number;
  name: string;
  x: number;
  y: number;
  yaw: number;
};

export type Viewport = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type SatelliteLayer = {
  image: HTMLImageElement;
  name: string;
  opacity: number;
  visible: boolean;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
};

export const DEFAULT_MAP: MapInfo = {
  resolution: 0.05,
  originX: 0,
  originY: 0,
  originYaw: 0,
};

export const DEFAULT_VIEWPORT: Viewport = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMapYaml(text: string): MapInfo {
  const readNumber = (key: string, fallback: number) =>
    Number(
      text.match(new RegExp(`^\\s*${key}\\s*:\\s*([-+.\\deE]+)`, "m"))?.[1] ??
        fallback,
    );
  const origin = text.match(
    /^\s*origin\s*:\s*\[\s*([-+.\deE]+)\s*,\s*([-+.\deE]+)\s*,\s*([-+.\deE]+)\s*\]/m,
  );

  return {
    resolution: readNumber("resolution", DEFAULT_MAP.resolution),
    originX: origin ? Number(origin[1]) : 0,
    originY: origin ? Number(origin[2]) : 0,
    originYaw: origin ? Number(origin[3]) : 0,
  };
}

export function parseWaypointsYaml(text: string): Omit<Waypoint, "id">[] {
  const document: unknown = loadYaml(text);
  const root = isRecord(document) ? document : null;
  const entries = Array.isArray(document)
    ? document
    : root && Array.isArray(root.waypoints)
      ? root.waypoints
      : root && Array.isArray(root.poses)
        ? root.poses
        : null;

  if (!entries) throw new Error("No waypoints or poses array was found.");
  if (!entries.length) {
    throw new Error("The file does not contain any waypoints.");
  }

  return entries.map((entry, index) => parseWaypoint(entry, index));
}

function parseWaypoint(entry: unknown, index: number): Omit<Waypoint, "id"> {
  if (!isRecord(entry)) {
    throw new Error(`Waypoint ${index + 1} has an invalid format.`);
  }

  const pose = isRecord(entry.pose) ? entry.pose : entry;
  const position = isRecord(pose.position)
    ? pose.position
    : isRecord(entry.point)
      ? entry.point
      : pose;
  const orientation = isRecord(pose.orientation)
    ? pose.orientation
    : isRecord(entry.orientation)
      ? entry.orientation
      : null;
  const x = Number(position.x);
  const y = Number(position.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(
      `Waypoint ${index + 1} does not have valid x and y values.`,
    );
  }

  let yaw = Number(entry.yaw ?? entry.angle ?? pose.yaw);
  if (!Number.isFinite(yaw) && orientation) {
    yaw = quaternionToYaw(orientation, index);
  }

  return {
    name: typeof entry.name === "string" ? entry.name : `waypoint_${index}`,
    x,
    y,
    yaw: Number.isFinite(yaw) ? yaw : 0,
  };
}

function quaternionToYaw(
  orientation: Record<string, unknown>,
  waypointIndex: number,
): number {
  const x = Number(orientation.x ?? 0);
  const y = Number(orientation.y ?? 0);
  const z = Number(orientation.z ?? 0);
  const w = Number(orientation.w ?? 1);

  if (![x, y, z, w].every(Number.isFinite)) {
    throw new Error(
      `Waypoint ${waypointIndex + 1} has an invalid orientation.`,
    );
  }

  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

export function radiansToDegrees(radians: number): number {
  return Math.round((radians * 180) / Math.PI);
}

export function formatCoordinate(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function waypointNameBase(waypoints: Waypoint[]): number {
  if (waypoints.some((waypoint) => waypoint.name === "waypoint_0")) return 0;
  if (waypoints.some((waypoint) => waypoint.name === "waypoint_1")) return 1;
  return 0;
}

export function renumberWaypointNames(
  waypoints: Waypoint[],
  base: number,
): Waypoint[] {
  return waypoints.map((waypoint, index) =>
    /^waypoint_\d+$/.test(waypoint.name)
      ? { ...waypoint, name: `waypoint_${index + base}` }
      : waypoint,
  );
}

export function worldToMapPixel(
  point: Pick<Waypoint, "x" | "y">,
  map: MapInfo,
  canvasHeight: number,
): { x: number; y: number } {
  const deltaX = point.x - map.originX;
  const deltaY = point.y - map.originY;
  const cosine = Math.cos(-map.originYaw);
  const sine = Math.sin(-map.originYaw);
  const localX = cosine * deltaX - sine * deltaY;
  const localY = sine * deltaX + cosine * deltaY;

  return {
    x: localX / map.resolution,
    y: canvasHeight - localY / map.resolution,
  };
}

export function mapPixelToWorld(
  imageX: number,
  imageY: number,
  map: MapInfo,
  canvasHeight: number,
): { x: number; y: number } {
  const localX = imageX * map.resolution;
  const localY = (canvasHeight - imageY) * map.resolution;
  const cosine = Math.cos(map.originYaw);
  const sine = Math.sin(map.originYaw);

  return {
    x: map.originX + cosine * localX - sine * localY,
    y: map.originY + sine * localX + cosine * localY,
  };
}

export function serializeWaypointsYaml(waypoints: Waypoint[]): string {
  const lines = waypoints.flatMap((waypoint) => {
    const orientationZ = Math.sin(waypoint.yaw / 2);
    const orientationW = Math.cos(waypoint.yaw / 2);

    return [
      `- name: ${waypoint.name || "waypoint"}`,
      "  position:",
      `    x: ${formatCoordinate(waypoint.x)}`,
      `    y: ${formatCoordinate(waypoint.y)}`,
      "    z: 0.0",
      "  orientation:",
      "    x: 0.0",
      "    y: 0.0",
      `    z: ${formatCoordinate(orientationZ)}`,
      `    w: ${formatCoordinate(orientationW)}`,
    ];
  });

  return ["frame_id: map", "waypoints:", ...lines].join("\n") + "\n";
}

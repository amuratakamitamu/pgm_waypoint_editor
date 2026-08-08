import { worldToMapPixel } from "@/lib/waypoint-map";
import type {
  MapInfo,
  SatelliteLayer,
  Viewport,
  Waypoint,
} from "@/lib/waypoint-map";

type RenderMapOptions = {
  context: CanvasRenderingContext2D;
  mapCanvas: HTMLCanvasElement | null;
  mapInfo: MapInfo;
  satellite: SatelliteLayer | null;
  selectedWaypointId: number | null;
  viewport: Viewport;
  waypoints: Waypoint[];
};

export function renderMap({
  context,
  mapCanvas,
  mapInfo,
  satellite,
  selectedWaypointId,
  viewport,
  waypoints,
}: RenderMapOptions): void {
  const { width, height } = context.canvas;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(viewport.offsetX, viewport.offsetY);
  context.scale(viewport.zoom, viewport.zoom);

  if (mapCanvas) context.drawImage(mapCanvas, 0, 0, width, height);
  if (satellite?.visible) drawSatellite(context, satellite, width, height);

  waypoints.forEach((waypoint, index) => {
    drawWaypoint(
      context,
      waypoint,
      index,
      waypoint.id === selectedWaypointId,
      mapInfo,
      width,
      height,
    );
  });

  context.restore();
}

function drawSatellite(
  context: CanvasRenderingContext2D,
  satellite: SatelliteLayer,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const fitScale =
    Math.min(
      canvasWidth / satellite.image.naturalWidth,
      canvasHeight / satellite.image.naturalHeight,
    ) * satellite.scale;
  const width = satellite.image.naturalWidth * fitScale;
  const height = satellite.image.naturalHeight * fitScale;

  context.save();
  context.globalAlpha = satellite.opacity;
  context.translate(
    canvasWidth / 2 + satellite.offsetX,
    canvasHeight / 2 + satellite.offsetY,
  );
  context.rotate((satellite.rotation * Math.PI) / 180);
  context.drawImage(satellite.image, -width / 2, -height / 2, width, height);
  context.restore();
}

function drawWaypoint(
  context: CanvasRenderingContext2D,
  waypoint: Waypoint,
  index: number,
  isSelected: boolean,
  mapInfo: MapInfo,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const position = worldToMapPixel(waypoint, mapInfo, canvasHeight);
  const angle = -(waypoint.yaw - mapInfo.originYaw);
  const color = isSelected ? "#f97316" : "#2563eb";

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(2, canvasWidth / 400);
  context.beginPath();
  context.arc(
    position.x,
    position.y,
    Math.max(6, canvasWidth / 90),
    0,
    Math.PI * 2,
  );
  context.fill();

  context.beginPath();
  context.moveTo(position.x, position.y);
  context.lineTo(
    position.x + (Math.cos(angle) * canvasWidth) / 18,
    position.y + (Math.sin(angle) * canvasWidth) / 18,
  );
  context.stroke();

  context.fillStyle = "white";
  context.font = `bold ${Math.max(10, canvasWidth / 55)}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1), position.x, position.y + 1);
}

"use client";

import {
  ChangeEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Download,
  FileImage,
  Hand,
  MapPin,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SourceSidebar } from "@/components/source-sidebar";
import { WaypointSidebar } from "@/components/waypoint-sidebar";
import { useWaypointHistory } from "@/hooks/use-waypoint-history";
import type { WaypointSnapshot } from "@/hooks/use-waypoint-history";
import { renderMap } from "@/lib/map-renderer";
import { parsePgm } from "@/lib/pgm";
import {
  DEFAULT_MAP,
  DEFAULT_VIEWPORT,
  formatCoordinate,
  mapPixelToWorld,
  parseMapYaml,
  parseWaypointsYaml,
  radiansToDegrees,
  renumberWaypointNames,
  serializeWaypointsYaml,
  waypointNameBase,
  worldToMapPixel,
} from "@/lib/waypoint-map";
import type { SatelliteLayer, Viewport, Waypoint } from "@/lib/waypoint-map";

type EditorMode = "add" | "edit";

export default function Home() {
  const [mapCanvas, setMapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mapInfo, setMapInfo] = useState(DEFAULT_MAP);
  const [mapName, setMapName] = useState<string>("");
  const [waypointsName, setWaypointsName] = useState<string>("");
  const {
    waypoints,
    waypointsRef,
    selectedWaypointId: selected,
    selectedWaypointIdRef: selectedRef,
    setSelectedWaypointId: setSelected,
    takeSnapshot: snapshotWaypoints,
    pushHistory: pushWaypointHistory,
    replaceWaypoints,
    commitWaypoints,
    undo: undoWaypointChange,
    redo: redoWaypointChange,
    canUndo,
    canRedo,
  } = useWaypointHistory();
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [satellite, setSatellite] = useState<SatelliteLayer | null>(null);
  const [aligningSatellite, setAligningSatellite] = useState(false);
  const [googleLocation, setGoogleLocation] = useState({
    lat: "35.681236",
    lng: "139.767125",
    zoom: 18,
  });
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const waypointDragRef = useRef<{
    id: number;
    snapshot: WaypointSnapshot;
    moved: boolean;
  } | null>(null);
  const panningRef = useRef<{
    x: number;
    y: number;
    viewport: Viewport;
  } | null>(null);
  const satelliteDragRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const undo = () => {
    drawingRef.current = false;
    waypointDragRef.current = null;
    if (undoWaypointChange()) setMessage("Undid the last action.");
  };
  const redo = () => {
    drawingRef.current = false;
    waypointDragRef.current = null;
    if (redoWaypointChange()) setMessage("Redid the last action.");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    renderMap({
      context,
      mapCanvas,
      mapInfo,
      satellite,
      selectedWaypointId: selected,
      viewport,
      waypoints,
    });
  }, [mapCanvas, mapInfo, satellite, selected, viewport, waypoints]);

  useEffect(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, [mapCanvas]);

  const handlePgm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const decoded = await parsePgm(file);
      setMapCanvas(decoded);
      setMapName(file.name);
      setMessage(`${file.name} loaded. Use the mouse wheel to zoom.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load the PGM file.",
      );
    }
  };
  const handleYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setMapInfo(parseMapYaml(await file.text()));
      setMessage(`Loaded coordinate settings from ${file.name}.`);
    } catch {
      setMessage("Failed to load the YAML file.");
    }
  };
  const handleWaypointsYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const loaded = parseWaypointsYaml(await file.text());
      if (
        waypoints.length &&
        !window.confirm(
          `Replace the current ${waypoints.length} waypoints with the ${loaded.length} waypoints from this file?`,
        )
      )
        return;
      const idBase = Date.now();
      commitWaypoints(
        loaded.map((point, index) => ({ ...point, id: idBase + index })),
        null,
      );
      setWaypointsName(file.name);
      setMessage(`Loaded ${loaded.length} waypoints from ${file.name}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load the waypoints YAML file.",
      );
    } finally {
      input.value = "";
    }
  };
  const handleSatellite = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      setSatellite({
        image,
        name: file.name,
        opacity: 0.55,
        visible: true,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
      });
      setAligningSatellite(true);
      setMessage(
        `${file.name} added as an overlay. Drag it to align the image.`,
      );
    } catch {
      setMessage("Failed to load the satellite image.");
    } finally {
      URL.revokeObjectURL(url);
      event.target.value = "";
    }
  };
  const fetchGoogleSatellite = async () => {
    const lat = Number(googleLocation.lat);
    const lng = Number(googleLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setMessage("Enter a latitude and longitude.");
      return;
    }
    let width = 640;
    let height = 640;
    if (mapCanvas) {
      const ratio = mapCanvas.width / mapCanvas.height;
      if (ratio >= 1) height = Math.max(100, Math.round(width / ratio));
      else width = Math.max(100, Math.round(height * ratio));
    }
    setLoadingGoogle(true);
    try {
      const query = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        zoom: String(googleLocation.zoom),
        width: String(width),
        height: String(height),
      });
      const response = await fetch(`/api/satellite?${query}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || "Could not fetch the image from Google Maps.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        setSatellite({
          image,
          name: `Google Satellite (${formatCoordinate(lat)}, ${formatCoordinate(lng)})`,
          opacity: 0.55,
          visible: true,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotation: 0,
        });
        setAligningSatellite(true);
        setMessage(
          "Fetched a satellite image from Google Maps. Drag it to align the image.",
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not fetch the image from Google Maps.",
      );
    } finally {
      setLoadingGoogle(false);
    }
  };
  const updateSatellite = (patch: Partial<SatelliteLayer>) =>
    setSatellite((current) => (current ? { ...current, ...patch } : null));
  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const px = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
    const py = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
    const imageX = (px - viewport.offsetX) / viewport.zoom;
    const imageY = (py - viewport.offsetY) / viewport.zoom;
    const worldPosition = mapPixelToWorld(
      imageX,
      imageY,
      mapInfo,
      canvas.height,
    );

    return { ...worldPosition, px, py };
  };
  const selectedWaypoint =
    waypoints.find((point) => point.id === selected) ?? null;
  const updateWaypoint = (id: number, patch: Partial<Waypoint>) =>
    commitWaypoints(
      waypointsRef.current.map((point) =>
        point.id === id ? { ...point, ...patch } : point,
      ),
    );
  const deleteWaypoint = (id: number) => {
    const points = waypointsRef.current;
    commitWaypoints(
      renumberWaypointNames(
        points.filter((point) => point.id !== id),
        waypointNameBase(points),
      ),
      selectedRef.current === id ? null : selectedRef.current,
    );
  };
  const waypointAt = (px: number, py: number, canvas: HTMLCanvasElement) => {
    const hitRadius = Math.max(10, canvas.width / 70) * viewport.zoom;
    return (
      [...waypoints].reverse().find((point) => {
        const mapPosition = worldToMapPixel(point, mapInfo, canvas.height);
        const pointX = mapPosition.x * viewport.zoom + viewport.offsetX;
        const pointY = mapPosition.y * viewport.zoom + viewport.offsetY;
        return Math.hypot(px - pointX, py - pointY) <= hitRadius;
      }) ?? null
    );
  };
  const startPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!mapCanvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === 1 || event.button === 2) {
      panningRef.current = { x: event.clientX, y: event.clientY, viewport };
      return;
    }
    if (event.button !== 0) return;
    if (aligningSatellite && satellite) {
      satelliteDragRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: satellite.offsetX,
        offsetY: satellite.offsetY,
      };
      return;
    }
    const p = pointFromEvent(event);
    if (editorMode === "edit") {
      const point = waypointAt(p.px, p.py, event.currentTarget);
      if (point) {
        setSelected(point.id);
        selectedRef.current = point.id;
        waypointDragRef.current = {
          id: point.id,
          snapshot: snapshotWaypoints(),
          moved: false,
        };
      } else {
        setSelected(null);
        selectedRef.current = null;
      }
      return;
    }
    const id = Date.now();
    const points = waypointsRef.current;
    drawingRef.current = true;
    commitWaypoints(
      [
        ...points,
        {
          id,
          name: `waypoint_${points.length + waypointNameBase(points)}`,
          x: p.x,
          y: p.y,
          yaw: mapInfo.originYaw,
        },
      ],
      id,
    );
  };
  const turnPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) {
      const pan = panningRef.current;
      const canvas = event.currentTarget;
      const bounds = canvas.getBoundingClientRect();
      setViewport({
        ...pan.viewport,
        offsetX:
          pan.viewport.offsetX +
          ((event.clientX - pan.x) * canvas.width) / bounds.width,
        offsetY:
          pan.viewport.offsetY +
          ((event.clientY - pan.y) * canvas.height) / bounds.height,
      });
      return;
    }
    if (satelliteDragRef.current) {
      const drag = satelliteDragRef.current;
      const canvas = event.currentTarget;
      const bounds = canvas.getBoundingClientRect();
      updateSatellite({
        offsetX:
          drag.offsetX +
          ((event.clientX - drag.x) * canvas.width) /
            bounds.width /
            viewport.zoom,
        offsetY:
          drag.offsetY +
          ((event.clientY - drag.y) * canvas.height) /
            bounds.height /
            viewport.zoom,
      });
      return;
    }
    if (waypointDragRef.current !== null) {
      const p = pointFromEvent(event);
      const drag = waypointDragRef.current;
      if (!drag.moved) {
        pushWaypointHistory(drag.snapshot);
        drag.moved = true;
      }
      replaceWaypoints(
        waypointsRef.current.map((point) =>
          point.id === drag.id ? { ...point, x: p.x, y: p.y } : point,
        ),
      );
      return;
    }
    if (!drawingRef.current || selectedRef.current === null) return;
    const p = pointFromEvent(event);
    replaceWaypoints(
      waypointsRef.current.map((item) =>
        item.id === selectedRef.current
          ? { ...item, yaw: Math.atan2(p.y - item.y, p.x - item.x) }
          : item,
      ),
    );
  };
  const finishPointer = () => {
    drawingRef.current = false;
    waypointDragRef.current = null;
    panningRef.current = null;
    satelliteDragRef.current = null;
  };
  const zoomAt = (
    factor: number,
    canvas?: HTMLCanvasElement,
    clientX?: number,
    clientY?: number,
  ) => {
    const target = canvas ?? canvasRef.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const px =
      clientX === undefined
        ? target.width / 2
        : ((clientX - bounds.left) * target.width) / bounds.width;
    const py =
      clientY === undefined
        ? target.height / 2
        : ((clientY - bounds.top) * target.height) / bounds.height;
    setViewport((current) => {
      const zoom = Math.min(6, Math.max(0.25, current.zoom * factor));
      const scale = zoom / current.zoom;
      return {
        zoom,
        offsetX: px - (px - current.offsetX) * scale,
        offsetY: py - (py - current.offsetY) * scale,
      };
    });
  };
  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    zoomAt(
      event.deltaY < 0 ? 1.15 : 1 / 1.15,
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
  };
  const exportYaml = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([serializeWaypointsYaml(waypoints)], {
        type: "application/x-yaml",
      }),
    );
    link.download = "waypoints.yaml";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const aspect = mapCanvas
    ? `${mapCanvas.width} / ${mapCanvas.height}`
    : "16 / 10";
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
              <MapPin size={19} />
            </div>
            <div>
              <h1 className="text-base font-semibold">PGM Waypoint Editor</h1>
              <p className="text-xs text-slate-500">Made by Keita Sekiguchi</p>
            </div>
          </div>
          <Badge>{waypoints.length} waypoints</Badge>
        </div>
      </header>
      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-[260px_minmax(0,1fr)_340px] gap-5 overflow-hidden px-5 py-5">
        <SourceSidebar
          mapName={mapName}
          waypointsName={waypointsName}
          satellite={satellite}
          googleLocation={googleLocation}
          isFetchingSatellite={loadingGoogle}
          isAligningSatellite={aligningSatellite}
          onPgmChange={handlePgm}
          onMapYamlChange={handleYaml}
          onWaypointsYamlChange={handleWaypointsYaml}
          onSatelliteImageChange={handleSatellite}
          onFetchSatellite={fetchGoogleSatellite}
          onGoogleLocationChange={(patch) =>
            setGoogleLocation((current) => ({ ...current, ...patch }))
          }
          onSatelliteChange={updateSatellite}
          onAlignmentChange={setAligningSatellite}
          onSatelliteRemove={() => {
            setSatellite(null);
            setAligningSatellite(false);
          }}
        />
        <section className="min-w-0 min-h-0">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                  <Button
                    variant={editorMode === "add" ? "default" : "ghost"}
                    className="h-8 px-3"
                    onClick={() => {
                      setEditorMode("add");
                      setAligningSatellite(false);
                    }}
                  >
                    <Plus size={15} />
                    Add
                  </Button>
                  <Button
                    variant={editorMode === "edit" ? "default" : "ghost"}
                    className="h-8 px-3"
                    onClick={() => {
                      setEditorMode("edit");
                      setAligningSatellite(false);
                    }}
                  >
                    <Pencil size={14} />
                    Edit
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                  onClick={undo}
                  disabled={!canUndo}
                >
                  <Undo2 size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
                  aria-label="Redo"
                  onClick={redo}
                  disabled={!canRedo}
                >
                  <Redo2 size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Zoom out"
                  onClick={() => zoomAt(1 / 1.25)}
                  disabled={!mapCanvas}
                >
                  <ZoomOut size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Zoom in"
                  onClick={() => zoomAt(1.25)}
                  disabled={!mapCanvas}
                >
                  <ZoomIn size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Reset view"
                  onClick={() =>
                    setViewport({ zoom: 1, offsetX: 0, offsetY: 0 })
                  }
                  disabled={!mapCanvas}
                >
                  <Hand size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Delete all waypoints"
                  onClick={() => commitWaypoints([], null)}
                  disabled={!waypoints.length}
                >
                  <RotateCcw size={16} />
                </Button>
                <Button onClick={exportYaml} disabled={!waypoints.length}>
                  <Download size={16} /> Download YAML
                </Button>
              </div>
            </div>
            <div className="bg-slate-100 p-4">
              <div
                className="relative mx-auto max-h-[65vh] max-w-full overflow-hidden rounded-lg bg-slate-200"
                style={{
                  aspectRatio: aspect,
                  width: mapCanvas ? "min(100%, 960px)" : "100%",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={mapCanvas?.width ?? 960}
                  height={mapCanvas?.height ?? 600}
                  onPointerDown={startPoint}
                  onPointerMove={turnPoint}
                  onPointerUp={finishPointer}
                  onPointerCancel={finishPointer}
                  onContextMenu={(event) => event.preventDefault()}
                  onWheel={handleWheel}
                  className={`absolute inset-0 h-full w-full ${panningRef.current || satelliteDragRef.current || waypointDragRef.current !== null ? "cursor-grabbing" : aligningSatellite || editorMode === "edit" ? "cursor-move" : "cursor-crosshair"}`}
                />
                {!mapCanvas && (
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <FileImage
                        className="mx-auto mb-3 text-slate-400"
                        size={30}
                      />
                      <p className="text-sm font-medium text-slate-600">
                        Upload a PGM map
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        P2 and P5 formats are supported
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">
                {aligningSatellite
                  ? "Drag the satellite image to align / Right-drag to pan the map"
                  : editorMode === "edit"
                    ? "Drag a waypoint to move it / Ctrl+Z to undo / Right-drag to pan the map"
                    : "Drag to add a waypoint and set its direction / Ctrl+Z to undo / Right-drag to pan the map"}
              </p>
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <h2 className="font-semibold">Map parameters</h2>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Resolution</span>
                  <span>{mapInfo.resolution} m/px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Origin</span>
                  <span>
                    {mapInfo.originX}, {mapInfo.originY}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Yaw</span>
                  <span>{radiansToDegrees(mapInfo.originYaw)}°</span>
                </div>
              </div>
            </div>
          </Card>
        </section>
        <WaypointSidebar
          waypoints={waypoints}
          selectedWaypoint={selectedWaypoint}
          onDelete={deleteWaypoint}
          onUpdate={updateWaypoint}
          onSelect={(id) => {
            setSelected(id);
            setEditorMode("edit");
            setAligningSatellite(false);
          }}
        />
      </div>
    </main>
  );
}

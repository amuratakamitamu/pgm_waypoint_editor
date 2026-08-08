"use client";

import { ChangeEvent, PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, FileImage, FileUp, Hand, ImagePlus, Layers, Loader2, MapPin, Move, Pencil, Plus, Redo2, RotateCcw, Satellite, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { load as loadYaml } from "js-yaml";

type MapInfo = { resolution: number; originX: number; originY: number; originYaw: number };
type Waypoint = { id: number; name: string; x: number; y: number; yaw: number };
type Viewport = { zoom: number; offsetX: number; offsetY: number };
type EditorMode = "add" | "edit";
type SatelliteLayer = { image: HTMLImageElement; name: string; opacity: number; visible: boolean; offsetX: number; offsetY: number; scale: number; rotation: number };
type WaypointSnapshot = { waypoints: Waypoint[]; selected: number | null };
const defaultMap: MapInfo = { resolution: 0.05, originX: 0, originY: 0, originYaw: 0 };
const historyLimit = 100;

function readToken(bytes: Uint8Array, index: number) {
  while (index < bytes.length && (bytes[index] === 9 || bytes[index] === 10 || bytes[index] === 13 || bytes[index] === 32)) index++;
  if (bytes[index] === 35) { while (index < bytes.length && bytes[index] !== 10) index++; return readToken(bytes, index); }
  const start = index; while (index < bytes.length && ![9, 10, 13, 32].includes(bytes[index])) index++;
  return { token: new TextDecoder().decode(bytes.slice(start, index)), index };
}

async function parsePgm(file: File): Promise<HTMLCanvasElement> {
  const bytes = new Uint8Array(await file.arrayBuffer()); let at = 0;
  const next = () => { const value = readToken(bytes, at); at = value.index; return value.token; };
  const magic = next(); const width = Number(next()); const height = Number(next()); const max = Number(next());
  if (!(["P2", "P5"].includes(magic)) || !width || !height || !max) throw new Error("P2 または P5 形式の PGM を選択してください。");
  const pixels = new Uint8ClampedArray(width * height * 4);
  if (magic === "P2") {
    for (let i = 0; i < width * height; i++) { const value = Math.round((Number(next()) / max) * 255); pixels.set([value, value, value, 255], i * 4); }
  } else {
    while (at < bytes.length && [9, 10, 13, 32].includes(bytes[at])) at++;
    const sixteenBit = max > 255;
    for (let i = 0; i < width * height; i++) { const raw = sixteenBit ? bytes[at++] * 256 + bytes[at++] : bytes[at++]; const value = Math.round((raw / max) * 255); pixels.set([value, value, value, 255], i * 4); }
  }
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0); return canvas;
}

function parseMapYaml(text: string): MapInfo {
  const number = (key: string, fallback: number) => Number(text.match(new RegExp(`^\\s*${key}\\s*:\\s*([-+.\\deE]+)`, "m"))?.[1] ?? fallback);
  const origin = text.match(/^\s*origin\s*:\s*\[\s*([-+.\deE]+)\s*,\s*([-+.\deE]+)\s*,\s*([-+.\deE]+)\s*\]/m);
  return { resolution: number("resolution", defaultMap.resolution), originX: origin ? Number(origin[1]) : 0, originY: origin ? Number(origin[2]) : 0, originYaw: origin ? Number(origin[3]) : 0 };
}

function parseWaypointsYaml(text: string): Omit<Waypoint, "id">[] {
  const document: unknown = loadYaml(text);
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const root = isRecord(document) ? document : null;
  const entries = Array.isArray(document) ? document : root && (Array.isArray(root.waypoints) ? root.waypoints : Array.isArray(root.poses) ? root.poses : null);
  if (!entries) throw new Error("waypoints または poses の配列が見つかりません。");
  if (!entries.length) throw new Error("waypoint が含まれていません。");

  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${index + 1} 番目の waypoint の形式が正しくありません。`);
    const pose = isRecord(entry.pose) ? entry.pose : entry;
    const position = isRecord(pose.position) ? pose.position : isRecord(entry.point) ? entry.point : pose;
    const orientation = isRecord(pose.orientation) ? pose.orientation : isRecord(entry.orientation) ? entry.orientation : null;
    const x = Number(position.x); const y = Number(position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${index + 1} 番目の waypoint に有効な x, y がありません。`);

    let yaw = Number(entry.yaw ?? entry.angle ?? pose.yaw);
    if (!Number.isFinite(yaw) && orientation) {
      const qx = Number(orientation.x ?? 0); const qy = Number(orientation.y ?? 0); const qz = Number(orientation.z ?? 0); const qw = Number(orientation.w ?? 1);
      if (![qx, qy, qz, qw].every(Number.isFinite)) throw new Error(`${index + 1} 番目の waypoint の orientation が正しくありません。`);
      yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
    }
    if (!Number.isFinite(yaw)) yaw = 0;
    return { name: typeof entry.name === "string" ? entry.name : `waypoint_${index}`, x, y, yaw };
  });
}

const degree = (rad: number) => Math.round(rad * 180 / Math.PI);
const fixed = (num: number) => Number(num.toFixed(4)).toString();
const waypointNameBase = (points: Waypoint[]) => points.some((point) => point.name === "waypoint_0") ? 0 : points.some((point) => point.name === "waypoint_1") ? 1 : 0;
const renumberWaypointNames = (points: Waypoint[], base: number) => points.map((point, index) => /^waypoint_\d+$/.test(point.name) ? { ...point, name: `waypoint_${index + base}` } : point);

export default function Home() {
  const [mapCanvas, setMapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mapInfo, setMapInfo] = useState<MapInfo>(defaultMap);
  const [mapName, setMapName] = useState<string>("");
  const [waypointsName, setWaypointsName] = useState<string>("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [satellite, setSatellite] = useState<SatelliteLayer | null>(null);
  const [aligningSatellite, setAligningSatellite] = useState(false);
  const [googleLocation, setGoogleLocation] = useState({ lat: "35.681236", lng: "139.767125", zoom: 18 });
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [message, setMessage] = useState("PGM と map YAML を読み込んで始めましょう");
  const [, setHistoryRevision] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null); const drawingRef = useRef(false); const waypointDragRef = useRef<{ id: number; snapshot: WaypointSnapshot; moved: boolean } | null>(null); const panningRef = useRef<{ x: number; y: number; viewport: Viewport } | null>(null); const satelliteDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const waypointsRef = useRef(waypoints); const selectedRef = useRef(selected); const waypointHistoryRef = useRef<{ past: WaypointSnapshot[]; future: WaypointSnapshot[] }>({ past: [], future: [] });
  waypointsRef.current = waypoints; selectedRef.current = selected;

  const snapshotWaypoints = (): WaypointSnapshot => ({ waypoints: waypointsRef.current.map((point) => ({ ...point })), selected: selectedRef.current });
  const restoreWaypoints = (snapshot: WaypointSnapshot) => {
    const points = snapshot.waypoints.map((point) => ({ ...point }));
    waypointsRef.current = points; selectedRef.current = snapshot.selected;
    setWaypoints(points); setSelected(snapshot.selected);
  };
  const pushWaypointHistory = (snapshot = snapshotWaypoints()) => {
    const history = waypointHistoryRef.current;
    history.past.push({ waypoints: snapshot.waypoints.map((point) => ({ ...point })), selected: snapshot.selected });
    if (history.past.length > historyLimit) history.past.shift();
    history.future = []; setHistoryRevision((revision) => revision + 1);
  };
  const replaceWaypoints = (points: Waypoint[], nextSelected = selectedRef.current) => {
    waypointsRef.current = points; selectedRef.current = nextSelected;
    setWaypoints(points); setSelected(nextSelected);
  };
  const commitWaypoints = (points: Waypoint[], nextSelected = selectedRef.current) => { pushWaypointHistory(); replaceWaypoints(points, nextSelected); };
  const undo = () => {
    const history = waypointHistoryRef.current; const previous = history.past.pop(); if (!previous) return;
    drawingRef.current = false; waypointDragRef.current = null;
    history.future.push(snapshotWaypoints()); restoreWaypoints(previous); setHistoryRevision((revision) => revision + 1); setMessage("操作を元に戻しました。");
  };
  const redo = () => {
    const history = waypointHistoryRef.current; const next = history.future.pop(); if (!next) return;
    drawingRef.current = false; waypointDragRef.current = null;
    history.past.push(snapshotWaypoints()); restoreWaypoints(next); setHistoryRevision((revision) => revision + 1); setMessage("操作をやり直しました。");
  };
  const canUndo = waypointHistoryRef.current.past.length > 0;
  const canRedo = waypointHistoryRef.current.future.length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const draw = () => {
    const view = canvasRef.current; if (!view) return;
    const ctx = view.getContext("2d")!; const w = view.width; const h = view.height;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(viewport.offsetX, viewport.offsetY); ctx.scale(viewport.zoom, viewport.zoom); if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0, w, h);
    if (satellite?.visible) {
      const fit = Math.min(w / satellite.image.naturalWidth, h / satellite.image.naturalHeight) * satellite.scale;
      const imageW = satellite.image.naturalWidth * fit; const imageH = satellite.image.naturalHeight * fit;
      ctx.save(); ctx.globalAlpha = satellite.opacity; ctx.translate(w / 2 + satellite.offsetX, h / 2 + satellite.offsetY); ctx.rotate(satellite.rotation * Math.PI / 180); ctx.drawImage(satellite.image, -imageW / 2, -imageH / 2, imageW, imageH); ctx.restore();
    }
    waypoints.forEach((point, index) => {
      const localX = Math.cos(-mapInfo.originYaw) * (point.x - mapInfo.originX) - Math.sin(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const localY = Math.sin(-mapInfo.originYaw) * (point.x - mapInfo.originX) + Math.cos(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const px = localX / mapInfo.resolution; const py = h - localY / mapInfo.resolution; const angle = -(point.yaw - mapInfo.originYaw);
      const active = point.id === selected;
      ctx.strokeStyle = active ? "#f97316" : "#2563eb"; ctx.fillStyle = active ? "#f97316" : "#2563eb"; ctx.lineWidth = Math.max(2, w / 400);
      ctx.beginPath(); ctx.arc(px, py, Math.max(6, w / 90), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(angle) * w / 18, py + Math.sin(angle) * w / 18); ctx.stroke();
      ctx.fillStyle = "white"; ctx.font = `bold ${Math.max(10, w / 55)}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(index + 1), px, py + 1);
    }); ctx.restore();
  };
  useEffect(draw, [mapCanvas, mapInfo, waypoints, selected, viewport, satellite]);
  useEffect(() => { setViewport({ zoom: 1, offsetX: 0, offsetY: 0 }); }, [mapCanvas]);

  const handlePgm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const decoded = await parsePgm(file); setMapCanvas(decoded); setMapName(file.name); setMessage(`${file.name} を読み込みました。ホイールで拡大・縮小できます。`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "PGM の読み込みに失敗しました。"); }
  };
  const handleYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { setMapInfo(parseMapYaml(await file.text())); setMessage(`${file.name} の座標設定を読み込みました。`); }
    catch { setMessage("YAML の読み込みに失敗しました。"); }
  };
  const handleWaypointsYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target; const file = input.files?.[0]; if (!file) return;
    try {
      const loaded = parseWaypointsYaml(await file.text());
      if (waypoints.length && !window.confirm(`現在の ${waypoints.length} 件を、${loaded.length} 件の読み込み内容で置き換えますか？`)) return;
      const idBase = Date.now();
      commitWaypoints(loaded.map((point, index) => ({ ...point, id: idBase + index })), null);
      setWaypointsName(file.name);
      setMessage(`${file.name} から ${loaded.length} 件の waypoint を読み込みました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "waypoints YAML の読み込みに失敗しました。"); }
    finally { input.value = ""; }
  };
  const handleSatellite = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file); const image = new Image(); image.src = url;
    try { await image.decode(); setSatellite({ image, name: file.name, opacity: 0.55, visible: true, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }); setAligningSatellite(true); setMessage(`${file.name} を重ねました。ドラッグして位置を合わせられます。`); }
    catch { setMessage("衛星画像の読み込みに失敗しました。"); }
    finally { URL.revokeObjectURL(url); event.target.value = ""; }
  };
  const fetchGoogleSatellite = async () => {
    const lat = Number(googleLocation.lat); const lng = Number(googleLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setMessage("緯度と経度を入力してください。"); return; }
    let width = 640; let height = 640;
    if (mapCanvas) { const ratio = mapCanvas.width / mapCanvas.height; if (ratio >= 1) height = Math.max(100, Math.round(width / ratio)); else width = Math.max(100, Math.round(height * ratio)); }
    setLoadingGoogle(true);
    try {
      const query = new URLSearchParams({ lat: String(lat), lng: String(lng), zoom: String(googleLocation.zoom), width: String(width), height: String(height) });
      const response = await fetch(`/api/satellite?${query}`);
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || "Google Mapsから画像を取得できませんでした。"); }
      const url = URL.createObjectURL(await response.blob()); const image = new Image(); image.src = url;
      try { await image.decode(); setSatellite({ image, name: `Google Satellite (${fixed(lat)}, ${fixed(lng)})`, opacity: 0.55, visible: true, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }); setAligningSatellite(true); setMessage("Google Mapsの衛星画像を取得しました。ドラッグして位置を合わせられます。"); }
      finally { URL.revokeObjectURL(url); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Google Mapsから画像を取得できませんでした。"); }
    finally { setLoadingGoogle(false); }
  };
  const updateSatellite = (patch: Partial<SatelliteLayer>) => setSatellite((current) => current ? { ...current, ...patch } : null);
  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget; const bounds = canvas.getBoundingClientRect(); const px = (event.clientX - bounds.left) * canvas.width / bounds.width; const py = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const imageX = (px - viewport.offsetX) / viewport.zoom; const imageY = (py - viewport.offsetY) / viewport.zoom;
    const lx = imageX * mapInfo.resolution; const ly = (canvas.height - imageY) * mapInfo.resolution;
    return { x: mapInfo.originX + Math.cos(mapInfo.originYaw) * lx - Math.sin(mapInfo.originYaw) * ly, y: mapInfo.originY + Math.sin(mapInfo.originYaw) * lx + Math.cos(mapInfo.originYaw) * ly, px, py };
  };
  const selectedWaypoint = waypoints.find((point) => point.id === selected) ?? null;
  const updateWaypoint = (id: number, patch: Partial<Waypoint>) => commitWaypoints(waypointsRef.current.map((point) => point.id === id ? { ...point, ...patch } : point));
  const deleteWaypoint = (id: number) => {
    const points = waypointsRef.current;
    commitWaypoints(renumberWaypointNames(points.filter((point) => point.id !== id), waypointNameBase(points)), selectedRef.current === id ? null : selectedRef.current);
  };
  const waypointAt = (px: number, py: number, canvas: HTMLCanvasElement) => {
    const hitRadius = Math.max(10, canvas.width / 70) * viewport.zoom;
    return [...waypoints].reverse().find((point) => {
      const localX = Math.cos(-mapInfo.originYaw) * (point.x - mapInfo.originX) - Math.sin(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const localY = Math.sin(-mapInfo.originYaw) * (point.x - mapInfo.originX) + Math.cos(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const pointX = localX / mapInfo.resolution * viewport.zoom + viewport.offsetX;
      const pointY = (canvas.height - localY / mapInfo.resolution) * viewport.zoom + viewport.offsetY;
      return Math.hypot(px - pointX, py - pointY) <= hitRadius;
    }) ?? null;
  };
  const startPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!mapCanvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === 1 || event.button === 2) { panningRef.current = { x: event.clientX, y: event.clientY, viewport }; return; }
    if (event.button !== 0) return;
    if (aligningSatellite && satellite) { satelliteDragRef.current = { x: event.clientX, y: event.clientY, offsetX: satellite.offsetX, offsetY: satellite.offsetY }; return; }
    const p = pointFromEvent(event);
    if (editorMode === "edit") {
      const point = waypointAt(p.px, p.py, event.currentTarget);
      if (point) { setSelected(point.id); selectedRef.current = point.id; waypointDragRef.current = { id: point.id, snapshot: snapshotWaypoints(), moved: false }; }
      else { setSelected(null); selectedRef.current = null; }
      return;
    }
    const id = Date.now(); const points = waypointsRef.current; drawingRef.current = true;
    commitWaypoints([...points, { id, name: `waypoint_${points.length + waypointNameBase(points)}`, x: p.x, y: p.y, yaw: mapInfo.originYaw }], id);
  };
  const turnPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panningRef.current) { const pan = panningRef.current; const canvas = event.currentTarget; const bounds = canvas.getBoundingClientRect(); setViewport({ ...pan.viewport, offsetX: pan.viewport.offsetX + (event.clientX - pan.x) * canvas.width / bounds.width, offsetY: pan.viewport.offsetY + (event.clientY - pan.y) * canvas.height / bounds.height }); return; }
    if (satelliteDragRef.current) { const drag = satelliteDragRef.current; const canvas = event.currentTarget; const bounds = canvas.getBoundingClientRect(); updateSatellite({ offsetX: drag.offsetX + (event.clientX - drag.x) * canvas.width / bounds.width / viewport.zoom, offsetY: drag.offsetY + (event.clientY - drag.y) * canvas.height / bounds.height / viewport.zoom }); return; }
    if (waypointDragRef.current !== null) { const p = pointFromEvent(event); const drag = waypointDragRef.current; if (!drag.moved) { pushWaypointHistory(drag.snapshot); drag.moved = true; } replaceWaypoints(waypointsRef.current.map((point) => point.id === drag.id ? { ...point, x: p.x, y: p.y } : point)); return; }
    if (!drawingRef.current || selectedRef.current === null) return; const p = pointFromEvent(event);
    replaceWaypoints(waypointsRef.current.map((item) => item.id === selectedRef.current ? { ...item, yaw: Math.atan2(p.y - item.y, p.x - item.x) } : item));
  };
  const finishPointer = () => { drawingRef.current = false; waypointDragRef.current = null; panningRef.current = null; satelliteDragRef.current = null; };
  const zoomAt = (factor: number, canvas?: HTMLCanvasElement, clientX?: number, clientY?: number) => {
    const target = canvas ?? canvasRef.current; if (!target) return; const bounds = target.getBoundingClientRect(); const px = clientX === undefined ? target.width / 2 : (clientX - bounds.left) * target.width / bounds.width; const py = clientY === undefined ? target.height / 2 : (clientY - bounds.top) * target.height / bounds.height;
    setViewport((current) => { const zoom = Math.min(6, Math.max(0.25, current.zoom * factor)); const scale = zoom / current.zoom; return { zoom, offsetX: px - (px - current.offsetX) * scale, offsetY: py - (py - current.offsetY) * scale }; });
  };
  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => { event.preventDefault(); zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.currentTarget, event.clientX, event.clientY); };
  const exportYaml = () => {
    const content = ["frame_id: map", "waypoints:", ...waypoints.flatMap((p) => {
      const z = Math.sin(p.yaw / 2); const w = Math.cos(p.yaw / 2);
      return [`- name: ${p.name || "waypoint"}`, "  position:", `    x: ${fixed(p.x)}`, `    y: ${fixed(p.y)}`, "    z: 0.0", "  orientation:", "    x: 0.0", "    y: 0.0", `    z: ${fixed(z)}`, `    w: ${fixed(w)}`];
    })].join("\n") + "\n";
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "application/x-yaml" })); link.download = "waypoints.yaml"; link.click(); URL.revokeObjectURL(link.href);
  };
  const aspect = mapCanvas ? `${mapCanvas.width} / ${mapCanvas.height}` : "16 / 10";
  const waypointEditor = <Card className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Waypoint editor</h2>{selectedWaypoint && <Badge className="bg-orange-100 text-orange-700">選択中</Badge>}</div>{selectedWaypoint ? <div className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-500">Name<input value={selectedWaypoint.name} onChange={(e) => updateWaypoint(selectedWaypoint.id, { name: e.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-slate-500">X (m)<input type="number" step="0.001" value={selectedWaypoint.x} onChange={(e) => updateWaypoint(selectedWaypoint.id, { x: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Y (m)<input type="number" step="0.001" value={selectedWaypoint.y} onChange={(e) => updateWaypoint(selectedWaypoint.id, { y: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label></div><label className="block text-xs font-medium text-slate-500">Angle (°)<input type="number" step="1" value={degree(selectedWaypoint.yaw)} onChange={(e) => updateWaypoint(selectedWaypoint.id, { yaw: Number(e.target.value) * Math.PI / 180 })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><Button variant="destructive" className="w-full" onClick={() => deleteWaypoint(selectedWaypoint.id)}><Trash2 size={15}/> この waypoint を削除</Button></div> : <p className="mt-3 text-xs leading-5 text-slate-500">編集モードで地図上または一覧から waypoint を選択してください。</p>}</Card>;
  return <main className="flex h-screen flex-col overflow-hidden bg-slate-50"><header className="shrink-0 border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white"><MapPin size={19} /></div><div><h1 className="text-base font-semibold">Waypoint Studio</h1><p className="text-xs text-slate-500">PGM Map Editor</p></div></div><Badge>{waypoints.length} waypoints</Badge></div></header>
    <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-[260px_minmax(0,1fr)_340px] gap-5 overflow-hidden px-5 py-5">
	      <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">{waypointEditor}<Card className="p-4"><h2 className="text-sm font-semibold">Map files</h2><p className="mt-1 text-xs leading-5 text-slate-500">PGM と対応する map YAML を読み込みます。</p><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><FileImage size={18} className="text-slate-500"/><span className="min-w-0 flex-1 truncate text-sm">{mapName || "PGM ファイルを選択"}</span><input className="hidden" type="file" accept=".pgm,image/x-portable-graymap" onChange={handlePgm}/><Upload size={16}/></label><label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><FileUp size={18} className="text-slate-500"/><span className="flex-1 text-sm">map YAML を選択</span><input className="hidden" type="file" accept=".yaml,.yml,text/yaml" onChange={handleYaml}/><Upload size={16}/></label></Card>
	        <Card className="p-4"><h2 className="text-sm font-semibold">Waypoint file</h2><p className="mt-1 text-xs leading-5 text-slate-500">作成済みの waypoints YAML を読み込み、続きから編集できます。</p><label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><FileUp size={18} className="text-slate-500"/><span className="min-w-0 flex-1 truncate text-sm">{waypointsName || "waypoints YAML を選択"}</span><input className="hidden" type="file" accept=".yaml,.yml,text/yaml,application/x-yaml" onChange={handleWaypointsYaml}/><Upload size={16}/></label></Card>
	        <Card className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Layers size={16} className="text-slate-500"/><h2 className="text-sm font-semibold">Satellite overlay</h2></div>{satellite && <Button variant="ghost" size="icon" className="h-8 w-8" title={satellite.visible ? "衛星画像を隠す" : "衛星画像を表示"} onClick={() => { updateSatellite({ visible: !satellite.visible }); if (satellite.visible) setAligningSatellite(false); }}>{satellite.visible ? <Eye size={16}/> : <EyeOff size={16}/>}</Button>}</div><p className="mt-1 text-xs leading-5 text-slate-500">衛星画像を重ね、PGM に位置合わせします。</p><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Satellite size={15}/>Google Mapsから取得</div><div className="mt-3 grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-slate-500">Latitude<input type="number" step="0.000001" value={googleLocation.lat} onChange={(e) => setGoogleLocation((value) => ({ ...value, lat: e.target.value }))} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Longitude<input type="number" step="0.000001" value={googleLocation.lng} onChange={(e) => setGoogleLocation((value) => ({ ...value, lng: e.target.value }))} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-500"/></label></div><label className="mt-2 block text-xs font-medium text-slate-500">Zoom <span className="float-right text-slate-700">{googleLocation.zoom}</span><input type="range" min="0" max="21" step="1" value={googleLocation.zoom} onChange={(e) => setGoogleLocation((value) => ({ ...value, zoom: Number(e.target.value) }))} className="mt-2 w-full accent-slate-800"/></label><Button className="mt-2 w-full" onClick={fetchGoogleSatellite} disabled={loadingGoogle}>{loadingGoogle ? <Loader2 size={15} className="animate-spin"/> : <Satellite size={15}/>}衛星画像を取得</Button></div><div className="my-3 flex items-center gap-2 text-[11px] text-slate-400"><span className="h-px flex-1 bg-slate-200"/>またはローカル画像<span className="h-px flex-1 bg-slate-200"/></div><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><ImagePlus size={18} className="text-slate-500"/><span className="min-w-0 flex-1 truncate text-sm">{satellite?.name || "画像を選択"}</span><input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSatellite}/><Upload size={16}/></label>{satellite && <div className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-500">Opacity <span className="float-right text-slate-700">{Math.round(satellite.opacity * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={satellite.opacity} onChange={(e) => updateSatellite({ opacity: Number(e.target.value) })} className="mt-2 w-full accent-slate-800"/></label><div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-slate-500">X offset (px)<input type="number" step="1" value={Math.round(satellite.offsetX)} onChange={(e) => updateSatellite({ offsetX: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Y offset (px)<input type="number" step="1" value={Math.round(satellite.offsetY)} onChange={(e) => updateSatellite({ offsetY: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Scale (%)<input type="number" min="1" step="1" value={Math.round(satellite.scale * 100)} onChange={(e) => updateSatellite({ scale: Math.max(0.01, Number(e.target.value) / 100) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Rotation (°)<input type="number" step="1" value={satellite.rotation} onChange={(e) => updateSatellite({ rotation: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-500"/></label></div><Button variant={aligningSatellite ? "default" : "outline"} className="w-full" onClick={() => setAligningSatellite((active) => !active)}><Move size={15}/>{aligningSatellite ? "位置合わせを終了" : "ドラッグで位置合わせ"}</Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => updateSatellite({ offsetX: 0, offsetY: 0, scale: 1, rotation: 0 })}><RotateCcw size={15}/>リセット</Button><Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setSatellite(null); setAligningSatellite(false); }}><Trash2 size={15}/>削除</Button></div></div>}</Card>
	        <Card className="p-4"><h2 className="text-sm font-semibold">Map parameters</h2><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Resolution</span><span>{mapInfo.resolution} m/px</span></div><div className="flex justify-between"><span className="text-slate-500">Origin</span><span>{mapInfo.originX}, {mapInfo.originY}</span></div><div className="flex justify-between"><span className="text-slate-500">Yaw</span><span>{degree(mapInfo.originYaw)}°</span></div></div></Card></aside>
	      <section className="min-w-0 min-h-0"><Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold">Map preview</h2><p className="text-xs text-slate-500">{message}</p></div><div className="flex flex-wrap gap-2"><div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5"><Button variant={editorMode === "add" ? "default" : "ghost"} className="h-8 px-3" onClick={() => { setEditorMode("add"); setAligningSatellite(false); }}><Plus size={15}/>新規追加</Button><Button variant={editorMode === "edit" ? "default" : "ghost"} className="h-8 px-3" onClick={() => { setEditorMode("edit"); setAligningSatellite(false); }}><Pencil size={14}/>編集</Button></div><Button variant="outline" size="icon" title="元に戻す (Ctrl+Z)" aria-label="元に戻す" onClick={undo} disabled={!canUndo}><Undo2 size={16}/></Button><Button variant="outline" size="icon" title="やり直す (Ctrl+Shift+Z / Ctrl+Y)" aria-label="やり直す" onClick={redo} disabled={!canRedo}><Redo2 size={16}/></Button><Button variant="outline" size="icon" title="縮小" onClick={() => zoomAt(1 / 1.25)} disabled={!mapCanvas}><ZoomOut size={16}/></Button><Button variant="outline" size="icon" title="拡大" onClick={() => zoomAt(1.25)} disabled={!mapCanvas}><ZoomIn size={16}/></Button><Button variant="outline" size="icon" title="表示をリセット" onClick={() => setViewport({ zoom: 1, offsetX: 0, offsetY: 0 })} disabled={!mapCanvas}><Hand size={16}/></Button><Button variant="outline" size="icon" title="すべて削除" onClick={() => commitWaypoints([], null)} disabled={!waypoints.length}><RotateCcw size={16}/></Button><Button onClick={exportYaml} disabled={!waypoints.length}><Download size={16}/> YAML をダウンロード</Button></div></div><div className="bg-slate-100 p-4"><div className="relative mx-auto max-h-[65vh] max-w-full overflow-hidden rounded-lg bg-slate-200" style={{ aspectRatio: aspect, width: mapCanvas ? "min(100%, 960px)" : "100%" }}><canvas ref={canvasRef} width={mapCanvas?.width ?? 960} height={mapCanvas?.height ?? 600} onPointerDown={startPoint} onPointerMove={turnPoint} onPointerUp={finishPointer} onPointerCancel={finishPointer} onContextMenu={(event) => event.preventDefault()} onWheel={handleWheel} className={`absolute inset-0 h-full w-full ${panningRef.current || satelliteDragRef.current || waypointDragRef.current !== null ? "cursor-grabbing" : aligningSatellite || editorMode === "edit" ? "cursor-move" : "cursor-crosshair"}`} />{!mapCanvas && <div className="absolute inset-0 grid place-items-center text-center"><div><FileImage className="mx-auto mb-3 text-slate-400" size={30}/><p className="text-sm font-medium text-slate-600">PGM map をアップロード</p><p className="mt-1 text-xs text-slate-500">P2 / P5 形式に対応しています</p></div></div>}</div><p className="mt-3 text-center text-xs text-slate-500">{aligningSatellite ? "衛星画像をドラッグして位置合わせ　/　右ドラッグ: 地図を移動" : editorMode === "edit" ? "waypointをドラッグ: 位置を移動　/　Ctrl+Z: 元に戻す　/　右ドラッグ: 地図を移動" : "ドラッグ: waypointを追加して向きを設定　/　Ctrl+Z: 元に戻す　/　右ドラッグ: 地図を移動"}</p></div></Card></section>
      <aside className="min-h-0"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold">Waypoints</h2><span className="text-xs text-slate-500">map frame</span></div>{waypoints.length ? <div className="max-h-[calc(100vh-180px)] overflow-y-auto overflow-x-hidden"><table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="w-[38%] px-4 py-2 font-medium">Name</th><th className="w-[18%] px-2 py-2 font-medium">X</th><th className="w-[18%] px-2 py-2 font-medium">Y</th><th className="w-[16%] px-2 py-2 font-medium">Angle</th><th className="w-9"/></tr></thead><tbody>{waypoints.map((p) => <tr key={p.id} onClick={() => { setSelected(p.id); setEditorMode("edit"); setAligningSatellite(false); }} className={`cursor-pointer border-t border-slate-100 ${selected === p.id ? "bg-orange-50" : "hover:bg-slate-50"}`}><td title={p.name} className="truncate px-4 py-3 font-medium">{p.name || "waypoint"}</td><td className="truncate px-2 py-3 font-mono text-xs">{fixed(p.x)}</td><td className="truncate px-2 py-3 font-mono text-xs">{fixed(p.y)}</td><td className="truncate px-2 py-3">{degree(p.yaw)}°</td><td><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteWaypoint(p.id); }}><Trash2 size={16}/></Button></td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-slate-400">まだ waypoint がありません</p>}</Card></aside>
    </div></main>;
}

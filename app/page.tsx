"use client";

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Download, FileImage, FileUp, MapPin, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type MapInfo = { resolution: number; originX: number; originY: number; originYaw: number };
type Waypoint = { id: number; name: string; x: number; y: number; yaw: number };
const defaultMap: MapInfo = { resolution: 0.05, originX: 0, originY: 0, originYaw: 0 };

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

const degree = (rad: number) => Math.round(rad * 180 / Math.PI);
const fixed = (num: number) => Number(num.toFixed(4)).toString();

export default function Home() {
  const [mapCanvas, setMapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mapInfo, setMapInfo] = useState<MapInfo>(defaultMap);
  const [mapName, setMapName] = useState<string>("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("PGM と map YAML を読み込んで始めましょう");
  const canvasRef = useRef<HTMLCanvasElement>(null); const drawingRef = useRef(false);

  const draw = () => {
    const view = canvasRef.current; if (!view) return;
    const ctx = view.getContext("2d")!; const w = view.width; const h = view.height;
    ctx.clearRect(0, 0, w, h); if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0, w, h);
    waypoints.forEach((point, index) => {
      const localX = Math.cos(-mapInfo.originYaw) * (point.x - mapInfo.originX) - Math.sin(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const localY = Math.sin(-mapInfo.originYaw) * (point.x - mapInfo.originX) + Math.cos(-mapInfo.originYaw) * (point.y - mapInfo.originY);
      const px = localX / mapInfo.resolution; const py = h - localY / mapInfo.resolution; const angle = -(point.yaw - mapInfo.originYaw);
      const active = point.id === selected;
      ctx.strokeStyle = active ? "#f97316" : "#2563eb"; ctx.fillStyle = active ? "#f97316" : "#2563eb"; ctx.lineWidth = Math.max(2, w / 400);
      ctx.beginPath(); ctx.arc(px, py, Math.max(6, w / 90), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(angle) * w / 18, py + Math.sin(angle) * w / 18); ctx.stroke();
      ctx.fillStyle = "white"; ctx.font = `bold ${Math.max(10, w / 55)}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(index + 1), px, py + 1);
    });
  };
  useEffect(draw, [mapCanvas, mapInfo, waypoints, selected]);

  const handlePgm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const decoded = await parsePgm(file); setMapCanvas(decoded); setMapName(file.name); setMessage(`${file.name} を読み込みました。地図上をドラッグして配置できます。`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "PGM の読み込みに失敗しました。"); }
  };
  const handleYaml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { setMapInfo(parseMapYaml(await file.text())); setMessage(`${file.name} の座標設定を読み込みました。`); }
    catch { setMessage("YAML の読み込みに失敗しました。"); }
  };
  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget; const bounds = canvas.getBoundingClientRect(); const px = (event.clientX - bounds.left) * canvas.width / bounds.width; const py = (event.clientY - bounds.top) * canvas.height / bounds.height;
    const lx = px * mapInfo.resolution; const ly = (canvas.height - py) * mapInfo.resolution;
    return { x: mapInfo.originX + Math.cos(mapInfo.originYaw) * lx - Math.sin(mapInfo.originYaw) * ly, y: mapInfo.originY + Math.sin(mapInfo.originYaw) * lx + Math.cos(mapInfo.originYaw) * ly, px, py };
  };
  const selectedWaypoint = waypoints.find((point) => point.id === selected) ?? null;
  const updateWaypoint = (id: number, patch: Partial<Waypoint>) => setWaypoints((points) => points.map((point) => point.id === id ? { ...point, ...patch } : point));
  const startPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!mapCanvas) return; event.currentTarget.setPointerCapture(event.pointerId); const p = pointFromEvent(event); const id = Date.now(); drawingRef.current = true; setSelected(id); setWaypoints((points) => [...points, { id, name: `waypoint_${points.length}`, x: p.x, y: p.y, yaw: mapInfo.originYaw }]);
  };
  const turnPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || selected === null) return; const p = pointFromEvent(event);
    setWaypoints((points) => points.map((item) => item.id === selected ? { ...item, yaw: Math.atan2(p.y - item.y, p.x - item.x) } : item));
  };
  const exportYaml = () => {
    const content = ["frame_id: map", "waypoints:", ...waypoints.flatMap((p) => {
      const z = Math.sin(p.yaw / 2); const w = Math.cos(p.yaw / 2);
      return [`- name: ${p.name || "waypoint"}`, "  position:", `    x: ${fixed(p.x)}`, `    y: ${fixed(p.y)}`, "    z: 0.0", "  orientation:", "    x: 0.0", "    y: 0.0", `    z: ${fixed(z)}`, `    w: ${fixed(w)}`];
    })].join("\n") + "\n";
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "application/x-yaml" })); link.download = "waypoints.yaml"; link.click(); URL.revokeObjectURL(link.href);
  };
  const aspect = mapCanvas ? `${mapCanvas.width} / ${mapCanvas.height}` : "16 / 10";
  return <main className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white"><MapPin size={19} /></div><div><h1 className="text-base font-semibold">Waypoint Studio</h1><p className="text-xs text-slate-500">PGM Map Editor</p></div></div><Badge>{waypoints.length} waypoints</Badge></div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="space-y-4"><Card className="p-4"><h2 className="text-sm font-semibold">Map files</h2><p className="mt-1 text-xs leading-5 text-slate-500">PGM と対応する map YAML を読み込みます。</p><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><FileImage size={18} className="text-slate-500"/><span className="min-w-0 flex-1 truncate text-sm">{mapName || "PGM ファイルを選択"}</span><input className="hidden" type="file" accept=".pgm,image/x-portable-graymap" onChange={handlePgm}/><Upload size={16}/></label><label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500"><FileUp size={18} className="text-slate-500"/><span className="flex-1 text-sm">map YAML を選択</span><input className="hidden" type="file" accept=".yaml,.yml,text/yaml" onChange={handleYaml}/><Upload size={16}/></label></Card>
        <Card className="p-4"><h2 className="text-sm font-semibold">Map parameters</h2><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Resolution</span><span>{mapInfo.resolution} m/px</span></div><div className="flex justify-between"><span className="text-slate-500">Origin</span><span>{mapInfo.originX}, {mapInfo.originY}</span></div><div className="flex justify-between"><span className="text-slate-500">Yaw</span><span>{degree(mapInfo.originYaw)}°</span></div></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Waypoint editor</h2>{selectedWaypoint && <Badge className="bg-orange-100 text-orange-700">選択中</Badge>}</div>{selectedWaypoint ? <div className="mt-4 space-y-3"><label className="block text-xs font-medium text-slate-500">Name<input value={selectedWaypoint.name} onChange={(e) => updateWaypoint(selectedWaypoint.id, { name: e.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium text-slate-500">X (m)<input type="number" step="0.001" value={selectedWaypoint.x} onChange={(e) => updateWaypoint(selectedWaypoint.id, { x: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><label className="block text-xs font-medium text-slate-500">Y (m)<input type="number" step="0.001" value={selectedWaypoint.y} onChange={(e) => updateWaypoint(selectedWaypoint.id, { y: Number(e.target.value) })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label></div><label className="block text-xs font-medium text-slate-500">Angle (°)<input type="number" step="1" value={degree(selectedWaypoint.yaw)} onChange={(e) => updateWaypoint(selectedWaypoint.id, { yaw: Number(e.target.value) * Math.PI / 180 })} className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500"/></label><Button variant="destructive" className="w-full" onClick={() => { setWaypoints((points) => points.filter((point) => point.id !== selectedWaypoint.id)); setSelected(null); }}><Trash2 size={15}/> この waypoint を削除</Button></div> : <p className="mt-3 text-xs leading-5 text-slate-500">一覧の行を選択するか、地図上に waypoint を配置してください。</p>}</Card></aside>
      <section className="min-w-0 space-y-4"><Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold">Map preview</h2><p className="text-xs text-slate-500">{message}</p></div><div className="flex gap-2"><Button variant="outline" size="icon" title="すべて削除" onClick={() => { setWaypoints([]); setSelected(null); }} disabled={!waypoints.length}><RotateCcw size={16}/></Button><Button onClick={exportYaml} disabled={!waypoints.length}><Download size={16}/> YAML をダウンロード</Button></div></div><div className="bg-slate-100 p-4"><div className="relative mx-auto max-h-[65vh] max-w-full overflow-hidden rounded-lg bg-slate-200" style={{ aspectRatio: aspect, width: mapCanvas ? "min(100%, 960px)" : "100%" }}><canvas ref={canvasRef} width={mapCanvas?.width ?? 960} height={mapCanvas?.height ?? 600} onPointerDown={startPoint} onPointerMove={turnPoint} onPointerUp={() => { drawingRef.current = false; }} className="absolute inset-0 h-full w-full cursor-crosshair" />{!mapCanvas && <div className="absolute inset-0 grid place-items-center text-center"><div><FileImage className="mx-auto mb-3 text-slate-400" size={30}/><p className="text-sm font-medium text-slate-600">PGM map をアップロード</p><p className="mt-1 text-xs text-slate-500">P2 / P5 形式に対応しています</p></div></div>}</div></div></Card>
        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold">Waypoints</h2><span className="text-xs text-slate-500">map frame</span></div>{waypoints.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">X</th><th className="px-4 py-2 font-medium">Y</th><th className="px-4 py-2 font-medium">Angle</th><th className="w-12"/></tr></thead><tbody>{waypoints.map((p) => <tr key={p.id} onClick={() => setSelected(p.id)} className={`cursor-pointer border-t border-slate-100 ${selected === p.id ? "bg-orange-50" : "hover:bg-slate-50"}`}><td className="px-4 py-3 font-medium">{p.name || "waypoint"}</td><td className="px-4 py-3 font-mono text-xs">{fixed(p.x)}</td><td className="px-4 py-3 font-mono text-xs">{fixed(p.y)}</td><td className="px-4 py-3">{degree(p.yaw)}°</td><td><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setWaypoints((items) => items.filter((item) => item.id !== p.id)); if (selected === p.id) setSelected(null); }}><Trash2 size={16}/></Button></td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-slate-400">まだ waypoint がありません</p>}</Card>
      </section>
    </div></main>;
}

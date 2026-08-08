import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const numberParam = (request: NextRequest, name: string) => {
  const value = request.nextUrl.searchParams.get(name);
  return value === null || value.trim() === "" ? Number.NaN : Number(value);
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY が設定されていません。" }, { status: 500 });

  const lat = numberParam(request, "lat");
  const lng = numberParam(request, "lng");
  const zoom = Math.round(numberParam(request, "zoom"));
  const width = Math.min(640, Math.max(100, Math.round(numberParam(request, "width") || 640)));
  const height = Math.min(640, Math.max(100, Math.round(numberParam(request, "height") || 640)));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(zoom) || zoom < 0 || zoom > 21) {
    return NextResponse.json({ error: "緯度・経度またはズームの値が正しくありません。" }, { status: 400 });
  }

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: "2",
    maptype: "satellite",
    format: "png",
    key: apiKey,
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params}`, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: `Google Mapsから画像を取得できませんでした（HTTP ${response.status}）。APIの有効化とキー制限を確認してください。` }, { status: response.status });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: { "Content-Type": response.headers.get("content-type") || "image/png", "Cache-Control": "no-store" },
  });
}

import type { ChangeEventHandler, ReactNode } from "react";
import {
  Eye,
  EyeOff,
  FileImage,
  FileUp,
  ImagePlus,
  Layers,
  Loader2,
  Move,
  RotateCcw,
  Satellite,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SatelliteLayer } from "@/lib/waypoint-map";

export type GoogleLocation = {
  lat: string;
  lng: string;
  zoom: number;
};

type SourceSidebarProps = {
  mapName: string;
  waypointsName: string;
  satellite: SatelliteLayer | null;
  googleLocation: GoogleLocation;
  isFetchingSatellite: boolean;
  isAligningSatellite: boolean;
  onPgmChange: ChangeEventHandler<HTMLInputElement>;
  onMapYamlChange: ChangeEventHandler<HTMLInputElement>;
  onWaypointsYamlChange: ChangeEventHandler<HTMLInputElement>;
  onSatelliteImageChange: ChangeEventHandler<HTMLInputElement>;
  onFetchSatellite: () => void;
  onGoogleLocationChange: (patch: Partial<GoogleLocation>) => void;
  onSatelliteChange: (patch: Partial<SatelliteLayer>) => void;
  onAlignmentChange: (active: boolean) => void;
  onSatelliteRemove: () => void;
};

const NUMBER_INPUT_CLASS =
  "mt-1.5 h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-slate-500";

export function SourceSidebar({
  mapName,
  waypointsName,
  satellite,
  googleLocation,
  isFetchingSatellite,
  isAligningSatellite,
  onPgmChange,
  onMapYamlChange,
  onWaypointsYamlChange,
  onSatelliteImageChange,
  onFetchSatellite,
  onGoogleLocationChange,
  onSatelliteChange,
  onAlignmentChange,
  onSatelliteRemove,
}: SourceSidebarProps) {
  return (
    <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Map files</h2>
        <FilePicker
          className="mt-4"
          icon={<FileImage size={18} className="text-slate-500" />}
          label={mapName || "Select PGM file"}
          accept=".pgm,image/x-portable-graymap"
          onChange={onPgmChange}
        />
        <FilePicker
          className="mt-2"
          icon={<FileUp size={18} className="text-slate-500" />}
          label="Select map YAML"
          accept=".yaml,.yml,text/yaml"
          onChange={onMapYamlChange}
        />
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Waypoint file</h2>
        <FilePicker
          className="mt-3"
          icon={<FileUp size={18} className="text-slate-500" />}
          label={waypointsName || "Select waypoints YAML"}
          accept=".yaml,.yml,text/yaml,application/x-yaml"
          onChange={onWaypointsYamlChange}
        />
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold">Satellite overlay</h2>
          </div>
          {satellite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={
                satellite.visible
                  ? "Hide satellite image"
                  : "Show satellite image"
              }
              onClick={() => {
                onSatelliteChange({ visible: !satellite.visible });
                if (satellite.visible) onAlignmentChange(false);
              }}
            >
              {satellite.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </Button>
          )}
        </div>

        <GoogleSatelliteForm
          location={googleLocation}
          isFetching={isFetchingSatellite}
          onLocationChange={onGoogleLocationChange}
          onFetch={onFetchSatellite}
        />

        <div className="my-3 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or use a local image
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <FilePicker
          icon={<ImagePlus size={18} className="text-slate-500" />}
          label={satellite?.name || "Select image"}
          accept="image/png,image/jpeg,image/webp"
          onChange={onSatelliteImageChange}
        />

        {satellite && (
          <SatelliteSettings
            satellite={satellite}
            isAligning={isAligningSatellite}
            onChange={onSatelliteChange}
            onAlignmentChange={onAlignmentChange}
            onRemove={onSatelliteRemove}
          />
        )}
      </Card>
    </aside>
  );
}

type FilePickerProps = {
  className?: string;
  icon: ReactNode;
  label: string;
  accept: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

function FilePicker({
  className = "",
  icon,
  label,
  accept,
  onChange,
}: FilePickerProps) {
  return (
    <label
      className={`${className} flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3 hover:border-slate-500`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <input
        className="hidden"
        type="file"
        accept={accept}
        onChange={onChange}
      />
      <Upload size={16} />
    </label>
  );
}

type GoogleSatelliteFormProps = {
  location: GoogleLocation;
  isFetching: boolean;
  onLocationChange: (patch: Partial<GoogleLocation>) => void;
  onFetch: () => void;
};

function GoogleSatelliteForm({
  location,
  isFetching,
  onLocationChange,
  onFetch,
}: GoogleSatelliteFormProps) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <Satellite size={15} />
        Fetch from Google Maps
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberInput
          label="Latitude"
          step="0.000001"
          value={location.lat}
          onChange={(lat) => onLocationChange({ lat })}
        />
        <NumberInput
          label="Longitude"
          step="0.000001"
          value={location.lng}
          onChange={(lng) => onLocationChange({ lng })}
        />
      </div>
      <label className="mt-2 block text-xs font-medium text-slate-500">
        Zoom <span className="float-right text-slate-700">{location.zoom}</span>
        <input
          type="range"
          min="0"
          max="21"
          step="1"
          value={location.zoom}
          onChange={(event) =>
            onLocationChange({ zoom: Number(event.target.value) })
          }
          className="mt-2 w-full accent-slate-800"
        />
      </label>
      <Button className="mt-2 w-full" onClick={onFetch} disabled={isFetching}>
        {isFetching ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Satellite size={15} />
        )}
        Fetch
      </Button>
    </div>
  );
}

type SatelliteSettingsProps = {
  satellite: SatelliteLayer;
  isAligning: boolean;
  onChange: (patch: Partial<SatelliteLayer>) => void;
  onAlignmentChange: (active: boolean) => void;
  onRemove: () => void;
};

function SatelliteSettings({
  satellite,
  isAligning,
  onChange,
  onAlignmentChange,
  onRemove,
}: SatelliteSettingsProps) {
  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-medium text-slate-500">
        Opacity
        <span className="float-right text-slate-700">
          {Math.round(satellite.opacity * 100)}%
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={satellite.opacity}
          onChange={(event) =>
            onChange({ opacity: Number(event.target.value) })
          }
          className="mt-2 w-full accent-slate-800"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="X offset (px)"
          value={Math.round(satellite.offsetX)}
          onChange={(value) => onChange({ offsetX: Number(value) })}
        />
        <NumberInput
          label="Y offset (px)"
          value={Math.round(satellite.offsetY)}
          onChange={(value) => onChange({ offsetY: Number(value) })}
        />
        <NumberInput
          label="Scale (%)"
          min="1"
          value={Math.round(satellite.scale * 100)}
          onChange={(value) =>
            onChange({ scale: Math.max(0.01, Number(value) / 100) })
          }
        />
        <NumberInput
          label="Rotation (°)"
          value={satellite.rotation}
          onChange={(value) => onChange({ rotation: Number(value) })}
        />
      </div>

      <Button
        variant={isAligning ? "default" : "outline"}
        className="w-full"
        onClick={() => onAlignmentChange(!isAligning)}
      >
        <Move size={15} />
        {isAligning ? "Finish alignment" : "Align by dragging"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() =>
            onChange({ offsetX: 0, offsetY: 0, scale: 1, rotation: 0 })
          }
        >
          <RotateCcw size={15} /> Reset
        </Button>
        <Button
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={onRemove}
        >
          <Trash2 size={15} /> Delete
        </Button>
      </div>
    </div>
  );
}

type NumberInputProps = {
  label: string;
  value: string | number;
  min?: string;
  step?: string;
  onChange: (value: string) => void;
};

function NumberInput({
  label,
  value,
  min,
  step = "1",
  onChange,
}: NumberInputProps) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={NUMBER_INPUT_CLASS}
      />
    </label>
  );
}

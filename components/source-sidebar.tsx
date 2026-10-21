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
  "mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-white outline-none focus:border-blue-500";
const DARK_OUTLINE_CLASS =
  "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700";

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
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-3">
      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Map files
        </h2>
        <FilePicker
          className="mt-4"
          icon={<FileImage size={18} className="text-slate-400" />}
          label={mapName || "Select PGM file"}
          accept=".pgm,image/x-portable-graymap"
          onChange={onPgmChange}
        />
        <FilePicker
          className="mt-2"
          icon={<FileUp size={18} className="text-slate-400" />}
          label="Select map YAML"
          accept=".yaml,.yml,text/yaml"
          onChange={onMapYamlChange}
        />
      </section>

      <section>
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Waypoint file
        </h2>
        <FilePicker
          className="mt-3"
          icon={<FileUp size={18} className="text-slate-400" />}
          label={waypointsName || "Select waypoints YAML"}
          accept=".yaml,.yml,text/yaml,application/x-yaml"
          onChange={onWaypointsYamlChange}
        />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-slate-500" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Satellite overlay
            </h2>
          </div>
          {satellite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
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

        <div className="my-3 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="h-px flex-1 bg-slate-700" />
          or use a local image
          <span className="h-px flex-1 bg-slate-700" />
        </div>
        <FilePicker
          icon={<ImagePlus size={18} className="text-slate-400" />}
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
      </section>
    </div>
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
      className={`${className} flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-700 p-3 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <input
        className="hidden"
        type="file"
        accept={accept}
        onChange={onChange}
      />
      <Upload size={16} className="text-slate-400" />
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
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
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
      <label className="mt-2 block text-xs font-medium text-slate-400">
        Zoom <span className="float-right text-slate-200">{location.zoom}</span>
        <input
          type="range"
          min="0"
          max="21"
          step="1"
          value={location.zoom}
          onChange={(event) =>
            onLocationChange({ zoom: Number(event.target.value) })
          }
          className="mt-2 w-full accent-blue-500"
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
      <label className="block text-xs font-medium text-slate-400">
        Opacity
        <span className="float-right text-slate-200">
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
          className="mt-2 w-full accent-blue-500"
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
        className={`w-full ${isAligning ? "" : DARK_OUTLINE_CLASS}`}
        onClick={() => onAlignmentChange(!isAligning)}
      >
        <Move size={15} />
        {isAligning ? "Finish alignment" : "Align by dragging"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className={DARK_OUTLINE_CLASS}
          onClick={() =>
            onChange({ offsetX: 0, offsetY: 0, scale: 1, rotation: 0 })
          }
        >
          <RotateCcw size={15} /> Reset
        </Button>
        <Button
          variant="outline"
          className={`${DARK_OUTLINE_CLASS} text-rose-400 hover:text-rose-300`}
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
    <label className="block text-xs font-medium text-slate-400">
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

import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCoordinate, radiansToDegrees } from "@/lib/waypoint-map";
import type { Waypoint } from "@/lib/waypoint-map";

type WaypointSidebarProps = {
  waypoints: Waypoint[];
  selectedWaypoint: Waypoint | null;
  onDelete: (id: number) => void;
  onSelect: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Waypoint>) => void;
};

const INPUT_CLASS =
  "mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-slate-500";

export function WaypointSidebar({
  waypoints,
  selectedWaypoint,
  onDelete,
  onSelect,
  onUpdate,
}: WaypointSidebarProps) {
  return (
    <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
      <WaypointEditor
        waypoint={selectedWaypoint}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
      <WaypointTable
        waypoints={waypoints}
        selectedWaypointId={selectedWaypoint?.id ?? null}
        onDelete={onDelete}
        onSelect={onSelect}
      />
    </aside>
  );
}

type WaypointEditorProps = {
  waypoint: Waypoint | null;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: Partial<Waypoint>) => void;
};

function WaypointEditor({ waypoint, onDelete, onUpdate }: WaypointEditorProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Waypoint editor</h2>
        {waypoint && (
          <Badge className="bg-orange-100 text-orange-700">Selected</Badge>
        )}
      </div>

      {!waypoint ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Select a waypoint on the map or from the list while in edit mode.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Name
            <input
              value={waypoint.name}
              onChange={(event) =>
                onUpdate(waypoint.id, { name: event.target.value })
              }
              className={INPUT_CLASS}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <CoordinateInput
              label="X (m)"
              value={waypoint.x}
              onChange={(x) => onUpdate(waypoint.id, { x })}
            />
            <CoordinateInput
              label="Y (m)"
              value={waypoint.y}
              onChange={(y) => onUpdate(waypoint.id, { y })}
            />
          </div>

          <CoordinateInput
            label="Angle (°)"
            step="1"
            value={radiansToDegrees(waypoint.yaw)}
            onChange={(degrees) =>
              onUpdate(waypoint.id, { yaw: (degrees * Math.PI) / 180 })
            }
          />

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onDelete(waypoint.id)}
          >
            <Trash2 size={15} /> Delete this waypoint
          </Button>
        </div>
      )}
    </Card>
  );
}

type CoordinateInputProps = {
  label: string;
  value: number;
  step?: string;
  onChange: (value: number) => void;
};

function CoordinateInput({
  label,
  value,
  step = "0.001",
  onChange,
}: CoordinateInputProps) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={INPUT_CLASS}
      />
    </label>
  );
}

type WaypointTableProps = {
  waypoints: Waypoint[];
  selectedWaypointId: number | null;
  onDelete: (id: number) => void;
  onSelect: (id: number) => void;
};

function WaypointTable({
  waypoints,
  selectedWaypointId,
  onDelete,
  onSelect,
}: WaypointTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Waypoints</h2>
        <span className="text-xs text-slate-500">map frame</span>
      </div>

      {!waypoints.length ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          No waypoints yet
        </p>
      ) : (
        <div className="overflow-x-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="w-[38%] px-4 py-2 font-medium">Name</th>
                <th className="w-[18%] px-2 py-2 font-medium">X</th>
                <th className="w-[18%] px-2 py-2 font-medium">Y</th>
                <th className="w-[16%] px-2 py-2 font-medium">Angle</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {waypoints.map((waypoint) => (
                <tr
                  key={waypoint.id}
                  onClick={() => onSelect(waypoint.id)}
                  className={`cursor-pointer border-t border-slate-100 ${
                    selectedWaypointId === waypoint.id
                      ? "bg-orange-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td
                    title={waypoint.name}
                    className="truncate px-4 py-3 font-medium"
                  >
                    {waypoint.name || "waypoint"}
                  </td>
                  <td className="truncate px-2 py-3 font-mono text-xs">
                    {formatCoordinate(waypoint.x)}
                  </td>
                  <td className="truncate px-2 py-3 font-mono text-xs">
                    {formatCoordinate(waypoint.y)}
                  </td>
                  <td className="truncate px-2 py-3">
                    {radiansToDegrees(waypoint.yaw)}°
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(waypoint.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

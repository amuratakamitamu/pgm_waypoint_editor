import { useRef, useState } from "react";

import type { Waypoint } from "@/lib/waypoint-map";

export type WaypointSnapshot = {
  waypoints: Waypoint[];
  selectedWaypointId: number | null;
};

const HISTORY_LIMIT = 100;

function cloneWaypoints(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.map((waypoint) => ({ ...waypoint }));
}

function cloneSnapshot(snapshot: WaypointSnapshot): WaypointSnapshot {
  return {
    waypoints: cloneWaypoints(snapshot.waypoints),
    selectedWaypointId: snapshot.selectedWaypointId,
  };
}

export function useWaypointHistory() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<number | null>(
    null,
  );
  const [, renderHistoryChange] = useState(0);

  const waypointsRef = useRef(waypoints);
  const selectedWaypointIdRef = useRef(selectedWaypointId);
  const historyRef = useRef<{
    past: WaypointSnapshot[];
    future: WaypointSnapshot[];
  }>({ past: [], future: [] });

  waypointsRef.current = waypoints;
  selectedWaypointIdRef.current = selectedWaypointId;

  const takeSnapshot = (): WaypointSnapshot => ({
    waypoints: cloneWaypoints(waypointsRef.current),
    selectedWaypointId: selectedWaypointIdRef.current,
  });

  const replaceWaypoints = (
    nextWaypoints: Waypoint[],
    nextSelectedId = selectedWaypointIdRef.current,
  ) => {
    waypointsRef.current = nextWaypoints;
    selectedWaypointIdRef.current = nextSelectedId;
    setWaypoints(nextWaypoints);
    setSelectedWaypointId(nextSelectedId);
  };

  const pushHistory = (snapshot = takeSnapshot()) => {
    const history = historyRef.current;
    history.past.push(cloneSnapshot(snapshot));
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future = [];
    renderHistoryChange((revision) => revision + 1);
  };

  const commitWaypoints = (
    nextWaypoints: Waypoint[],
    nextSelectedId = selectedWaypointIdRef.current,
  ) => {
    pushHistory();
    replaceWaypoints(nextWaypoints, nextSelectedId);
  };

  const restoreSnapshot = (snapshot: WaypointSnapshot) => {
    replaceWaypoints(
      cloneWaypoints(snapshot.waypoints),
      snapshot.selectedWaypointId,
    );
  };

  const undo = (): boolean => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return false;

    history.future.push(takeSnapshot());
    restoreSnapshot(previous);
    renderHistoryChange((revision) => revision + 1);
    return true;
  };

  const redo = (): boolean => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return false;

    history.past.push(takeSnapshot());
    restoreSnapshot(next);
    renderHistoryChange((revision) => revision + 1);
    return true;
  };

  return {
    waypoints,
    waypointsRef,
    selectedWaypointId,
    selectedWaypointIdRef,
    setSelectedWaypointId,
    takeSnapshot,
    pushHistory,
    replaceWaypoints,
    commitWaypoints,
    undo,
    redo,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
  };
}

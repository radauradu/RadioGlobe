"use client";

import type * as Cesium from "cesium";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadCesium, type CesiumModule } from "@/lib/loadCesium";
import type { RadioStation, StationPoint } from "@/lib/radioApi";
import { nearestStations, type Coordinates } from "@/lib/spatial";

type CesiumNS = CesiumModule;

let BlendOption: CesiumNS["BlendOption"];
let CameraEventType: CesiumNS["CameraEventType"];
let Cartesian2: CesiumNS["Cartesian2"];
let Cartesian3: CesiumNS["Cartesian3"];
let Cartographic: CesiumNS["Cartographic"];
let Color: CesiumNS["Color"];
let EasingFunction: CesiumNS["EasingFunction"];
let ImageryLayer: CesiumNS["ImageryLayer"];
let KeyboardEventModifier: CesiumNS["KeyboardEventModifier"];
let CesiumMath: CesiumNS["Math"];
let PointPrimitiveCollection: CesiumNS["PointPrimitiveCollection"];
let SceneTransforms: CesiumNS["SceneTransforms"];
let ScreenSpaceEventHandler: CesiumNS["ScreenSpaceEventHandler"];
let ScreenSpaceEventType: CesiumNS["ScreenSpaceEventType"];
let EllipsoidTerrainProvider: CesiumNS["EllipsoidTerrainProvider"];
let UrlTemplateImageryProvider: CesiumNS["UrlTemplateImageryProvider"];
let Viewer: CesiumNS["Viewer"];
let WebMapTileServiceImageryProvider: CesiumNS["WebMapTileServiceImageryProvider"];

let STATION_COLOR: Cesium.Color;
let FAVORITE_COLOR: Cesium.Color;
let PLAYING_COLOR: Cesium.Color;

function bindCesium(cesium: CesiumNS) {
  BlendOption = cesium.BlendOption;
  CameraEventType = cesium.CameraEventType;
  Cartesian2 = cesium.Cartesian2;
  Cartesian3 = cesium.Cartesian3;
  Cartographic = cesium.Cartographic;
  Color = cesium.Color;
  EasingFunction = cesium.EasingFunction;
  ImageryLayer = cesium.ImageryLayer;
  KeyboardEventModifier = cesium.KeyboardEventModifier;
  CesiumMath = cesium.Math;
  PointPrimitiveCollection = cesium.PointPrimitiveCollection;
  SceneTransforms = cesium.SceneTransforms;
  ScreenSpaceEventHandler = cesium.ScreenSpaceEventHandler;
  ScreenSpaceEventType = cesium.ScreenSpaceEventType;
  EllipsoidTerrainProvider = cesium.EllipsoidTerrainProvider;
  UrlTemplateImageryProvider = cesium.UrlTemplateImageryProvider;
  Viewer = cesium.Viewer;
  WebMapTileServiceImageryProvider = cesium.WebMapTileServiceImageryProvider;
  STATION_COLOR = Color.fromCssColorString("#ff1493")!;
  FAVORITE_COLOR = Color.fromCssColorString("#FFFF00")!;
  PLAYING_COLOR = Color.WHITE;
}

function pinAppearance(color: Cesium.Color) {
  return {
    color,
    outlineColor: Color.clone(color),
    outlineWidth: 0,
  };
}

function applyPinAppearance(point: Cesium.PointPrimitive, color: Cesium.Color) {
  point.color = color;
  point.outlineColor = Color.clone(color);
  point.outlineWidth = 0;
}
const WORLD_IMAGERY_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NIGHT_IMAGERY =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png";
const POINTER_CLICK_THRESHOLD = 6;
const STATION_PICK_RADIUS = 22;
const CENTER_TARGET_RADIUS = 48;
const DEFAULT_CURSOR = "crosshair";
const DRAGGING_CURSOR = "grabbing";
const STATION_CURSOR = "pointer";
const PIN_SCALE = 0.45;
const CENTER_FLIGHT_DURATION = 0.9;
const PINS_PER_FRAME = 160;
const PINS_PER_FRAME_HEAVY = 240;

const GLOBE_SATELLITE_TONE = {
  brightness: 0.98,
  contrast: 1.16,
  saturation: 1.1,
  gamma: 0.9,
} as const;

const GLOBE_NIGHT_TONE = {
  brightness: 1.14,
  contrast: 1.06,
  saturation: 1.08,
} as const;

function pinSizeForStation(
  station: {
    votes?: number;
    clickCount?: number;
  },
  options?: { playing?: boolean },
) {
  const popularity = Math.max(
    station.clickCount ?? 0,
    (station.votes ?? 0) * 20,
  );
  const base = Math.min(10, 3 + Math.log10(popularity + 1) * 1.2) * PIN_SCALE;
  return options?.playing ? Math.max(base, 12 * PIN_SCALE) : base;
}

function pinColorForStation(
  stationId: string,
  favoriteIds: ReadonlySet<string>,
  selectedStationId: string | null,
  isPlaying: boolean,
) {
  if (selectedStationId === stationId && isPlaying) {
    return PLAYING_COLOR;
  }
  if (favoriteIds.has(stationId)) {
    return FAVORITE_COLOR;
  }
  return STATION_COLOR;
}

function applyStationPin(
  point: Cesium.PointPrimitive,
  stationId: string,
  station: { votes?: number; clickCount?: number },
  favoriteIds: ReadonlySet<string>,
  selectedStationId: string | null,
  isPlaying: boolean,
) {
  const playing = selectedStationId === stationId && isPlaying;
  point.pixelSize = pinSizeForStation(station, { playing });
  applyPinAppearance(
    point,
    pinColorForStation(stationId, favoriteIds, selectedStationId, isPlaying),
  );
}

function refreshAllPinAppearances(
  renderedPoints: Map<string, Cesium.PointPrimitive>,
  favoriteIds: ReadonlySet<string>,
  selectedStationId: string | null,
  isPlaying: boolean,
) {
  for (const [stationId, point] of renderedPoints) {
    const station = isStationPoint(point.id) ? point.id : {};
    applyStationPin(
      point,
      stationId,
      station,
      favoriteIds,
      selectedStationId,
      isPlaying,
    );
  }
}

function centerGlobeOnCoordinates(
  viewer: Cesium.Viewer,
  coordinates: { lat: number; lng: number },
  options?: { duration?: number },
) {
  const height = viewer.camera.positionCartographic.height;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      coordinates.lng,
      coordinates.lat,
      height,
    ),
    duration: options?.duration ?? CENTER_FLIGHT_DURATION,
    easingFunction: EasingFunction.QUADRATIC_IN_OUT,
    complete: () => {
      if (!viewer.isDestroyed()) viewer.scene.requestRender();
    },
  });
}

function stationIsAtViewportCenter(
  viewer: Cesium.Viewer,
  station: { lat: number; lng: number },
): boolean {
  const canvas = viewer.scene.canvas;
  const center = new Cartesian2(
    canvas.clientWidth / 2,
    canvas.clientHeight / 2,
  );
  const probe: StationPoint = {
    id: "__center_probe__",
    lat: station.lat,
    lng: station.lng,
    votes: 0,
    clickCount: 0,
  };
  return (
    nearestStationAtScreenPosition(viewer, center, [probe], CENTER_TARGET_RADIUS) !==
    null
  );
}

interface FocusRequest extends Coordinates {
  nonce: number;
}

interface GlobeViewportProps {
  stations: StationPoint[];
  selectedStation: RadioStation | null;
  favoriteStationIds?: readonly string[];
  isPlaying?: boolean;
  focusCoordinates?: FocusRequest | null;
  onSelectStation: (station: StationPoint) => void;
  onCenterSettled: (
    coordinates: Coordinates,
    station: StationPoint | null,
  ) => void;
  onInteraction: () => void;
  onNavigationSettled: (options?: { awaitingCenterResolve?: boolean }) => void;
}

function isStationPoint(value: unknown): value is StationPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<StationPoint>;
  return (
    typeof point.id === "string" &&
    typeof point.lat === "number" &&
    typeof point.lng === "number"
  );
}

function stationFromPick(picked: unknown): StationPoint | null {
  if (!picked || typeof picked !== "object") return null;
  const candidate = picked as { id?: unknown; primitive?: { id?: unknown } };
  if (isStationPoint(candidate.id)) return candidate.id;
  if (isStationPoint(candidate.primitive?.id)) return candidate.primitive.id;
  return null;
}

function nearestStationAtScreenPosition(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian2,
  stations: StationPoint[],
  radius: number,
): StationPoint | null {
  let nearest: StationPoint | null = null;
  let nearestDistance = radius;
  const cameraPosition = viewer.camera.positionWC;
  const cameraDirection = Cartesian3.normalize(
    cameraPosition,
    new Cartesian3(),
  );
  const horizonCosine =
    viewer.scene.globe.ellipsoid.maximumRadius /
    Cartesian3.magnitude(cameraPosition);

  for (const station of stations) {
    const worldPosition = Cartesian3.fromDegrees(
      station.lng,
      station.lat,
      2_000,
    );
    const stationDirection = Cartesian3.normalize(
      worldPosition,
      new Cartesian3(),
    );
    if (Cartesian3.dot(stationDirection, cameraDirection) < horizonCosine) {
      continue;
    }

    const screenPosition = SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      worldPosition,
    );
    if (!screenPosition) continue;

    const distance = Cartesian2.distance(position, screenPosition);
    if (distance <= nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function coordinatesAtViewportCenter(viewer: Cesium.Viewer): Coordinates | null {
  const canvas = viewer.scene.canvas;
  const center = new Cartesian2(
    canvas.clientWidth / 2,
    canvas.clientHeight / 2,
  );
  const position = viewer.camera.pickEllipsoid(
    center,
    viewer.scene.globe.ellipsoid,
  );
  if (!position) return null;

  const cartographic = Cartographic.fromCartesian(position);
  return {
    lat: CesiumMath.toDegrees(cartographic.latitude),
    lng: CesiumMath.toDegrees(cartographic.longitude),
  };
}

function stationAtViewportCenter(
  viewer: Cesium.Viewer,
  stations: StationPoint[],
): StationPoint | null {
  const canvas = viewer.scene.canvas;
  return nearestStationAtScreenPosition(
    viewer,
    new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
    stations,
    CENTER_TARGET_RADIUS,
  );
}

function coordinatesAtScreenPosition(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian2,
): Coordinates | null {
  const cartesian = viewer.camera.pickEllipsoid(
    position,
    viewer.scene.globe.ellipsoid,
  );
  if (!cartesian) return null;

  const cartographic = Cartographic.fromCartesian(cartesian);
  return {
    lat: CesiumMath.toDegrees(cartographic.latitude),
    lng: CesiumMath.toDegrees(cartographic.longitude),
  };
}

export default function GlobeViewport({
  stations,
  selectedStation,
  favoriteStationIds = [],
  isPlaying = false,
  focusCoordinates = null,
  onSelectStation,
  onCenterSettled,
  onInteraction,
  onNavigationSettled,
}: GlobeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const pointCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const stationsRef = useRef(stations);
  const selectedStationRef = useRef(selectedStation);
  const favoriteIdsRef = useRef(new Set(favoriteStationIds));
  const isPlayingRef = useRef(isPlaying);
  const renderedPointsRef = useRef(new Map<string, Cesium.PointPrimitive>());
  const pendingStationsRef = useRef<StationPoint[]>([]);
  const pendingStationIdsRef = useRef(new Set<string>());
  const pinRevealFrameRef = useRef<number | null>(null);
  const programmaticCenterRef = useRef(false);
  const navigationKindRef = useRef<"rotate" | "zoom" | null>(null);
  const suppressNextMoveEndRef = useRef(false);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const hasAssignedInitialCenterRef = useRef(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const callbacksRef = useRef({
    onSelectStation,
    onCenterSettled,
    onInteraction,
    onNavigationSettled,
  });

  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  useEffect(() => {
    selectedStationRef.current = selectedStation;
  }, [selectedStation]);

  function stopPinReveal() {
    if (pinRevealFrameRef.current !== null) {
      cancelAnimationFrame(pinRevealFrameRef.current);
      pinRevealFrameRef.current = null;
    }
  }

  function addRenderedStation(
    collection: Cesium.PointPrimitiveCollection,
    station: StationPoint,
  ) {
    const point = collection.add({
      position: Cartesian3.fromDegrees(station.lng, station.lat, 2_000),
      pixelSize: pinSizeForStation(station),
      ...pinAppearance(STATION_COLOR),
      id: station,
    });
    renderedPointsRef.current.set(station.id, point);
    applyStationPin(
      point,
      station.id,
      station,
      favoriteIdsRef.current,
      selectedStationRef.current?.id ?? null,
      isPlayingRef.current,
    );
  }

  function runPinRevealFrame() {
    pinRevealFrameRef.current = null;
    const collection = pointCollectionRef.current;
    const viewer = viewerRef.current;
    if (!collection || !viewer || viewer.isDestroyed()) {
      pendingStationsRef.current = [];
      pendingStationIdsRef.current.clear();
      return;
    }

    const pending = pendingStationsRef.current;
    if (pending.length === 0) return;

    const batchSize = Math.min(
      pending.length > 4_000 ? PINS_PER_FRAME_HEAVY : PINS_PER_FRAME,
      pending.length,
    );

    for (let index = 0; index < batchSize; index += 1) {
      const station = pending.shift();
      if (!station) break;
      pendingStationIdsRef.current.delete(station.id);
      if (renderedPointsRef.current.has(station.id)) continue;
      addRenderedStation(collection, station);
    }

    viewer.scene.requestRender();

    if (pending.length > 0) {
      pinRevealFrameRef.current = requestAnimationFrame(runPinRevealFrame);
    }
  }

  function schedulePinReveal() {
    if (pinRevealFrameRef.current !== null) return;
    pinRevealFrameRef.current = requestAnimationFrame(runPinRevealFrame);
  }

  useEffect(() => {
    favoriteIdsRef.current = new Set(favoriteStationIds);
  }, [favoriteStationIds]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!focusCoordinates) return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    programmaticCenterRef.current = true;
    suppressNextMoveEndRef.current = true;
    centerGlobeOnCoordinates(viewer, focusCoordinates, { duration: 1.1 });
  }, [focusCoordinates?.nonce]);

  useEffect(() => {
    callbacksRef.current = {
      onSelectStation,
      onCenterSettled,
      onInteraction,
      onNavigationSettled,
    };
  }, [
    onCenterSettled,
    onInteraction,
    onNavigationSettled,
    onSelectStation,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let settleTimer = 0;
    let viewer: Cesium.Viewer | null = null;
    let clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
    let removeMoveStart: (() => void) | null = null;
    let removeMoveEnd: (() => void) | null = null;
    let removeNavigationListeners: (() => void) | null = null;
    const renderedPoints = renderedPointsRef.current;

    async function initialize() {
      bindCesium(await loadCesium());
      if (cancelled || !container) return;

      const satelliteProvider = new UrlTemplateImageryProvider({
        url: WORLD_IMAGERY_TILES,
        maximumLevel: 19,
        enablePickFeatures: false,
        credit: "Esri, Maxar, Earthstar Geographics",
      });
      if (cancelled || !container) return;

      const baseLayer = new ImageryLayer(satelliteProvider, {
        dayAlpha: 1,
        nightAlpha: 0.44,
        brightness: GLOBE_SATELLITE_TONE.brightness,
        contrast: GLOBE_SATELLITE_TONE.contrast,
        saturation: GLOBE_SATELLITE_TONE.saturation,
        gamma: GLOBE_SATELLITE_TONE.gamma,
      });
      const creditContainer = document.createElement("div");
      creditContainer.style.display = "none";
      viewer = new Viewer(container, {
        baseLayer,
        terrainProvider: new EllipsoidTerrainProvider(),
        creditContainer,
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        scene3DOnly: true,
        contextOptions: {
          webgl: {
            alpha: true,
          },
        },
        requestRenderMode: true,
        maximumRenderTimeChange: 30,
        msaaSamples: 4,
      });
      viewerRef.current = viewer;

      const { scene } = viewer;
      scene.backgroundColor = Color.TRANSPARENT;
      if (scene.skyBox) scene.skyBox.show = false;
      scene.globe.baseColor = Color.fromCssColorString("#112a4c");
      scene.globe.enableLighting = true;
      scene.globe.dynamicAtmosphereLighting = true;
      scene.globe.dynamicAtmosphereLightingFromSun = true;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.depthTestAgainstTerrain = false;
      scene.requestRender();
      setViewerReady(true);

      try {
        const nightProvider = new WebMapTileServiceImageryProvider({
          url: NIGHT_IMAGERY,
          layer: "VIIRS_Black_Marble",
          style: "default",
          format: "image/png",
          tileMatrixSetID: "GoogleMapsCompatible_Level8",
          maximumLevel: 8,
          credit: "NASA Global Imagery Browse Services",
        });
        viewer.imageryLayers.add(
          new ImageryLayer(nightProvider, {
            dayAlpha: 0,
            nightAlpha: 0.86,
            brightness: GLOBE_NIGHT_TONE.brightness,
            contrast: GLOBE_NIGHT_TONE.contrast,
            saturation: GLOBE_NIGHT_TONE.saturation,
          }),
        );
      } catch (error) {
        console.warn("Night imagery unavailable", error);
      }

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.hueShift = 0.04;
        scene.skyAtmosphere.saturationShift = 0.22;
        scene.skyAtmosphere.brightnessShift = 0.22;
      }
      const controller = scene.screenSpaceCameraController;
      controller.minimumZoomDistance = 8_000;
      controller.maximumZoomDistance = 30_000_000;
      controller.enableTilt = false;
      controller.tiltEventTypes = [
        CameraEventType.MIDDLE_DRAG,
        {
          eventType: CameraEventType.LEFT_DRAG,
          modifier: KeyboardEventModifier.CTRL,
        },
        {
          eventType: CameraEventType.RIGHT_DRAG,
          modifier: KeyboardEventModifier.CTRL,
        },
      ];
      controller.zoomEventTypes = [
        CameraEventType.WHEEL,
        CameraEventType.PINCH,
        CameraEventType.RIGHT_DRAG,
      ];

      const points = scene.primitives.add(
        new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE }),
      );
      pointCollectionRef.current = points;
      for (const station of stationsRef.current) {
        const point = points.add({
          position: Cartesian3.fromDegrees(station.lng, station.lat, 2_000),
          pixelSize: pinSizeForStation(station),
          ...pinAppearance(STATION_COLOR),
          id: station,
        });
        renderedPoints.set(station.id, point);
      }

      refreshAllPinAppearances(
        renderedPoints,
        favoriteIdsRef.current,
        selectedStationRef.current?.id ?? null,
        isPlayingRef.current,
      );

      const setCanvasCursor = (cursor: string) => {
        scene.canvas.style.cursor = cursor;
      };
      const pickStationAt = (position: Cesium.Cartesian2): StationPoint | null => {
        if (!viewer) return null;
        const pickedObject = scene.pick(position);
        const pickedStation = stationFromPick(pickedObject);
        if (pickedStation) return pickedStation;

        const pickedObjects = scene.drillPick(position, 8);
        for (const picked of pickedObjects) {
          const station = stationFromPick(picked);
          if (station) return station;
        }

        return nearestStationAtScreenPosition(
          viewer,
          position,
          stationsRef.current,
          STATION_PICK_RADIUS,
        );
      };
      let lastSelection: { id: string; at: number } | null = null;
      const selectStationAt = (position: Cesium.Cartesian2) => {
        if (!viewer) return;
        const directlyPicked = pickStationAt(position);
        const coordinates = coordinatesAtScreenPosition(viewer, position);
        const station =
          directlyPicked ??
          (coordinates
            ? nearestStations(coordinates, stationsRef.current, 1)[0]
            : null);
        if (!station) return;

        const now = Date.now();
        if (
          lastSelection?.id === station.id &&
          now - lastSelection.at < 300
        ) {
          return;
        }
        lastSelection = { id: station.id, at: now };
        suppressNextMoveEndRef.current = true;
        callbacksRef.current.onSelectStation(station);
        if (!stationIsAtViewportCenter(viewer, station)) {
          programmaticCenterRef.current = true;
          callbacksRef.current.onInteraction();
          centerGlobeOnCoordinates(viewer, station);
        }
      };
      const updateHoverCursor = (position: Cesium.Cartesian2) => {
        if (pointerDownRef.current) return;
        setCanvasCursor(
          pickStationAt(position) ? STATION_CURSOR : DEFAULT_CURSOR,
        );
      };

      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(12, 28, 21_000_000),
      });

      const zoomCamera = (zoomIn: boolean, fraction: number) => {
        if (!viewer) return;
        const height = viewer.camera.positionCartographic.height;
        const distance = height * Math.min(0.2, Math.max(0.008, fraction));
        const availableDistance = zoomIn
          ? Math.max(0, height - controller.minimumZoomDistance)
          : Math.max(0, controller.maximumZoomDistance - height);
        const safeDistance = Math.min(distance, availableDistance);
        if (safeDistance <= 0) return;

        if (zoomIn) viewer.camera.zoomIn(safeDistance);
        else viewer.camera.zoomOut(safeDistance);
        navigationKindRef.current = "zoom";
        callbacksRef.current.onInteraction();
        scene.requestRender();
      };
      const handleTrackpadPinch = (event: WheelEvent) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        zoomCamera(event.deltaY < 0, Math.abs(event.deltaY) * 0.004);
      };
      let lastGestureScale = 1;
      const handleGestureStart = (event: Event) => {
        const gesture = event as Event & { scale?: number };
        event.preventDefault();
        lastGestureScale = gesture.scale ?? 1;
        navigationKindRef.current = "zoom";
        callbacksRef.current.onInteraction();
      };
      const handleGestureChange = (event: Event) => {
        const gesture = event as Event & { scale?: number };
        event.preventDefault();
        event.stopImmediatePropagation();
        const scale = gesture.scale ?? lastGestureScale;
        const ratio = scale / Math.max(0.001, lastGestureScale);
        if (Math.abs(ratio - 1) > 0.001) {
          zoomCamera(ratio > 1, Math.abs(Math.log(ratio)) * 1.8);
        }
        lastGestureScale = scale;
      };
      const handleGestureEnd = (event: Event) => {
        event.preventDefault();
        lastGestureScale = 1;
      };
      const markPointerNavigation = (event: PointerEvent) => {
        if (event.type === "pointerdown") {
          navigationKindRef.current = event.button === 0 ? "rotate" : "zoom";
          if (event.button === 0) {
            pointerDownRef.current = { x: event.clientX, y: event.clientY };
            isDraggingRef.current = false;
            setCanvasCursor(DRAGGING_CURSOR);
          }
          return;
        }
        if (event.type === "pointermove" && pointerDownRef.current) {
          const dx = event.clientX - pointerDownRef.current.x;
          const dy = event.clientY - pointerDownRef.current.y;
          if (Math.hypot(dx, dy) > POINTER_CLICK_THRESHOLD) {
            isDraggingRef.current = true;
          }
        }
      };
      const resetPointerState = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const startedOnCanvas = pointerDownRef.current !== null;
        const wasDragging = isDraggingRef.current;
        pointerDownRef.current = null;
        isDraggingRef.current = false;
        const rect = scene.canvas.getBoundingClientRect();
        const position = new Cartesian2(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        updateHoverCursor(position);

        if (startedOnCanvas && !wasDragging) {
          selectStationAt(position);
        }
      };
      const markTouchNavigation = (event: TouchEvent) => {
        if (event.touches.length >= 2) {
          pointerDownRef.current = null;
          isDraggingRef.current = true;
          navigationKindRef.current = "zoom";
          setCanvasCursor(DRAGGING_CURSOR);
          if (event.type === "touchstart") {
            callbacksRef.current.onInteraction();
          }
          return;
        }

        navigationKindRef.current = "rotate";
        if (event.type === "touchstart" && event.touches.length === 1) {
          pointerDownRef.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
          isDraggingRef.current = false;
          setCanvasCursor(DRAGGING_CURSOR);
          return;
        }
        if (
          event.type === "touchmove" &&
          pointerDownRef.current &&
          event.touches.length === 1
        ) {
          const dx = event.touches[0].clientX - pointerDownRef.current.x;
          const dy = event.touches[0].clientY - pointerDownRef.current.y;
          if (Math.hypot(dx, dy) > POINTER_CLICK_THRESHOLD) {
            isDraggingRef.current = true;
          }
        }
      };
      const resetTouchState = (event: TouchEvent) => {
        if (event.touches.length >= 2) return;
        if (event.touches.length > 0) return;
        const startedOnCanvas = pointerDownRef.current !== null;
        const wasDragging = isDraggingRef.current;
        pointerDownRef.current = null;
        isDraggingRef.current = false;
        setCanvasCursor(DEFAULT_CURSOR);

        const touch = event.changedTouches[0];
        if (startedOnCanvas && !wasDragging && touch) {
          const rect = scene.canvas.getBoundingClientRect();
          const position = new Cartesian2(
            touch.clientX - rect.left,
            touch.clientY - rect.top,
          );
          selectStationAt(position);
        }
      };
      scene.canvas.addEventListener("wheel", handleTrackpadPinch, {
        passive: false,
        capture: true,
      });
      scene.canvas.addEventListener("gesturestart", handleGestureStart, {
        passive: false,
        capture: true,
      });
      scene.canvas.addEventListener("gesturechange", handleGestureChange, {
        passive: false,
        capture: true,
      });
      scene.canvas.addEventListener("gestureend", handleGestureEnd, {
        passive: false,
        capture: true,
      });
      scene.canvas.addEventListener("pointerdown", markPointerNavigation, {
        capture: true,
      });
      scene.canvas.addEventListener("pointermove", markPointerNavigation, {
        capture: true,
      });
      scene.canvas.addEventListener("pointerup", resetPointerState, {
        capture: true,
      });
      scene.canvas.addEventListener("pointercancel", resetPointerState, {
        capture: true,
      });
      scene.canvas.addEventListener("touchstart", markTouchNavigation, {
        passive: true,
        capture: true,
      });
      scene.canvas.addEventListener("touchmove", markTouchNavigation, {
        passive: true,
        capture: true,
      });
      scene.canvas.addEventListener("touchend", resetTouchState, {
        passive: true,
        capture: true,
      });
      scene.canvas.addEventListener("touchcancel", resetTouchState, {
        passive: true,
        capture: true,
      });
      removeNavigationListeners = () => {
        scene.canvas.removeEventListener("wheel", handleTrackpadPinch, {
          capture: true,
        });
        scene.canvas.removeEventListener("gesturestart", handleGestureStart, {
          capture: true,
        });
        scene.canvas.removeEventListener("gesturechange", handleGestureChange, {
          capture: true,
        });
        scene.canvas.removeEventListener("gestureend", handleGestureEnd, {
          capture: true,
        });
        scene.canvas.removeEventListener(
          "pointerdown",
          markPointerNavigation,
          { capture: true },
        );
        scene.canvas.removeEventListener(
          "pointermove",
          markPointerNavigation,
          { capture: true },
        );
        scene.canvas.removeEventListener("pointerup", resetPointerState, {
          capture: true,
        });
        scene.canvas.removeEventListener("pointercancel", resetPointerState, {
          capture: true,
        });
        scene.canvas.removeEventListener("touchstart", markTouchNavigation, {
          capture: true,
        });
        scene.canvas.removeEventListener("touchmove", markTouchNavigation, {
          capture: true,
        });
        scene.canvas.removeEventListener("touchend", resetTouchState, {
          capture: true,
        });
        scene.canvas.removeEventListener("touchcancel", resetTouchState, {
          capture: true,
        });
      };

      clickHandler = new ScreenSpaceEventHandler(scene.canvas);
      clickHandler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
        if (!isDraggingRef.current) selectStationAt(movement.position);
      }, ScreenSpaceEventType.LEFT_CLICK);
      clickHandler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
        updateHoverCursor(movement.endPosition);
        scene.requestRender();
      }, ScreenSpaceEventType.MOUSE_MOVE);

      removeMoveStart = viewer.camera.moveStart.addEventListener(() => {
        window.clearTimeout(settleTimer);
        if (suppressNextMoveEndRef.current) return;
        navigationKindRef.current ??= "rotate";
        setCanvasCursor(DRAGGING_CURSOR);
        callbacksRef.current.onInteraction();
      });
      removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
        window.clearTimeout(settleTimer);
        if (programmaticCenterRef.current) {
          programmaticCenterRef.current = false;
        }
        if (suppressNextMoveEndRef.current) {
          suppressNextMoveEndRef.current = false;
          navigationKindRef.current = null;
          callbacksRef.current.onNavigationSettled({
            awaitingCenterResolve: false,
          });
          return;
        }
        const selected = selectedStationRef.current;
        if (selected) {
          if (!viewer || viewer.isDestroyed()) return;
          const navigationKind = navigationKindRef.current;
          navigationKindRef.current = null;
          if (!pointerDownRef.current) {
            setCanvasCursor(DEFAULT_CURSOR);
          }
          const selectedStillInCircle = nearestStationAtScreenPosition(
            viewer,
            new Cartesian2(
              scene.canvas.clientWidth / 2,
              scene.canvas.clientHeight / 2,
            ),
            [selected],
            CENTER_TARGET_RADIUS,
          );
          // Keep the user's zoom level when they zoom in on a chosen station.
          if (!selectedStillInCircle && navigationKind !== "zoom") {
            const stationInCircle = stationAtViewportCenter(
              viewer,
              stationsRef.current,
            );
            const coordinates = coordinatesAtViewportCenter(viewer);
            if (coordinates) {
              callbacksRef.current.onNavigationSettled({
                awaitingCenterResolve: true,
              });
              callbacksRef.current.onCenterSettled(
                coordinates,
                stationInCircle,
              );
              return;
            }
          }
          callbacksRef.current.onNavigationSettled({
            awaitingCenterResolve: false,
          });
          return;
        }
        if (navigationKindRef.current === "zoom") {
          navigationKindRef.current = null;
          setCanvasCursor(DEFAULT_CURSOR);
        } else {
          navigationKindRef.current = null;
          if (!pointerDownRef.current) {
            setCanvasCursor(DEFAULT_CURSOR);
          }
        }
        callbacksRef.current.onNavigationSettled({
          awaitingCenterResolve: true,
        });
        settleTimer = window.setTimeout(() => {
          if (!viewer || viewer.isDestroyed()) return;
          const coordinates = coordinatesAtViewportCenter(viewer);
          if (coordinates) {
            callbacksRef.current.onCenterSettled(
              coordinates,
              stationAtViewportCenter(
                viewer,
                stationsRef.current,
              ),
            );
          } else {
            callbacksRef.current.onNavigationSettled({
              awaitingCenterResolve: false,
            });
          }
        }, 450);
      });
      scene.requestRender();
      setCanvasCursor(DEFAULT_CURSOR);
      setViewerReady(true);

      if (
        !hasAssignedInitialCenterRef.current &&
        !selectedStationRef.current &&
        stationsRef.current.length > 0
      ) {
        hasAssignedInitialCenterRef.current = true;
        const coordinates = coordinatesAtViewportCenter(viewer);
        if (coordinates) {
          callbacksRef.current.onCenterSettled(
            coordinates,
            stationAtViewportCenter(viewer, stationsRef.current),
          );
        }
      }
    }

    void initialize().catch((error) => {
      console.error("Unable to initialize the satellite globe", error);
      if (!cancelled) setGlobeFailed(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(settleTimer);
      removeMoveStart?.();
      removeMoveEnd?.();
      removeNavigationListeners?.();
      clickHandler?.destroy();
      stopPinReveal();
      pendingStationsRef.current = [];
      pendingStationIdsRef.current.clear();
      renderedPoints.clear();
      pointCollectionRef.current = null;
      viewerRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  useEffect(() => {
    const collection = pointCollectionRef.current;
    const viewer = viewerRef.current;
    if (!collection || !viewer || viewer.isDestroyed()) return;

    const nextStations = new Map(stations.map((station) => [station.id, station]));
    for (const [stationId, point] of renderedPointsRef.current) {
      const station = nextStations.get(stationId);
      const renderedStation = isStationPoint(point.id) ? point.id : null;
      const coordinatesChanged =
        station &&
        renderedStation &&
        (renderedStation.lat !== station.lat ||
          renderedStation.lng !== station.lng);
      if (station && coordinatesChanged) {
        point.position = Cartesian3.fromDegrees(station.lng, station.lat, 2_000);
        point.id = station;
        applyStationPin(
          point,
          station.id,
          station,
          favoriteIdsRef.current,
          selectedStationRef.current?.id ?? null,
          isPlayingRef.current,
        );
        continue;
      }
      if (!station) {
        collection.remove(point);
        renderedPointsRef.current.delete(stationId);
      }
    }

    const nextStationIds = new Set(nextStations.keys());
    pendingStationsRef.current = pendingStationsRef.current.filter((station) => {
      if (!nextStationIds.has(station.id)) {
        pendingStationIdsRef.current.delete(station.id);
        return false;
      }
      return true;
    });

    for (const station of stations) {
      if (renderedPointsRef.current.has(station.id)) continue;
      if (pendingStationIdsRef.current.has(station.id)) continue;
      pendingStationIdsRef.current.add(station.id);
      pendingStationsRef.current.push(station);
    }

    schedulePinReveal();
  }, [stations]);

  useEffect(() => {
    if (
      !viewerReady ||
      selectedStation ||
      hasAssignedInitialCenterRef.current ||
      stations.length === 0
    ) {
      return;
    }
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    hasAssignedInitialCenterRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      if (viewer.isDestroyed()) return;
      const coordinates = coordinatesAtViewportCenter(viewer);
      if (coordinates) {
        callbacksRef.current.onCenterSettled(
          coordinates,
          stationAtViewportCenter(viewer, stationsRef.current),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedStation, stations, viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    refreshAllPinAppearances(
      renderedPointsRef.current,
      favoriteIdsRef.current,
      selectedStation?.id ?? null,
      isPlaying,
    );
    viewer.scene.requestRender();
  }, [selectedStation, isPlaying, favoriteStationIds]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none overflow-hidden bg-transparent"
        aria-label="Interactive high-resolution globe of radio stations"
      />
      {!viewerReady && !globeFailed ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="apple-panel flex items-center gap-2.5 px-4 py-3">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#86868b]" />
            <span className="text-[15px] text-[#6e6e73]">Loading</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

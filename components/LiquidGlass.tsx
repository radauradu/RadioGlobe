"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createLiquidGlassMaps,
  supportsSvgBackdropFilter,
} from "@/lib/liquidGlass";

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  radius?: number;
  bezel?: number;
  pill?: boolean;
  "aria-label"?: string;
}

export default function LiquidGlass({
  children,
  className = "",
  radius = 22,
  bezel = 21,
  pill = false,
  "aria-label": ariaLabel,
}: LiquidGlassProps) {
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [canUseSvgFilter, setCanUseSvgFilter] = useState(false);

  useEffect(() => {
    setCanUseSvgFilter(supportsSvgBackdropFilter());
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const box = node.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(box.width)),
        height: Math.max(1, Math.round(box.height)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cornerRadius = pill
    ? Math.max(1, Math.min(size.width, size.height) / 2)
    : radius;

  const maps = useMemo(() => {
    if (!canUseSvgFilter || size.width < 8 || size.height < 8) return null;
    return createLiquidGlassMaps(
      size.width,
      size.height,
      cornerRadius,
      bezel,
    );
  }, [bezel, canUseSvgFilter, cornerRadius, size.height, size.width]);

  return (
    <div ref={ref} className={`relative flex flex-col ${className}`.trim()}>
      {maps ? (
        <svg
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        >
          <filter
            id={filterId}
            x="0"
            y="0"
            width={maps.width}
            height={maps.height}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={maps.displacement}
              x="0"
              y="0"
              width={maps.width}
              height={maps.height}
              preserveAspectRatio="none"
              result="displacement_map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="displacement_map"
              scale={maps.scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="refract"
            />
            <feImage
              href={maps.specular}
              x="0"
              y="0"
              width={maps.width}
              height={maps.height}
              preserveAspectRatio="none"
              result="spec"
            />
            <feColorMatrix
              in="spec"
              type="saturate"
              values="1.8"
              result="specSat"
            />
            <feBlend in="refract" in2="specSat" mode="screen" />
          </filter>
        </svg>
      ) : null}
      <div
        className={`liquid-glass min-h-0 w-full flex-1 ${pill ? "liquid-glass-pill" : ""}`.trim()}
        data-liquid={maps ? "refract" : "frost"}
        aria-label={ariaLabel}
        style={
          maps
            ? {
                borderRadius: pill ? 999 : radius,
                backdropFilter: `url(#${filterId}) blur(1px)`,
                WebkitBackdropFilter: `url(#${filterId}) blur(1px)`,
              }
            : { borderRadius: pill ? 999 : radius }
        }
      >
        <div className="liquid-glass-content">{children}</div>
      </div>
    </div>
  );
}

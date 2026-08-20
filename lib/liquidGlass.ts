/** Convex squircle height used by Apple-like liquid glass bezels. */
export function convexSquircle(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return (1 - (1 - t) ** 4) ** 0.25;
}

function sdRoundedRect(
  px: number,
  py: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
) {
  const ax = Math.abs(px) - halfWidth + radius;
  const ay = Math.abs(py) - halfHeight + radius;
  const dx = Math.max(ax, 0);
  const dy = Math.max(ay, 0);
  return Math.min(Math.max(ax, ay), 0) + Math.hypot(dx, dy) - radius;
}

/**
 * 1D bezel refraction via Snell's law, matching the kube.io slice:
 * x=0 at the outer rim, x=1 at the inner edge of the bezel.
 * Positive values pull the backdrop inward (convex glass).
 */
export function computeRefractionMagnitudes({
  bezelWidth,
  thickness,
  ior = 1.5,
  samples = 127,
}: {
  bezelWidth: number;
  thickness: number;
  ior?: number;
  samples?: number;
}) {
  const eta = 1 / ior;
  const values = new Float32Array(samples);

  for (let i = 0; i < samples; i += 1) {
    const x = i / Math.max(1, samples - 1);
    const height = convexSquircle(x);
    const delta = 0.001;
    const derivative =
      (convexSquircle(x + delta) - convexSquircle(x - delta)) / (2 * delta);
    const nx = -derivative;
    const ny = 1;
    const nLength = Math.hypot(nx, ny) || 1;
    const nnx = nx / nLength;
    const nny = ny / nLength;

    // Incident ray is orthogonal to the background plane.
    const incidentX = 0;
    const incidentY = -1;
    const cosI = Math.min(
      1,
      Math.max(-1, -(incidentX * nnx + incidentY * nny)),
    );
    const k = 1 - eta * eta * (1 - cosI * cosI);
    if (k < 0) {
      values[i] = 0;
      continue;
    }

    const cosT = Math.sqrt(k);
    const refractX = eta * incidentX + (eta * cosI - cosT) * nnx;
    const refractY = eta * incidentY + (eta * cosI - cosT) * nny;
    const travel = height * bezelWidth + thickness;
    values[i] = refractY === 0 ? 0 : (refractX / refractY) * travel;
  }

  return values;
}

function canvasToDataUrl(
  width: number,
  height: number,
  paint: (data: Uint8ClampedArray) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(width, height);
  paint(image.data);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export function createLiquidGlassMaps(
  width: number,
  height: number,
  radius = 22,
  bezel = 18,
) {
  const w = Math.max(8, Math.round(width));
  const h = Math.max(8, Math.round(height));
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.max(1, Math.min(radius, hw, hh));
  const bezelWidth = Math.max(6, Math.min(bezel, r, hw, hh));
  const thickness = bezelWidth * 4.2;
  const magnitudes = computeRefractionMagnitudes({
    bezelWidth,
    thickness,
  });
  let maxDisplacement = 0.0001;
  for (const value of magnitudes) {
    maxDisplacement = Math.max(maxDisplacement, Math.abs(value));
  }

  const epsilon = 0.8;
  const keyX = Math.cos((-42 * Math.PI) / 180);
  const keyY = Math.sin((-42 * Math.PI) / 180);
  const fillX = Math.cos((128 * Math.PI) / 180);
  const fillY = Math.sin((128 * Math.PI) / 180);

  const displacement = canvasToDataUrl(w, h, (data) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const px = x + 0.5 - hw;
        const py = y + 0.5 - hh;
        const distance = sdRoundedRect(px, py, hw, hh, r);
        const inside = Math.max(0, -distance);
        const offset = (y * w + x) * 4;
        data[offset] = 128;
        data[offset + 1] = 128;
        data[offset + 2] = 128;
        data[offset + 3] = 255;
        if (inside <= 0 || inside >= bezelWidth) continue;

        const gx =
          sdRoundedRect(px + epsilon, py, hw, hh, r) -
          sdRoundedRect(px - epsilon, py, hw, hh, r);
        const gy =
          sdRoundedRect(px, py + epsilon, hw, hh, r) -
          sdRoundedRect(px, py - epsilon, hw, hh, r);
        const length = Math.hypot(gx, gy) || 1;
        const t = inside / bezelWidth;
        const sample = Math.min(
          magnitudes.length - 1,
          Math.max(0, Math.round(t * (magnitudes.length - 1))),
        );
        const magnitude = Math.abs(magnitudes[sample]) / maxDisplacement;
        // Convex bezel: displacement is along the inward normal.
        const dx = (-gx / length) * magnitude;
        const dy = (-gy / length) * magnitude;
        data[offset] = Math.max(0, Math.min(255, Math.round(128 + dx * 127)));
        data[offset + 1] = Math.max(
          0,
          Math.min(255, Math.round(128 + dy * 127)),
        );
      }
    }
  });

  const specular = canvasToDataUrl(w, h, (data) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const px = x + 0.5 - hw;
        const py = y + 0.5 - hh;
        const distance = sdRoundedRect(px, py, hw, hh, r);
        const inside = Math.max(0, -distance);
        const offset = (y * w + x) * 4;
        if (inside <= 0 || inside >= bezelWidth) {
          data[offset + 3] = 0;
          continue;
        }
        const gx =
          sdRoundedRect(px + epsilon, py, hw, hh, r) -
          sdRoundedRect(px - epsilon, py, hw, hh, r);
        const gy =
          sdRoundedRect(px, py + epsilon, hw, hh, r) -
          sdRoundedRect(px, py - epsilon, hw, hh, r);
        const length = Math.hypot(gx, gy) || 1;
        const nx = gx / length;
        const ny = gy / length;
        const t = inside / bezelWidth;
        const rim = (1 - t) ** 1.65;
        const key = Math.max(0, nx * keyX + ny * keyY) ** 4.2;
        const fill = Math.max(0, nx * fillX + ny * fillY) ** 3.2 * 0.14;
        const shine = Math.round(255 * rim * Math.min(1, key * 0.55 + fill));
        data[offset] = 214;
        data[offset + 1] = 232;
        data[offset + 2] = 255;
        data[offset + 3] = shine;
      }
    }
  });

  return {
    displacement,
    specular,
    scale: maxDisplacement * 5,
    width: w,
    height: h,
  };
}

export function supportsSvgBackdropFilter() {
  if (typeof window === "undefined" || typeof CSS === "undefined") {
    return false;
  }
  const chromium =
    "chrome" in window || /Chromium|Chrome|Edg\//.test(navigator.userAgent);
  return (
    chromium &&
    (CSS.supports("backdrop-filter", "url(#liquid-glass)") ||
      CSS.supports("-webkit-backdrop-filter", "url(#liquid-glass)"))
  );
}

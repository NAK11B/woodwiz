import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";

const BINS = 4;

type BarkIndexEntry = {
  speciesKey: string;
  filename: string;
  features: { hist: number[]; edge: number };
};

type BarkIndex = {
  entries: BarkIndexEntry[];
};

function binIndex(v: number): number {
  const b = Math.floor((v / 256) * BINS);
  return Math.min(BINS - 1, Math.max(0, b));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function euclidean(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function analyzeImageQuality(rgba: Uint8Array, w: number, h: number) {
  // Compute brightness mean + stddev (grayscale)
  // brightness in [0,255]
  const n = w * h;
  if (n <= 0) {
    return {
      mean: 0,
      std: 0,
      edgeNorm: 0,
      isTooDark: true,
      isTooFlat: true,
      isTooBlank: true,
    };
  }

  let sum = 0;
  let sumSq = 0;

  const grayAt = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    const r = rgba[idx + 0];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const g = grayAt(x, y);
      sum += g;
      sumSq += g * g;
    }
  }

  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const std = Math.sqrt(variance);

  // Edge estimate (same as your feature extractor)
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = grayAt(x + 1, y) - grayAt(x - 1, y);
      const gy = grayAt(x, y + 1) - grayAt(x, y - 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      edgeSum += mag;
      edgeCount += 1;
    }
  }

  const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const edgeNorm = clamp(edgeAvg / 100, 0, 1);

  // Thresholds (tuned for bark photos at 64px wide resize)
  // mean < ~18 = basically black
  // std < ~10 = very flat/blank/solid color
  // edgeNorm < ~0.02 = almost no structure
  const isTooDark = mean < 18;
  const isTooFlat = std < 10;
  const isTooBlank = (isTooDark && isTooFlat) || edgeNorm < 0.02;

  return { mean, std, edgeNorm, isTooDark, isTooFlat, isTooBlank };
}

function extractFeaturesFromRGBA(rgba: Uint8Array, w: number, h: number) {
  const histLen = BINS * BINS * BINS;
  const hist = new Array(histLen).fill(0);

  let edgeSum = 0;
  let edgeCount = 0;

  const grayAt = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    const r = rgba[idx + 0];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = rgba[idx + 0];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];

      const ri = binIndex(r);
      const gi = binIndex(g);
      const bi = binIndex(b);
      const hi = (ri * BINS + gi) * BINS + bi;
      hist[hi] += 1;

      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        const gx = grayAt(x + 1, y) - grayAt(x - 1, y);
        const gy = grayAt(x, y + 1) - grayAt(x, y - 1);
        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeSum += mag;
        edgeCount += 1;
      }
    }
  }

  const total = w * h;
  for (let i = 0; i < hist.length; i++) hist[i] /= total;

  const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const edgeNorm = Math.max(0, Math.min(1, edgeAvg / 100));

  return { hist, edge: edgeNorm };
}

export async function matchBarkPhoto(
  photoUri: string,
  barkIndex: BarkIndex,
  topK: number = 3
) {
  const manip = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 64 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!manip.base64) throw new Error("Failed to read image as base64.");

  const binary = atob(manip.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const decoded = jpeg.decode(bytes, { useTArray: true });

  // ✅ Quality gate BEFORE matching
  const qQuality = analyzeImageQuality(decoded.data, decoded.width, decoded.height);
  if (qQuality.isTooBlank) {
    // Returning [] makes UI show your "No match found" message.
    // If you want a specific message, throw an Error and handle it in UI.
    return [];
  }

  const q = extractFeaturesFromRGBA(decoded.data, decoded.width, decoded.height);

  // Track best (lowest) distance per species AND which filename produced it
  const bestBySpecies = new Map<string, { dist: number; filename: string }>();

  for (const e of barkIndex.entries) {
    const dHist = euclidean(q.hist, e.features.hist);
    const dEdge = Math.abs(q.edge - e.features.edge);
    const dist = dHist + dEdge * 0.25;

    const prev = bestBySpecies.get(e.speciesKey);
    if (prev === undefined || dist < prev.dist) {
      bestBySpecies.set(e.speciesKey, { dist, filename: e.filename });
    }
  }

  const ranked = Array.from(bestBySpecies.entries())
    .map(([speciesKey, best]) => ({
      speciesKey,
      dist: best.dist,
      filename: best.filename,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, topK);

  if (ranked.length === 0) return [];

  // Normalize confidence across the returned topK so values are visibly different.
  // Lower dist = better. Map best -> ~0.95 and worst -> ~0.55 (tunable).
  const bestDist = ranked[0].dist;
  const worstDist = ranked[ranked.length - 1].dist;
  const denom = Math.max(1e-9, worstDist - bestDist);

  const bestConf = 0.95;
  const worstConf = 0.55;

  return ranked.map((r, i) => {
    const t = clamp((r.dist - bestDist) / denom, 0, 1);
    const conf = lerp(bestConf, worstConf, t);

    return {
      rank: i + 1,
      speciesKey: r.speciesKey,
      filename: r.filename,
      distance: r.dist,
      confidence: clamp(conf, 0.05, 0.99),
    };
  });
}

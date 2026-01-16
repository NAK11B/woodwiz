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

function euclidean(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
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
  const q = extractFeaturesFromRGBA(decoded.data, decoded.width, decoded.height);

  const bestBySpecies = new Map<string, number>();

  for (const e of barkIndex.entries) {
    const dHist = euclidean(q.hist, e.features.hist);
    const dEdge = Math.abs(q.edge - e.features.edge);
    const dist = dHist + dEdge * 0.25;

    const prev = bestBySpecies.get(e.speciesKey);
    if (prev === undefined || dist < prev) bestBySpecies.set(e.speciesKey, dist);
  }

  return Array.from(bestBySpecies.entries())
    .map(([speciesKey, dist]) => ({ speciesKey, dist }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, topK)
    .map((r, i) => ({
      rank: i + 1,
      speciesKey: r.speciesKey,
      confidence: Math.max(0.05, Math.min(0.99, 1 / (1 + r.dist))),
    }));
}

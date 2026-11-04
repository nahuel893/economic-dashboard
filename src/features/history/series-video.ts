/**
 * Renders a history series as an animated video in the browser: the line is
 * drawn from left to right, a bubble follows its tip with the latest value and
 * value labels stay on the start of each period. Recorded with MediaRecorder,
 * so it needs no server and no extra dependency.
 */
import { logTicks, periodTicks } from "@/lib/indicators/history";
import { labelFits } from "@/lib/indicators/marks";
import { linearTicks } from "@/lib/indicators/history";
import { frameAt, labelIndices, makeYScale, rectsOverlap, type Rect } from "@/lib/indicators/series-animation";
import type { Point } from "@/lib/indicators/types";
import type { AxisLabels, ChartMark } from "./history-chart";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
/** Time the line takes to cross the chart, then how long the final frame stays. */
const DRAW_MS = 8000;
const HOLD_MS = 2000;
const MAX_LABELS = 10;
/** Minimum horizontal distance between two value labels, so they never touch. */
const LABEL_GAP = 150;

const PLOT = { left: 200, right: WIDTH - 170, top: 300, bottom: 930 };

export type VideoColors = { background: string; card: string; foreground: string; muted: string; border: string; tone: string };

export type VideoSeries = {
  title: string;
  description: string;
  periodLabel: string;
  source: string;
  site: string;
  points: Point[];
  marks: ChartMark[];
  log: boolean;
  axis: AxisLabels;
  colors: VideoColors;
  fontFamily: string;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  formatDate: (date: string) => string;
  formatTick: (date: string) => string;
};

type VideoType = { mimeType: string; extension: "mp4" | "webm" };

const CANDIDATES: VideoType[] = [
  { mimeType: "video/mp4;codecs=avc1.640028", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

/** The best format this browser can record, MP4 first; null when it cannot record canvas video at all. */
export function supportedVideoType(): VideoType | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type.mimeType)) ?? null;
}

/** Everything that stays the same in every frame. */
function prepare(series: VideoSeries) {
  const { points, log } = series;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  let low = min;
  let high = max;
  let ticks: number[];
  if (log) {
    ticks = logTicks(min, max);
  } else {
    const pad = (max - min || Math.abs(max) || 1) * 0.06;
    low = min >= 0 ? Math.max(0, min - pad) : min - pad;
    high = max + pad;
    ticks = linearTicks(low, high, 5);
  }

  const dates = points.map((p) => p.date);
  const x = (index: number) => PLOT.left + (index / Math.max(points.length - 1, 1)) * (PLOT.right - PLOT.left);
  const y = makeYScale(low, high, PLOT.bottom, PLOT.top, log);
  const xTicks =
    series.axis === "day"
      ? Array.from({ length: 6 }, (_, i) => dates[Math.round((i / 5) * (dates.length - 1))])
      : periodTicks(dates, series.axis, 8);
  const labels = labelIndices(dates, series.axis === "year" ? "year" : "month", MAX_LABELS).filter(
    (index, i, all) => i === 0 || x(index) - x(all[i - 1]) >= LABEL_GAP,
  );
  return { dates, x, y, ticks, xTicks, labels };
}

type Prepared = ReturnType<typeof prepare>;

function font(series: VideoSeries, size: number, weight = 400) {
  return `${weight} ${size}px ${series.fontFamily}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawFrame(ctx: CanvasRenderingContext2D, series: VideoSeries, frame: Prepared, progress: number) {
  const { colors, points } = series;
  const { dates, x, y, ticks, xTicks, labels } = frame;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = colors.tone;
  ctx.fillRect(0, 0, WIDTH, 10);

  // Header.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.foreground;
  ctx.font = font(series, 64, 800);
  ctx.fillText(series.title, 96, 140);
  ctx.fillStyle = colors.muted;
  ctx.font = font(series, 30);
  ctx.fillText(series.description, 96, 194);
  ctx.textAlign = "right";
  ctx.font = font(series, 32, 600);
  ctx.fillText(series.periodLabel, WIDTH - 96, 140);

  // Context marks, whole from the first frame.
  for (const mark of series.marks) {
    const x1 = x(dates.indexOf(mark.x1));
    const x2 = x(dates.indexOf(mark.x2));
    ctx.fillStyle = colors.foreground;
    ctx.globalAlpha = mark.shade ? 0.07 : 0.025;
    ctx.fillRect(x1, PLOT.top, x2 - x1, PLOT.bottom - PLOT.top);
    ctx.globalAlpha = 1;
    if (mark.edge) {
      ctx.strokeStyle = colors.muted;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(x1, PLOT.top);
      ctx.lineTo(x1, PLOT.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.font = font(series, 24);
    // Same rule as the chart, scaled from its 10px labels to these 24px ones.
    if (labelFits(mark.label, (x2 - x1) / 2.4)) {
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "center";
      ctx.fillText(mark.label, (x1 + x2) / 2, PLOT.top - 16 - mark.row * 32);
    }
  }

  // Axes.
  ctx.font = font(series, 24);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const tick of ticks) {
    const ty = y(tick);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PLOT.left, ty);
    ctx.lineTo(PLOT.right, ty);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.fillText(series.formatAxis(tick), PLOT.left - 20, ty);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const date of xTicks) ctx.fillText(series.formatTick(date), x(dates.indexOf(date)), PLOT.bottom + 22);

  // The line up to where the animation is, ending between two points.
  const { index, fraction } = frameAt(progress, points.length);
  const next = points[Math.min(index + 1, points.length - 1)];
  const tipX = x(index) + (x(Math.min(index + 1, points.length - 1)) - x(index)) * fraction;
  const tipY = y(points[index].value) + (y(next.value) - y(points[index].value)) * fraction;

  const trace = () => {
    ctx.beginPath();
    for (let i = 0; i <= index; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, x(i), y(points[i].value));
    ctx.lineTo(tipX, tipY);
  };

  trace();
  ctx.lineTo(tipX, PLOT.bottom);
  ctx.lineTo(x(0), PLOT.bottom);
  ctx.closePath();
  const area = ctx.createLinearGradient(0, PLOT.top, 0, PLOT.bottom);
  area.addColorStop(0, `color-mix(in srgb, ${colors.tone} 28%, transparent)`);
  area.addColorStop(1, `color-mix(in srgb, ${colors.tone} 0%, transparent)`);
  ctx.fillStyle = area;
  ctx.fill();

  trace();
  ctx.strokeStyle = colors.tone;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // The tip bubble is placed first, so the value labels it would cover can step aside.
  const value = series.formatValue(points[index].value);
  const date = series.formatDate(points[index].date);
  ctx.font = font(series, 34, 800);
  const valueWidth = ctx.measureText(value).width;
  ctx.font = font(series, 22);
  const width = Math.max(valueWidth, ctx.measureText(date).width) + 40;
  const height = 92;
  const bx = tipX + 24 + width > WIDTH - 40 ? tipX - 24 - width : tipX + 24;
  // Above the tip when it fits inside the plot, otherwise below it.
  const bubbleAbove = tipY - height - 18;
  const by = bubbleAbove >= PLOT.top ? bubbleAbove : Math.min(tipY + 18, PLOT.bottom - height);
  const bubble: Rect = { x: bx, y: by, width, height };

  // Value labels on the points already passed, except under the tip bubble.
  ctx.font = font(series, 26, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const li of labels) {
    if (li > index) continue;
    const px = x(li);
    const py = y(points[li].value);
    const above = py - 22 > PLOT.top + 10;
    const text = series.formatValue(points[li].value);
    const textWidth = ctx.measureText(text).width;
    const box: Rect = { x: px - textWidth / 2 - 8, y: above ? py - 50 : py - 12, width: textWidth + 16, height: 62 };
    if (rectsOverlap(box, bubble)) continue;
    ctx.fillStyle = colors.tone;
    ctx.strokeStyle = colors.background;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = colors.background;
    ctx.strokeText(text, px, above ? py - 22 : py + 44);
    ctx.fillStyle = colors.foreground;
    ctx.fillText(text, px, above ? py - 22 : py + 44);
  }

  // Tip: a dot and a bubble with the latest value reached and its date.
  ctx.fillStyle = colors.tone;
  ctx.strokeStyle = colors.background;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  roundedRect(ctx, bx, by, width, height, 14);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.strokeStyle = colors.tone;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = colors.foreground;
  ctx.font = font(series, 34, 800);
  ctx.fillText(value, bx + 20, by + 44);
  ctx.fillStyle = colors.muted;
  ctx.font = font(series, 22);
  ctx.fillText(date, bx + 20, by + 76);

  // Footer.
  ctx.font = font(series, 24);
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "left";
  ctx.fillText(`Fuente: ${series.source}`, 96, HEIGHT - 44);
  ctx.textAlign = "right";
  ctx.fillText(series.site, WIDTH - 96, HEIGHT - 44);
}

/**
 * Records the animation in real time (about ten seconds) and returns the file.
 * Browsers slow down hidden tabs, so the tab should stay visible meanwhile.
 */
export async function recordSeriesVideo(
  series: VideoSeries,
  onProgress: (share: number) => void,
): Promise<{ blob: Blob; extension: string }> {
  const type = supportedVideoType();
  if (!type) throw new Error("This browser cannot record canvas video");
  if (series.points.length < 2) throw new Error("A video needs at least two points");

  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const frame = prepare(series);
  drawFrame(ctx, series, frame, 0);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start(1000);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      // Redrawn every frame, also while holding, so the recorder keeps receiving frames.
      drawFrame(ctx, series, frame, Math.min(elapsed / DRAW_MS, 1));
      onProgress(Math.min(elapsed / (DRAW_MS + HOLD_MS), 1));
      if (elapsed >= DRAW_MS + HOLD_MS) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  return { blob: new Blob(chunks, { type: type.mimeType.split(";")[0] }), extension: type.extension };
}

/** Saves a blob through a temporary link. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

"use client";

import { Video } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { downloadBlob, recordSeriesVideo, supportedVideoType, type VideoSeries } from "./series-video";

type VideoExportButtonProps = {
  /** Builds the series at click time, so it reflects the chart's current options. */
  getSeries: () => VideoSeries;
  fileName: (extension: string) => string;
};

const noSubscription = () => () => {};

type State = { kind: "idle" } | { kind: "recording"; share: number } | { kind: "error" };

export function VideoExportButton({ getSeries, fileName }: VideoExportButtonProps) {
  // Known only in the browser; the server renders no button.
  const supported = useSyncExternalStore(noSubscription, () => supportedVideoType() !== null, () => false);
  const [state, setState] = useState<State>({ kind: "idle" });
  if (!supported) return null;

  const recording = state.kind === "recording";

  const exportVideo = async () => {
    setState({ kind: "recording", share: 0 });
    try {
      const { blob, extension } = await recordSeriesVideo(getSeries(), (share) => setState({ kind: "recording", share }));
      downloadBlob(blob, fileName(extension));
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error" });
    }
  };

  return (
    <span className="flex items-center gap-2">
      {state.kind === "error" ? <span role="alert">No se pudo generar el video.</span> : null}
      <button
        type="button"
        onClick={exportVideo}
        disabled={recording}
        title={recording ? "Mantené esta pestaña visible mientras se graba." : "Descarga un video de 10 segundos con el recorrido de la serie."}
        className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 ring-1 ring-foreground/15 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-progress disabled:opacity-80"
      >
        <Video aria-hidden className="size-3.5" />
        <span aria-live="polite">{recording ? `Grabando ${Math.round(state.share * 100)} %` : "Exportar video"}</span>
      </button>
    </span>
  );
}

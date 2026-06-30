export type ThresholdState = "neutral" | "warning" | "high_warning" | "exceeded";

interface ThresholdTokenColors {
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
}

/** Red only when limit exceeded; orange when very close (90%+). */
export function getThresholdStrokeColor(
  state: ThresholdState,
  token: ThresholdTokenColors
): string {
  if (state === "exceeded") return token.colorError;
  if (state === "high_warning") return token.colorWarning;
  return token.colorSuccess;
}

export function getThresholdProgressStatus(
  state: ThresholdState
): "exception" | undefined {
  return state === "exceeded" ? "exception" : undefined;
}

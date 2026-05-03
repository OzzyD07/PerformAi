// Shared types for the live rehearsal analysis pipeline.
// Keep this file lightweight and free of React / worklet dependencies
// so it can be imported from both JS and worklet contexts.

export type LandmarkXY = { x: number; y: number };

export type LandmarkFull = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export interface PoseSignals {
  available: boolean;
  score: number;
  personCentered: boolean;
  upperBodyVisible: boolean;
  /**
   * Conservative, normalised posture proxy in [0, 1].
   * null when we don't have enough information to estimate.
   */
  postureScore: number | null;
}

export interface FaceSignals {
  available: boolean;
  score: number;
  faceVisible: boolean;
  faceCentered: boolean;
  /** 0..1; null when we cannot measure reliably. */
  smileIntensity: number | null;
  /** 0..1 (0 = head straight, 1 = heavily tilted). */
  headTilt: number | null;
  /** 0..1; rough proxy combining smile + tilt. */
  expressionIntensity: number | null;
}

export interface BodyLanguageSignals {
  available: boolean;
  topIndex: number | null;
  topConfidence: number | null;
  outputLength: number | null;
  /** Human readable reason when not available (for debug). */
  reasonUnavailable?: string;
}

export interface FrameAnalysisResult {
  timestamp: number;
  pose: PoseSignals;
  face: FaceSignals;
  bodyLanguage: BodyLanguageSignals;
}

export type FeedbackSeverity = 'info' | 'warn' | 'tip' | 'positive';

export interface FeedbackEvent {
  timestamp: number;
  /** Stable internal id used for dedupe / cooldown tracking. */
  code: string;
  message: string;
  severity: FeedbackSeverity;
}

export interface SessionSummary {
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  totalProcessedFrames: number;
  trackingLostCount: number;
  feedbackEvents: FeedbackEvent[];
  postureWarnings: number;
  faceVisibilityWarnings: number;
  bodyLanguageAvailable: boolean;
  bodyLanguageDebugStats: {
    attempts: number;
    successes: number;
    lastTopIndex: number | null;
    lastTopConfidence: number | null;
    lastReasonUnavailable: string | null;
  };
  assumptions: string[];
}

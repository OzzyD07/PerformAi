import type { FeedbackEvent, FrameAnalysisResult, SessionSummary } from './types';
import { FEEDBACK_CODES } from './feedbackRules';

/**
 * Small mutable handle used by `live-rehearsal.tsx` to accumulate session
 * state without storing large landmark arrays. The actual summary is built
 * lazily when the session ends (`build()`), so nothing heavy is done in
 * the hot path.
 */
export interface SessionRecorder {
  onFrameProcessed: (r: FrameAnalysisResult) => void;
  onFeedback: (e: FeedbackEvent) => void;
  onBodyLanguageAttempt: (args: {
    success: boolean;
    topIndex?: number | null;
    topConfidence?: number | null;
    reasonUnavailable?: string | null;
  }) => void;
  build: (endedAt?: number | null) => SessionSummary;
  reset: () => void;
}

const DEFAULT_ASSUMPTIONS: string[] = [
  'PoseLandmarkDetector.tflite in this project outputs 25 landmarks, not the 33 needed by body_language.tflite. Body-language inference is therefore skipped unless a 33-point MediaPipe-Holistic-compatible pose model is provided.',
  'body_language.tflite label mapping is PROVISIONAL. The UI must not claim a specific emotion/posture class until verified against the original training pickle.',
  'Face landmark "visibility" is not emitted by FaceLandmarkDetector.tflite. When a body_language input vector is built later, visibility falls back to 1.0 by design.',
  'No audio / Whisper / diction analysis is performed in this build (Stage 12).',
];

export function createSessionRecorder(startedAt: number = Date.now()): SessionRecorder {
  let totalProcessedFrames = 0;
  let trackingLostCount = 0;
  let postureWarnings = 0;
  let faceVisibilityWarnings = 0;
  let feedbackEvents: FeedbackEvent[] = [];

  let bodyLanguageAttempts = 0;
  let bodyLanguageSuccesses = 0;
  let lastTopIndex: number | null = null;
  let lastTopConfidence: number | null = null;
  let lastReasonUnavailable: string | null = null;

  let wasTracked = true;

  return {
    onFrameProcessed(r) {
      totalProcessedFrames++;
      const tracked = r.pose.available || r.face.available;
      if (!tracked && wasTracked) {
        // Rising edge: track -> lost.
        trackingLostCount++;
      }
      wasTracked = tracked;
    },
    onFeedback(e) {
      feedbackEvents.push(e);
      switch (e.code) {
        case FEEDBACK_CODES.PERSON_NOT_VISIBLE:
        case FEEDBACK_CODES.UPPER_BODY_NOT_VISIBLE:
        case FEEDBACK_CODES.HEAD_TILTED:
          postureWarnings++;
          break;
        case FEEDBACK_CODES.FACE_NOT_VISIBLE:
        case FEEDBACK_CODES.FACE_NOT_CENTERED:
          faceVisibilityWarnings++;
          break;
        default:
          break;
      }
    },
    onBodyLanguageAttempt({ success, topIndex, topConfidence, reasonUnavailable }) {
      bodyLanguageAttempts++;
      if (success) {
        bodyLanguageSuccesses++;
        lastTopIndex = topIndex ?? null;
        lastTopConfidence = topConfidence ?? null;
      } else {
        lastReasonUnavailable = reasonUnavailable ?? null;
      }
    },
    build(endedAt = Date.now()) {
      const effectiveEndedAt = endedAt ?? Date.now();
      return {
        startedAt,
        endedAt: effectiveEndedAt,
        durationMs: Math.max(0, effectiveEndedAt - startedAt),
        totalProcessedFrames,
        trackingLostCount,
        feedbackEvents: [...feedbackEvents],
        postureWarnings,
        faceVisibilityWarnings,
        bodyLanguageAvailable: bodyLanguageSuccesses > 0,
        bodyLanguageDebugStats: {
          attempts: bodyLanguageAttempts,
          successes: bodyLanguageSuccesses,
          lastTopIndex,
          lastTopConfidence,
          lastReasonUnavailable,
        },
        assumptions: [...DEFAULT_ASSUMPTIONS],
      };
    },
    reset() {
      totalProcessedFrames = 0;
      trackingLostCount = 0;
      postureWarnings = 0;
      faceVisibilityWarnings = 0;
      feedbackEvents = [];
      bodyLanguageAttempts = 0;
      bodyLanguageSuccesses = 0;
      lastTopIndex = null;
      lastTopConfidence = null;
      lastReasonUnavailable = null;
      wasTracked = true;
    },
  };
}

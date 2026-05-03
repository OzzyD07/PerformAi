import type {
  FeedbackEvent,
  FeedbackSeverity,
  FrameAnalysisResult,
} from './types';

/**
 * Feedback codes. Keep them stable - they are used for cooldown / dedupe
 * and end up in the session summary.
 */
export const FEEDBACK_CODES = {
  PERSON_NOT_VISIBLE: 'person_not_visible',
  UPPER_BODY_NOT_VISIBLE: 'upper_body_not_visible',
  FACE_NOT_VISIBLE: 'face_not_visible',
  FACE_NOT_CENTERED: 'face_not_centered',
  HEAD_TILTED: 'head_tilted',
  EXPRESSION_TOO_NEUTRAL: 'expression_too_neutral',
  POSITIVE_POSTURE: 'positive_posture',
} as const;

export type FeedbackCode = typeof FEEDBACK_CODES[keyof typeof FEEDBACK_CODES];

/**
 * User-facing Turkish messages (with a short English hint in parens, to
 * match the existing tone used in live-rehearsal.tsx).
 */
const MESSAGES: Record<FeedbackCode, string> = {
  person_not_visible: 'Kameraya tam girin. Vücudunuz görünmüyor. (Step into the frame)',
  upper_body_not_visible: 'Biraz geri çekilin, üst vücudunuz tam görünsün. (Step back slightly)',
  face_not_visible: 'Yüzünüz görünmüyor. Kameraya bakın. (Face not visible)',
  face_not_centered: 'Yüzünüzü kameranın ortasına alın. (Center your face)',
  head_tilted: 'Başınızı dik tutmaya çalışın. (Keep your head straight)',
  expression_too_neutral: 'İfadeniz çok nötr. Duyguyu biraz daha belirginleştirin. (Make the emotion clearer)',
  positive_posture: 'Harika duruş. Bu hizalamayı koruyun. (Great posture, keep it up)',
};

const SEVERITY: Record<FeedbackCode, FeedbackSeverity> = {
  person_not_visible: 'warn',
  upper_body_not_visible: 'tip',
  face_not_visible: 'warn',
  face_not_centered: 'tip',
  head_tilted: 'tip',
  expression_too_neutral: 'tip',
  positive_posture: 'positive',
};

/* -------------------------------------------------------------------------- */
/* Rolling analysis buffer                                                    */
/* -------------------------------------------------------------------------- */

export interface AnalysisBuffer {
  push: (r: FrameAnalysisResult) => void;
  clear: () => void;
  aggregate: (now: number) => AggregatedSignals;
  size: () => number;
}

export interface AggregatedSignals {
  sampleCount: number;
  /** Fraction of recent samples where pose score > 0.4. */
  poseVisibleRatio: number;
  faceVisibleRatio: number;
  upperBodyVisibleRatio: number;
  personCenteredRatio: number;
  faceCenteredRatio: number;
  avgPostureScore: number | null;
  avgSmileIntensity: number | null;
  avgHeadTilt: number | null;
  avgExpressionIntensity: number | null;
  /** True when neither pose nor face has been seen for the whole window. */
  trackingLost: boolean;
}

export function createAnalysisBuffer(windowMs = 2500, maxSize = 60): AnalysisBuffer {
  const items: FrameAnalysisResult[] = [];

  const prune = (now: number) => {
    while (items.length > 0 && now - items[0].timestamp > windowMs) {
      items.shift();
    }
    while (items.length > maxSize) items.shift();
  };

  return {
    push(r) {
      items.push(r);
      prune(r.timestamp);
    },
    clear() {
      items.length = 0;
    },
    size() {
      return items.length;
    },
    aggregate(now) {
      prune(now);
      const n = items.length;
      if (n === 0) {
        return {
          sampleCount: 0,
          poseVisibleRatio: 0,
          faceVisibleRatio: 0,
          upperBodyVisibleRatio: 0,
          personCenteredRatio: 0,
          faceCenteredRatio: 0,
          avgPostureScore: null,
          avgSmileIntensity: null,
          avgHeadTilt: null,
          avgExpressionIntensity: null,
          trackingLost: true,
        };
      }

      let poseVis = 0,
        faceVis = 0,
        upperVis = 0,
        personCentered = 0,
        faceCentered = 0;
      let postureSum = 0,
        postureCount = 0;
      let smileSum = 0,
        smileCount = 0;
      let tiltSum = 0,
        tiltCount = 0;
      let exprSum = 0,
        exprCount = 0;
      let anyTracked = 0;

      for (const r of items) {
        if (r.pose.available) poseVis++;
        if (r.face.available) faceVis++;
        if (r.pose.upperBodyVisible) upperVis++;
        if (r.pose.personCentered) personCentered++;
        if (r.face.faceCentered) faceCentered++;
        if (r.pose.available || r.face.available) anyTracked++;

        if (r.pose.postureScore != null) {
          postureSum += r.pose.postureScore;
          postureCount++;
        }
        if (r.face.smileIntensity != null) {
          smileSum += r.face.smileIntensity;
          smileCount++;
        }
        if (r.face.headTilt != null) {
          tiltSum += r.face.headTilt;
          tiltCount++;
        }
        if (r.face.expressionIntensity != null) {
          exprSum += r.face.expressionIntensity;
          exprCount++;
        }
      }

      return {
        sampleCount: n,
        poseVisibleRatio: poseVis / n,
        faceVisibleRatio: faceVis / n,
        upperBodyVisibleRatio: upperVis / n,
        personCenteredRatio: personCentered / n,
        faceCenteredRatio: faceCentered / n,
        avgPostureScore: postureCount ? postureSum / postureCount : null,
        avgSmileIntensity: smileCount ? smileSum / smileCount : null,
        avgHeadTilt: tiltCount ? tiltSum / tiltCount : null,
        avgExpressionIntensity: exprCount ? exprSum / exprCount : null,
        trackingLost: anyTracked / n < 0.25,
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Rule engine                                                                */
/* -------------------------------------------------------------------------- */

interface GenerateFeedbackOptions {
  now: number;
  lastEvent: FeedbackEvent | null;
  /** Milliseconds required between two feedback events overall. */
  cooldownMs?: number;
  /** Milliseconds required before showing the same code again. */
  repeatCooldownMs?: number;
}

function buildEvent(code: FeedbackCode, now: number): FeedbackEvent {
  return {
    timestamp: now,
    code,
    message: MESSAGES[code],
    severity: SEVERITY[code],
  };
}

/**
 * Decide whether `candidate` should be emitted given the last event.
 * Returns the candidate when it passes, otherwise null.
 */
export function shouldShowFeedback(
  candidate: FeedbackEvent,
  lastEvent: FeedbackEvent | null,
  cooldownMs = 3000,
  repeatCooldownMs = 6000,
): FeedbackEvent | null {
  if (!lastEvent) return candidate;
  const delta = candidate.timestamp - lastEvent.timestamp;
  if (delta < cooldownMs) return null;
  if (candidate.code === lastEvent.code && delta < repeatCooldownMs) return null;
  return candidate;
}

/**
 * Priority-based feedback generator. Runs on the aggregated signals coming
 * from the last 2-3 seconds of analysis.
 *
 * Priority:
 *   1. Person / body not visible
 *   2. Face not visible
 *   3. Upper body not fully visible
 *   4. Head tilted
 *   5. Face not centered
 *   6. Expression too neutral
 *   7. Positive reinforcement
 *
 * body_language.tflite output is deliberately NOT consulted here until the
 * class mapping has been verified against the model metadata.
 */
export function generateCoachFeedback(
  agg: AggregatedSignals,
  opts: GenerateFeedbackOptions,
): FeedbackEvent | null {
  const { now, lastEvent, cooldownMs = 3000, repeatCooldownMs = 6000 } = opts;

  // Need at least a few samples to avoid flapping on the very first frames.
  if (agg.sampleCount < 3) return null;

  // 1. Nothing at all detected for the whole window.
  if (agg.trackingLost) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.PERSON_NOT_VISIBLE, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 2. Face missing while pose is present (and vice versa handled below).
  if (agg.faceVisibleRatio < 0.3 && agg.poseVisibleRatio > 0.4) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.FACE_NOT_VISIBLE, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 3. Pose detected but upper body cut off.
  if (agg.poseVisibleRatio > 0.5 && agg.upperBodyVisibleRatio < 0.4) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.UPPER_BODY_NOT_VISIBLE, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 4. Head tilted persistently.
  if (agg.avgHeadTilt != null && agg.avgHeadTilt > 0.35 && agg.faceVisibleRatio > 0.5) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.HEAD_TILTED, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 5. Face consistently off-center.
  if (agg.faceVisibleRatio > 0.5 && agg.faceCenteredRatio < 0.3) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.FACE_NOT_CENTERED, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 6. Expression stuck at "very neutral".
  if (
    agg.faceVisibleRatio > 0.6 &&
    agg.avgExpressionIntensity != null &&
    agg.avgExpressionIntensity < 0.15
  ) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.EXPRESSION_TOO_NEUTRAL, now),
      lastEvent,
      cooldownMs,
      repeatCooldownMs,
    );
  }

  // 7. Positive reinforcement when conditions are good. We throttle this
  // more heavily so it doesn't show constantly.
  const goodPose =
    agg.poseVisibleRatio > 0.7 &&
    agg.upperBodyVisibleRatio > 0.6 &&
    agg.personCenteredRatio > 0.5;
  const goodFace =
    agg.faceVisibleRatio > 0.6 &&
    agg.faceCenteredRatio > 0.5 &&
    (agg.avgHeadTilt == null || agg.avgHeadTilt < 0.2);
  if (goodPose && goodFace) {
    return shouldShowFeedback(
      buildEvent(FEEDBACK_CODES.POSITIVE_POSTURE, now),
      lastEvent,
      cooldownMs,
      /* repeatCooldownMs for positive */ 15000,
    );
  }

  return null;
}

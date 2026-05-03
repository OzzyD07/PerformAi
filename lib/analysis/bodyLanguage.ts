import type { LandmarkFull } from './types';

/**
 * body_language.tflite (from
 *   https://huggingface.co/ThisIs-Developer/Body-Language-Detection-with-MediaPipe-and-OpenCV
 * ) expects a flattened MediaPipe Holistic feature vector:
 *
 *    33 pose landmarks  * (x, y, z, visibility) = 132
 *   468 face landmarks  * (x, y, z, visibility) = 1872
 *   ------------------------------------------------
 *   total                                         = 2004
 *
 * IMPORTANT: The PoseLandmarkDetector.tflite currently shipped in
 *   assets/models/pose/metadata.yaml outputs shape [1, 25, 4], not 33.
 * That means we cannot build a valid 2004 vector with the current models, and
 * we must skip body_language inference instead of feeding zero-padded garbage.
 *
 * This feature layout is therefore PROVISIONAL and will only be used if/when
 * a 33-point MediaPipe-compatible pose model is added to the project.
 */
export const BODY_LANGUAGE_INPUT_SIZE = 2004;
export const BODY_LANGUAGE_EXPECTED_POSE_COUNT = 33;
export const BODY_LANGUAGE_EXPECTED_FACE_COUNT = 468;

export interface PrepareBodyLanguageInputResult {
  input: Float32Array | null;
  reasonUnavailable?: string;
}

/**
 * Build the 2004-float feature vector required by body_language.tflite.
 * Returns { input: null, reasonUnavailable } when the vector cannot be built
 * reliably, so the caller can skip inference without crashing.
 */
export function prepareBodyLanguageInput(
  poseLandmarks: LandmarkFull[] | null | undefined,
  faceLandmarks: LandmarkFull[] | null | undefined,
): PrepareBodyLanguageInputResult {
  if (!poseLandmarks || poseLandmarks.length !== BODY_LANGUAGE_EXPECTED_POSE_COUNT) {
    return {
      input: null,
      reasonUnavailable:
        `Need ${BODY_LANGUAGE_EXPECTED_POSE_COUNT} pose landmarks, got ` +
        `${poseLandmarks?.length ?? 0}. The current PoseLandmarkDetector.tflite ` +
        `outputs 25 points, which is not MediaPipe-Holistic compatible.`,
    };
  }
  if (!faceLandmarks || faceLandmarks.length !== BODY_LANGUAGE_EXPECTED_FACE_COUNT) {
    return {
      input: null,
      reasonUnavailable:
        `Need ${BODY_LANGUAGE_EXPECTED_FACE_COUNT} face landmarks, got ` +
        `${faceLandmarks?.length ?? 0}.`,
    };
  }

  const input = new Float32Array(BODY_LANGUAGE_INPUT_SIZE);
  let offset = 0;

  for (let i = 0; i < poseLandmarks.length; i++) {
    const p = poseLandmarks[i];
    input[offset++] = p.x;
    input[offset++] = p.y;
    input[offset++] = p.z;
    input[offset++] = p.visibility;
  }

  for (let i = 0; i < faceLandmarks.length; i++) {
    const f = faceLandmarks[i];
    input[offset++] = f.x;
    input[offset++] = f.y;
    input[offset++] = f.z;
    // Face landmark model doesn't emit visibility; 1.0 is a documented
    // fallback so the vector length still matches the model input shape.
    input[offset++] = f.visibility ?? 1.0;
  }

  if (offset !== BODY_LANGUAGE_INPUT_SIZE) {
    return {
      input: null,
      reasonUnavailable: `Internal error: filled ${offset} / ${BODY_LANGUAGE_INPUT_SIZE} values.`,
    };
  }

  return { input };
}

export interface BodyLanguageOutput {
  topIndex: number;
  topConfidence: number;
  top3: { index: number; confidence: number }[];
  outputLength: number;
}

/**
 * Parse the probability vector returned by body_language.tflite.
 * We intentionally do NOT assign semantic labels here - the class mapping
 * that comes with the Hugging Face notebook is provisional and depends on
 * how the user trained the pickle. Surface raw indices + confidence so the
 * UI layer can decide what to do.
 */
export function parseBodyLanguageOutput(
  probabilities: Float32Array | number[] | null | undefined,
): BodyLanguageOutput | null {
  if (!probabilities || probabilities.length === 0) return null;

  let topIndex = 0;
  let topConfidence = -Infinity;
  for (let i = 0; i < probabilities.length; i++) {
    const v = probabilities[i];
    if (v > topConfidence) {
      topConfidence = v;
      topIndex = i;
    }
  }

  // Top-3 via simple selection (output is small, usually < 20 classes).
  const indexed: { index: number; confidence: number }[] = [];
  for (let i = 0; i < probabilities.length; i++) {
    indexed.push({ index: i, confidence: probabilities[i] });
  }
  indexed.sort((a, b) => b.confidence - a.confidence);

  return {
    topIndex,
    topConfidence,
    top3: indexed.slice(0, 3),
    outputLength: probabilities.length,
  };
}

/**
 * PROVISIONAL class-index constant kept for backward compatibility with
 * older UI calls. Do NOT rely on this to mean "bad posture". The real label
 * mapping has not been verified against the tflite metadata, so higher
 * layers should treat the top class as opaque data until mapping is
 * confirmed. See docs in parseBodyLanguageOutput above.
 */
export const PROVISIONAL_CLASS_INDEX = 0;

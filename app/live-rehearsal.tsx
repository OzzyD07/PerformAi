import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import Animated, {
  runOnJS as reanimatedRunOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Colors } from '../constants/Colors';
import { Theme } from '../constants/Theme';
import { createAnalysisBuffer, generateCoachFeedback } from '../lib/analysis/feedbackRules';
import { createSessionRecorder } from '../lib/analysis/sessionSummary';
import type { FeedbackEvent, FrameAnalysisResult } from '../lib/analysis/types';

/* -------------------------------------------------------------------------- */
/* Pipeline configuration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Toggle to stream verbose debug info into the JS console. Keep false in
 * production so we don't spam logs from the frame processor.
 */
const DEBUG_PIPELINE = false;

/**
 * body_language.tflite expects 2004 floats = 33 pose * 4 + 468 face * 4
 * (MediaPipe Holistic layout). Our PoseLandmarkDetector only outputs 25
 * landmarks, so we CANNOT build a valid 2004 vector. Set this flag to
 * `true` only if the project switches to a 33-point pose model in the
 * future. See lib/analysis/bodyLanguage.ts for details.
 */
const ENABLE_BODY_LANGUAGE_CLASSIFIER = false;

/** Run the ML pipeline every Nth frame. */
const FRAME_SKIP = 5;

/* -------------------------------------------------------------------------- */

export default function LiveRehearsalScreen() {
  const router = useRouter();
  const device = useCameraDevice('front');

  // UI-only state. We deliberately no longer store raw landmark arrays in
  // React state (they were unused in the render tree and cost a JSON
  // stringify per processed frame).
  const [isPlayerFound, setIsPlayerFound] = useState(true);
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [isPoseModelLoaded, setIsPoseModelLoaded] = useState(false);
  const [isFaceModelLoaded, setIsFaceModelLoaded] = useState(false);

  const lastSeenTime = useRef<number>(Date.now());
  const lastFeedbackRef = useRef<FeedbackEvent | null>(null);

  const bufferRef = useRef(createAnalysisBuffer(2500));
  const sessionRef = useRef(createSessionRecorder(Date.now()));
  const sessionSummaryPrintedRef = useRef(false);

  const coachCardOpacity = useSharedValue(0);
  const coachCardTranslateY = useSharedValue(-50);

  const frameCounter = useSharedValue(0);

  const posePlugin = useTensorflowModel(require('../assets/models/pose/PoseLandmarkDetector.tflite'));
  const facePlugin = useTensorflowModel(require('../assets/models/face/FaceLandmarkDetector.tflite'));
  // NOTE: body_language.tflite is intentionally NOT loaded here. When
  // ENABLE_BODY_LANGUAGE_CLASSIFIER is flipped to true (and a 33-point
  // pose model is in place), re-introduce:
  //   const postureClassifier = useTensorflowModel(
  //     require('../assets/models/pose/body_language.tflite'),
  //   );
  // and call postureClassifier.model.runSync inside the worklet branch.

  const { resize } = useResizePlugin();

  useEffect(() => {
    if (posePlugin.model) setIsPoseModelLoaded(true);
    if (facePlugin.model) setIsFaceModelLoaded(true);
    // postureClassifier is optional: if it never loads, the pipeline keeps
    // running using pose/face heuristics.
  }, [posePlugin.model, facePlugin.model]);

  useEffect(() => {
    (async () => {
      try {
        const cameraPermission = await Camera.requestCameraPermission();
        // The UI copy still mentions microphone access so we keep the
        // permission request, but no audio pipeline is active (Stage 12).
        const microphonePermission = await Camera.requestMicrophonePermission();
        if (DEBUG_PIPELINE) {
          console.log('[perms] camera =', cameraPermission, 'mic =', microphonePermission);
        }
      } catch (error) {
        console.error('[perms] error:', error);
      }
    })();
  }, []);

  /* ----------------------------------------------------------------------- */
  /* Coach card                                                              */
  /* ----------------------------------------------------------------------- */

  const showCoachCard = useCallback(
    (message: string) => {
      setCoachMessage(message);
      coachCardTranslateY.value = -50;
      coachCardOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          1800,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished) {
              reanimatedRunOnJS(setCoachMessage)(null);
            }
          }),
        ),
      );
      coachCardTranslateY.value = withSequence(
        withTiming(0, { duration: 300 }),
        withDelay(1800, withTiming(-50, { duration: 300 })),
      );
    },
    [coachCardOpacity, coachCardTranslateY],
  );

  /* ----------------------------------------------------------------------- */
  /* JS-side callback: receive a compact analysis result from the worklet.  */
  /* ----------------------------------------------------------------------- */

  const onFrameAnalyzed = useCallback((result: FrameAnalysisResult) => {
    bufferRef.current.push(result);
    sessionRef.current.onFrameProcessed(result);

    if (result.bodyLanguage.available || result.bodyLanguage.reasonUnavailable) {
      sessionRef.current.onBodyLanguageAttempt({
        success: result.bodyLanguage.available,
        topIndex: result.bodyLanguage.topIndex,
        topConfidence: result.bodyLanguage.topConfidence,
        reasonUnavailable: result.bodyLanguage.reasonUnavailable ?? null,
      });
    }

    const now = result.timestamp;
    if (result.pose.available || result.face.available) {
      lastSeenTime.current = now;
      setIsPlayerFound((prev) => (prev ? prev : true));
    } else if (now - lastSeenTime.current > 2000) {
      setIsPlayerFound((prev) => (prev ? false : prev));
    }
  }, []);

  const onFrameAnalyzedJS = useRef(Worklets.createRunOnJS(onFrameAnalyzed)).current;

  /* ----------------------------------------------------------------------- */
  /* Feedback tick: every 1.5s, aggregate the buffer and show a coach card  */
  /* if a rule fires. Rule priorities live in lib/analysis/feedbackRules.   */
  /* ----------------------------------------------------------------------- */

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const agg = bufferRef.current.aggregate(now);
      const event = generateCoachFeedback(agg, {
        now,
        lastEvent: lastFeedbackRef.current,
      });
      if (event) {
        lastFeedbackRef.current = event;
        sessionRef.current.onFeedback(event);
        showCoachCard(event.message);
        if (DEBUG_PIPELINE) {
          console.log('[feedback]', event.code, '-', event.severity, '-', JSON.stringify(agg));
        }
      }
    }, 1500);
    return () => clearInterval(id);
  }, [showCoachCard]);

  /* ----------------------------------------------------------------------- */
  /* Session lifecycle                                                       */
  /* ----------------------------------------------------------------------- */

  const finishSession = useCallback(() => {
    if (sessionSummaryPrintedRef.current) return;
    sessionSummaryPrintedRef.current = true;
    const summary = sessionRef.current.build(Date.now());
    // TODO: wire this up to the history/report screen. No persistence yet.
    console.log('[session-summary]', JSON.stringify(summary, null, 2));
  }, []);

  useEffect(() => {
    return () => {
      finishSession();
    };
  }, [finishSession]);

  const handleClose = useCallback(() => {
    finishSession();
    router.back();
  }, [finishSession, router]);

  /* ----------------------------------------------------------------------- */
  /* Frame processor worklet                                                 */
  /* ----------------------------------------------------------------------- */

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      // body_language.tflite is never invoked here (see guards below); only
      // block on the two models we actually consume per frame.
      if (posePlugin.model == null || facePlugin.model == null) {
        return;
      }

      frameCounter.value = (frameCounter.value + 1) % FRAME_SKIP;
      if (frameCounter.value !== 0) return;

      try {
        /* ---------- Pose ------------------------------------------------- */
        const poseResized = resize(frame, {
          scale: { width: 256, height: 256 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const poseOutputs = posePlugin.model.runSync([poseResized]);
        const poseScoreArray = poseOutputs[0] as Uint8Array;
        const poseLandmarksRaw = poseOutputs[1] as Uint8Array;

        // Quantisation params documented in assets/models/pose/metadata.yaml.
        const POSE_SCORE_SCALE = 0.00390625;
        const POSE_SCALE = 0.006036719772964716;
        const POSE_ZERO_PT = 74;
        const POSE_POINT_COUNT = 25;
        const POSE_INPUT_SIZE = 256;
        const poseScore = poseScoreArray[0] * POSE_SCORE_SCALE;

        /* ---------- Face ------------------------------------------------- */
        const faceResized = resize(frame, {
          scale: { width: 192, height: 192 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        const faceOutputs = facePlugin.model.runSync([faceResized]);
        const faceScoreArray = faceOutputs[0] as Uint8Array;
        const faceLandmarksRaw = faceOutputs[1] as Uint8Array;

        const FACE_SCORE_SCALE = 0.00390625;
        const FACE_SCALE = 0.004754403606057167;
        const FACE_ZERO_PT = 48;
        const FACE_POINT_COUNT = 468;
        const FACE_INPUT_SIZE = 192;
        const faceScore = faceScoreArray[0] * FACE_SCORE_SCALE;

        /* ---------- Pose signal extraction ------------------------------- */
        let poseAvailable = poseScore > 0.4;
        let upperBodyVisible = false;
        let personCentered = false;
        let postureScore: number | null = null;

        if (poseAvailable) {
          let sumX = 0;
          let sumY = 0;
          let minY = 1;
          let maxY = 0;
          let minX = 1;
          let maxX = 0;
          let validCount = 0;

          for (let i = 0; i < POSE_POINT_COUNT; i++) {
            const xRaw = (poseLandmarksRaw[i * 4] - POSE_ZERO_PT) * POSE_SCALE;
            const yRaw = (poseLandmarksRaw[i * 4 + 1] - POSE_ZERO_PT) * POSE_SCALE;
            const x = xRaw / POSE_INPUT_SIZE;
            const y = yRaw / POSE_INPUT_SIZE;
            if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
              sumX += x;
              sumY += y;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              validCount++;
            }
          }

          if (validCount >= 8) {
            const cx = sumX / validCount;
            personCentered = cx > 0.3 && cx < 0.7;
            const bboxHeight = maxY - minY;
            const bboxWidth = maxX - minX;
            // Upper body considered visible when the head region (small y)
            // and torso (larger y) both fall inside the frame.
            upperBodyVisible = minY < 0.45 && bboxHeight > 0.35;

            // Conservative posture proxy:
            //   1. horizontal symmetry of the cloud around the centroid
            //   2. bbox aspect ratio plausibility
            // Both are NORMALISED heuristics, clearly not a real metric.
            const symmetry = 1 - Math.min(1, Math.abs(cx - 0.5) / 0.5);
            const aspect = bboxWidth > 0 ? Math.min(1, bboxHeight / (bboxWidth * 2 + 0.001)) : 0;
            postureScore = Math.max(0, Math.min(1, 0.6 * symmetry + 0.4 * aspect));
          } else {
            poseAvailable = false;
          }
        }

        /* ---------- Face signal extraction ------------------------------- */
        // We directly index known MediaPipe Face Mesh points (cheek, lip
        // corners, lip centres). The face landmark model output shape is
        // [1, 468, 3] (x, y, z) with shared quantisation params.
        let faceAvailable = faceScore > 0.4;
        let faceCentered = false;
        let smileIntensity: number | null = null;
        let headTilt: number | null = null;
        let expressionIntensity: number | null = null;

        // Inline face landmark read - kept as a straight-line worklet-safe
        // expression per index to avoid relying on nested worklet helper
        // functions (compiler support varies across toolchains).
        if (faceAvailable) {
          const leftCheekX = ((faceLandmarksRaw[234 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const leftCheekY = ((faceLandmarksRaw[234 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const rightCheekX = ((faceLandmarksRaw[454 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const rightCheekY = ((faceLandmarksRaw[454 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const leftMouthX = ((faceLandmarksRaw[61 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const leftMouthY = ((faceLandmarksRaw[61 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const rightMouthX = ((faceLandmarksRaw[291 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const rightMouthY = ((faceLandmarksRaw[291 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const upperLipX = ((faceLandmarksRaw[13 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const upperLipY = ((faceLandmarksRaw[13 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const lowerLipX = ((faceLandmarksRaw[14 * 3] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;
          const lowerLipY = ((faceLandmarksRaw[14 * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE) / FACE_INPUT_SIZE;

          const leftCheek = { x: leftCheekX, y: leftCheekY };
          const rightCheek = { x: rightCheekX, y: rightCheekY };
          const leftMouth = { x: leftMouthX, y: leftMouthY };
          const rightMouth = { x: rightMouthX, y: rightMouthY };
          const upperLip = { x: upperLipX, y: upperLipY };
          const lowerLip = { x: lowerLipX, y: lowerLipY };

          const cheeksValid =
            leftCheek.x > 0 && leftCheek.x < 1 && leftCheek.y > 0 && leftCheek.y < 1 &&
            rightCheek.x > 0 && rightCheek.x < 1 && rightCheek.y > 0 && rightCheek.y < 1;

          const mouthValid =
            leftMouth.x > 0 && leftMouth.x < 1 && leftMouth.y > 0 && leftMouth.y < 1 &&
            rightMouth.x > 0 && rightMouth.x < 1 && rightMouth.y > 0 && rightMouth.y < 1 &&
            upperLip.x > 0 && upperLip.x < 1 && upperLip.y > 0 && upperLip.y < 1 &&
            lowerLip.x > 0 && lowerLip.x < 1 && lowerLip.y > 0 && lowerLip.y < 1;

          if (cheeksValid) {
            const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
            const tilt = faceWidth > 0.01 ? Math.abs(leftCheek.y - rightCheek.y) / faceWidth : 0;
            headTilt = Math.max(0, Math.min(1, tilt));
            const cx = (leftCheek.x + rightCheek.x) / 2;
            faceCentered = cx > 0.3 && cx < 0.7;
          } else {
            faceAvailable = false;
          }

          if (faceAvailable && mouthValid) {
            const mouthWidth = Math.abs(leftMouth.x - rightMouth.x);
            const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
            const ratio = mouthWidth / (mouthHeight + 0.001);
            // ratio ~ 2.0-3.0 at neutral, >= 3.5 on a smile.
            smileIntensity = Math.max(0, Math.min(1, (ratio - 2.0) / 2.5));
          }

          if (faceAvailable) {
            const smileTerm = smileIntensity ?? 0;
            const tiltTerm = headTilt ?? 0;
            // Very rough proxy: combines how much the mouth deviates from
            // the neutral ratio with how much the head is tilted. This is
            // NOT an emotion estimate.
            expressionIntensity = Math.max(0, Math.min(1, 0.7 * smileTerm + 0.3 * tiltTerm));
          }
        }

        /* ---------- body_language.tflite (skipped unless enabled) ------- */
        let bodyLanguageAvailable = false;
        let bodyLanguageTopIndex: number | null = null;
        let bodyLanguageTopConfidence: number | null = null;
        let bodyLanguageOutputLength: number | null = null;
        let bodyLanguageReason: string | undefined =
          'Disabled: PoseLandmarkDetector.tflite outputs 25 landmarks; body_language.tflite needs 33 (MediaPipe Holistic). See lib/analysis/bodyLanguage.ts.';

        if (ENABLE_BODY_LANGUAGE_CLASSIFIER && poseAvailable && faceAvailable) {
          // This branch is intentionally unreachable under the current
          // model set. The code below is kept as a reference for when a
          // 33-point MediaPipe pose model is added. When that happens, we
          // must also move landmark parsing to produce 33 pose points with
          // (x, y, z, visibility) and 468 face points (x, y, z, 1.0).
          bodyLanguageReason = 'Not yet wired up for 33-point pose model.';
        }

        /* ---------- Emit compact result to JS --------------------------- */
        const result: FrameAnalysisResult = {
          timestamp: Date.now(),
          pose: {
            available: poseAvailable,
            score: poseScore,
            personCentered,
            upperBodyVisible,
            postureScore,
          },
          face: {
            available: faceAvailable,
            score: faceScore,
            faceVisible: faceAvailable,
            faceCentered,
            smileIntensity,
            headTilt,
            expressionIntensity,
          },
          bodyLanguage: {
            available: bodyLanguageAvailable,
            topIndex: bodyLanguageTopIndex,
            topConfidence: bodyLanguageTopConfidence,
            outputLength: bodyLanguageOutputLength,
            reasonUnavailable: bodyLanguageAvailable ? undefined : bodyLanguageReason,
          },
        };

        onFrameAnalyzedJS(result);
      } catch (_e) {
        // Worklet errors are intentionally swallowed to avoid crashing the
        // camera pipeline. Enable DEBUG_PIPELINE to surface them in JS.
      }
    },
    [posePlugin.model, facePlugin.model],
  );

  const coachCardStyle = useAnimatedStyle(() => {
    return {
      opacity: coachCardOpacity.value,
      transform: [{ translateY: coachCardTranslateY.value }],
    };
  });

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>No front camera found.</Text>
        <TouchableOpacity
          style={{ marginTop: 20, padding: 12, backgroundColor: Colors.primary, borderRadius: 8 }}
          onPress={handleClose}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Pose and face models are required for the pipeline. body_language.tflite
  // is OPTIONAL - even if it's missing or still loading, we enter the screen
  // and fall back to pose/face heuristics. This matches Stage 13 (graceful
  // degradation) of the pipeline spec.
  if (!isPoseModelLoaded || !isFaceModelLoaded) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>Loading AI Models...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Live Rehearsal</Text>
        <View style={{ width: 40 }} />
      </View>

      {coachMessage && (
        <Animated.View style={[styles.coachCardContainer, coachCardStyle]}>
          <BlurView intensity={60} tint="dark" style={styles.coachCard}>
            <Ionicons name="bulb" size={24} color={Colors.secondary} />
            <Text style={styles.coachCardText}>{coachMessage}</Text>
          </BlurView>
        </Animated.View>
      )}

      {!isPlayerFound && (
        <View style={styles.warningOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.warningCard}>
            <Ionicons name="warning" size={32} color={Colors.error} />
            <Text style={styles.warningText}>Player not found</Text>
            <Text style={styles.warningSubtext}>Please step into the frame</Text>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    ...Theme.typography.h3,
    color: Colors.text,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Theme.typography.h3,
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  warningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  warningCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  warningText: {
    ...Theme.typography.h2,
    color: '#FFF',
    marginTop: 12,
  },
  warningSubtext: {
    ...Theme.typography.body2,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  coachCardContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 20,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 12,
  },
  coachCardText: {
    ...Theme.typography.h3,
    color: '#FFF',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useSharedValue, withTiming, useAnimatedStyle, withSequence, withDelay, runOnJS as reanimatedRunOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { Worklets } from 'react-native-worklets-core';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';
import { Theme } from '../constants/Theme';

const { width, height } = Dimensions.get('window');

// Skeleton connections (basic representation for 25 landmarks)
// Assuming standard MediaPipe-like connections

export default function LiveRehearsalScreen() {
  const router = useRouter();
  const device = useCameraDevice('front');
  
  const [poseLandmarks, setPoseLandmarks] = useState<any[]>([]);
  const [faceLandmarks, setFaceLandmarks] = useState<any[]>([]);
  const [isPlayerFound, setIsPlayerFound] = useState(true);
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [isPoseModelLoaded, setIsPoseModelLoaded] = useState(false);
  const [isFaceModelLoaded, setIsFaceModelLoaded] = useState(false);
  const [lastFeedbackTime, setLastFeedbackTime] = useState<number>(0);
  
  const coachCardOpacity = useSharedValue(0);
  const coachCardTranslateY = useSharedValue(-50);

  // Load TFLite Models
  const posePlugin = useTensorflowModel(require('../assets/models/pose/PoseLandmarkDetector.tflite'));
  const facePlugin = useTensorflowModel(require('../assets/models/face/FaceLandmarkDetector.tflite'));
  const { resize } = useResizePlugin();

  useEffect(() => {
    if (posePlugin.model) setIsPoseModelLoaded(true);
    if (facePlugin.model) setIsFaceModelLoaded(true);
  }, [posePlugin.model, facePlugin.model]);

  useEffect(() => {
    (async () => {
      try {
        const cameraPermission = await Camera.requestCameraPermission();
        const microphonePermission = await Camera.requestMicrophonePermission();
        
        console.log('Camera Permission Status:', cameraPermission);
        console.log('Microphone Permission Status:', microphonePermission);

        if (cameraPermission !== 'granted') {
          console.log('Camera permission denied');
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    })();
  }, []);

  const showCoachCard = (message: string) => {
    const now = Date.now();
    // Cooldown of 3 seconds to prevent spamming
    if (now - lastFeedbackTime < 3000) return;
    if (coachMessage === message) return;
    
    setCoachMessage(message);
    setLastFeedbackTime(now);
    coachCardTranslateY.value = -50;
    
    coachCardOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(1500, withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          reanimatedRunOnJS(setCoachMessage)(null);
        }
      }))
    );
    
    coachCardTranslateY.value = withSequence(
      withTiming(0, { duration: 300 }),
      withDelay(1500, withTiming(-50, { duration: 300 }))
    );
  };

  const analyzePosture = (poseLandmarks: any[], faceLandmarks: any[]) => {
    // --- 1. POSE ANALYSIS (Slouch Detection) ---
    if (poseLandmarks.length > 0) {
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const leftHip = poseLandmarks[23];
      const rightHip = poseLandmarks[24];
      const nose = poseLandmarks[0];
      
      if (leftShoulder && rightShoulder) {
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const shoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        
        let isSlouching = false;
        let slouchReason = "";

        // Check if hips are visible (Y coordinate < 1.0 means it's inside the frame)
        const areHipsVisible = leftHip && rightHip && leftHip.y < 1.0 && rightHip.y < 1.0;

        if (areHipsVisible) {
          // FULL BODY: Compare torso height to shoulder width
          const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          const avgHipY = (leftHip.y + rightHip.y) / 2;
          const torsoHeight = Math.abs(avgHipY - avgShoulderY);
          
          console.log(`[POSE] Full Body - Torso Height: ${torsoHeight.toFixed(3)}, Shoulder Width: ${shoulderWidth.toFixed(3)}`);
          
          if (torsoHeight < shoulderWidth * 0.8) {
            isSlouching = true;
            slouchReason = "Torso compressed (leaning forward)";
          }
        } else if (nose) {
          // HALF BODY: Compare nose-to-shoulder distance to shoulder width
          const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          const neckHeight = Math.abs(avgShoulderY - nose.y);
          
          console.log(`[POSE] Half Body - Neck Height: ${neckHeight.toFixed(3)}, Shoulder Width: ${shoulderWidth.toFixed(3)}`);
          
          // If neck height is too small relative to shoulder width, head is drooping
          if (neckHeight < shoulderWidth * 0.4) {
            isSlouching = true;
            slouchReason = "Head drooping (neck compressed)";
          }
        }

        // Also check if shoulders are heavily tilted (one much higher than the other)
        if (shoulderYDiff > shoulderWidth * 0.3) {
          isSlouching = true;
          slouchReason = "Shoulders uneven";
        }

        if (isSlouching) {
          console.log(`[FEEDBACK] Triggering 'Dik Dur!' Reason: ${slouchReason}`);
          showCoachCard("Dik Dur! (Stand Straight)");
          return; // Only show one message at a time
        }
      }
    }

    // --- 2. FACE ANALYSIS (Smile & Tilt Detection) ---
    if (faceLandmarks.length > 0) {
      // MediaPipe Face Mesh points:
      // 61: Left mouth corner, 291: Right mouth corner
      // 13: Upper lip inner, 14: Lower lip inner
      // 152: Chin, 10: Top of head
      const leftMouth = faceLandmarks[61];
      const rightMouth = faceLandmarks[291];
      const upperLip = faceLandmarks[13];
      const lowerLip = faceLandmarks[14];
      const leftCheek = faceLandmarks[234];
      const rightCheek = faceLandmarks[454];
      
      // Check Head Tilt
      if (leftCheek && rightCheek) {
        const headTilt = Math.abs(leftCheek.y - rightCheek.y);
        const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
        
        console.log(`[FACE] Head Tilt: ${headTilt.toFixed(3)}, Face Width: ${faceWidth.toFixed(3)}`);
        
        if (headTilt > faceWidth * 0.2) {
          console.log(`[FEEDBACK] Triggering 'Kafanı Dik Tut!'`);
          showCoachCard("Kafanı Dik Tut! (Keep Head Straight)");
          return;
        }
      }

      // Check Smile
      if (leftMouth && rightMouth && upperLip && lowerLip) {
        // Ensure points are within frame bounds (0-1) to avoid false readings when face is partially off-screen
        const isMouthInFrame = [leftMouth, rightMouth, upperLip, lowerLip].every(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
        
        if (isMouthInFrame) {
          const mouthWidth = Math.abs(leftMouth.x - rightMouth.x);
          const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
          
          const smileRatio = mouthWidth / (mouthHeight + 0.001); // avoid division by zero
          
          console.log(`[FACE] Mouth Width: ${mouthWidth.toFixed(3)}, Height: ${mouthHeight.toFixed(3)}, Smile Ratio: ${smileRatio.toFixed(2)}`);
          
          // Adjusted threshold based on typical neutral face ratios
          // A neutral mouth usually has a ratio around 2.0 - 3.0. A smile stretches it wider (3.5+).
          if (smileRatio < 2.2) {
            console.log(`[FEEDBACK] Triggering 'Gülümse!' (Ratio: ${smileRatio.toFixed(2)})`);
            showCoachCard("Gülümse! (Smile!)");
          }
        }
      }
    }
  };

  const updateLandmarks = (poseString: string, faceString: string, poseScore: number, faceScore: number) => {
    let currentPose = [];
    let currentFace = [];

    if (poseScore > 0.5) {
      try {
        currentPose = JSON.parse(poseString);
        setPoseLandmarks(currentPose);
      } catch (e) {}
    } else {
      setPoseLandmarks([]);
    }

    if (faceScore > 0.5) {
      try {
        currentFace = JSON.parse(faceString);
        setFaceLandmarks(currentFace);
      } catch (e) {}
    } else {
      setFaceLandmarks([]);
    }

    // Player is found if FACE is detected, or if POSE is detected with high confidence
    // This makes it less strict: if the user is close to the camera (only face visible), it won't say "Player not found"
    if (faceScore > 0.6 || poseScore > 0.6) {
      setIsPlayerFound(true);
    } else {
      setIsPlayerFound(false);
    }

    if (currentPose.length > 0 || currentFace.length > 0) {
      analyzePosture(currentPose, currentFace);
    }
  };

  const updateLandmarksJS = Worklets.createRunOnJS(updateLandmarks);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (posePlugin.model == null || facePlugin.model == null) return;

    try {
      // --- 1. POSE DETECTION ---
      const poseResized = resize(frame, {
        scale: { width: 256, height: 256 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const poseOutputs = posePlugin.model.runSync([poseResized]);
      const poseScoreArray = poseOutputs[0] as Uint8Array;
      const poseLandmarksArray = poseOutputs[1] as Uint8Array;
      
      const poseScore = poseScoreArray[0] * 0.00390625;
      const parsedPoseLandmarks = [];
      
      if (poseScore > 0.5) {
        const scale = 0.006036719772964716;
        const zeroPoint = 74;
        for (let i = 0; i < 25; i++) {
          const xIndex = i * 4;
          const yIndex = i * 4 + 1;
          const xRaw = (poseLandmarksArray[xIndex] - zeroPoint) * scale;
          const yRaw = (poseLandmarksArray[yIndex] - zeroPoint) * scale;
          parsedPoseLandmarks.push({ x: xRaw / 256, y: yRaw / 256 });
        }
      }

      // --- 2. FACE DETECTION ---
      // FaceLandmarkDetector expects 192x192 input
      const faceResized = resize(frame, {
        scale: { width: 192, height: 192 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const faceOutputs = facePlugin.model.runSync([faceResized]);
      const faceScoreArray = faceOutputs[0] as Uint8Array;
      const faceLandmarksArray = faceOutputs[1] as Uint8Array;

      // Metadata says face score scale is 0.00390625
      const faceScore = faceScoreArray[0] * 0.00390625;
      const parsedFaceLandmarks = [];

      if (faceScore > 0.5) {
        // Metadata says face landmarks scale: 0.004754403606057167, zero_point: 48
        const faceScale = 0.004754403606057167;
        const faceZeroPoint = 48;
        // Face model outputs 468 points, each with 3 coordinates (x, y, z)
        for (let i = 0; i < 468; i++) {
          const xIndex = i * 3;
          const yIndex = i * 3 + 1;
          const xRaw = (faceLandmarksArray[xIndex] - faceZeroPoint) * faceScale;
          const yRaw = (faceLandmarksArray[yIndex] - faceZeroPoint) * faceScale;
          parsedFaceLandmarks.push({ x: xRaw / 192, y: yRaw / 192 });
        }
      }

      // Send both to JS thread
      updateLandmarksJS(
        JSON.stringify(parsedPoseLandmarks), 
        JSON.stringify(parsedFaceLandmarks), 
        poseScore, 
        faceScore
      );
    } catch (e) {
      // Silently fail in worklet
    }
  }, [posePlugin.model, facePlugin.model]);

  const coachCardStyle = useAnimatedStyle(() => {
    return {
      opacity: coachCardOpacity.value,
      transform: [{ translateY: coachCardTranslateY.value }],
    };
  });

  // Removed permission check UI
  // if (hasPermission === false) { ... }
  // if (hasPermission === null) { ... }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>No front camera found.</Text>
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 12, backgroundColor: Colors.primary, borderRadius: 8 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Live Rehearsal</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Coach Card */}
      {coachMessage && (
        <Animated.View style={[styles.coachCardContainer, coachCardStyle]}>
          <BlurView intensity={60} tint="dark" style={styles.coachCard}>
            <Ionicons name="bulb" size={24} color={Colors.secondary} />
            <Text style={styles.coachCardText}>{coachMessage}</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* Framing Control Warning */}
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

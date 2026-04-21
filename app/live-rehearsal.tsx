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
  const [isPostureModelLoaded, setIsPostureModelLoaded] = useState(false);
  const [lastFeedbackTime, setLastFeedbackTime] = useState<number>(0);
  
  const coachCardOpacity = useSharedValue(0);
  const coachCardTranslateY = useSharedValue(-50);

  // Frame skipper counter — her 5 frame'de 1 kez pipeline çalıştırır
  const frameCounter = useSharedValue(0);

  // TFLite modelleri
  const posePlugin = useTensorflowModel(require('../assets/models/pose/PoseLandmarkDetector.tflite'));
  const facePlugin = useTensorflowModel(require('../assets/models/face/FaceLandmarkDetector.tflite'));
  // 2. aşama: Vücut dili / duruş sınıflandırıcı (input shape: float32[-1, 2004])
  const postureClassifier = useTensorflowModel(require('../assets/models/pose/body_language.tflite'));
  const { resize } = useResizePlugin();

  useEffect(() => {
    if (posePlugin.model) setIsPoseModelLoaded(true);
    if (facePlugin.model) setIsFaceModelLoaded(true);
    if (postureClassifier.model) setIsPostureModelLoaded(true);
  }, [posePlugin.model, facePlugin.model, postureClassifier.model]);

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

  // Kamburluk / duruş tespiti artık ML sınıflandırıcısı tarafından yapılıyor.
  // Bu fonksiyon yalnızca yüz analizini (gülümseme, kafa eğikliği) yönetir.
  const analyzePosture = (_poseLandmarks: any[], faceLandmarks: any[]) => {
    // --- YÜZ ANALİZİ (Gülümseme & Kafa Eğikliği) ---
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

  // ML sınıflandırıcı kötü duruş tespit ettiğinde worklet'ten JS thread'e köprü
  const triggerPostureWarning = (confidence: number) => {
    showCoachCard(`Dik Dur! (%${(confidence * 100).toFixed(0)})`);
  };
  const triggerPostureWarningJS = Worklets.createRunOnJS(triggerPostureWarning);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    // Null check: tüm modeller hazır olana kadar işlem yapma
    if (
      posePlugin.model == null ||
      facePlugin.model == null ||
      postureClassifier.model == null
    ) return;

    // --- FRAME SKIPPER: performans için her 5 frame'de 1 kez çalış ---
    frameCounter.value = (frameCounter.value + 1) % 5;
    if (frameCounter.value !== 0) return;

    try {
      // ================================================================
      // AŞAMA 1A — POSE LANDMARK TESPİTİ (256×256)
      // ================================================================
      const poseResized = resize(frame, {
        scale: { width: 256, height: 256 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const poseOutputs = posePlugin.model.runSync([poseResized]);
      const poseScoreArray = poseOutputs[0] as Uint8Array;
      const poseLandmarksRaw = poseOutputs[1] as Uint8Array;

      const poseScore = poseScoreArray[0] * 0.00390625;
      const POSE_SCALE = 0.006036719772964716;
      const POSE_ZERO_PT = 74;
      const POSE_POINT_COUNT = 25; // model 25 nokta döndürüyor

      // ================================================================
      // AŞAMA 1B — FACE LANDMARK TESPİTİ (192×192)
      // ================================================================
      const faceResized = resize(frame, {
        scale: { width: 192, height: 192 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      const faceOutputs = facePlugin.model.runSync([faceResized]);
      const faceScoreArray = faceOutputs[0] as Uint8Array;
      const faceLandmarksRaw = faceOutputs[1] as Uint8Array;

      const faceScore = faceScoreArray[0] * 0.00390625;
      const FACE_SCALE = 0.004754403606057167;
      const FACE_ZERO_PT = 48;
      const FACE_POINT_COUNT = 468; // MediaPipe Face Mesh: 468 nokta

      // ================================================================
      // AŞAMA 2 — SINIFLANDIRICI GİRDİSİ OLUŞTUR (Float32Array[2004])
      // Model input shape: float32[-1, 2004]
      // Doldurulan değerler: pose 25×2=50 + face 468×2=936 = 986 eleman
      // Geri kalan 1018 eleman Float32Array varsayılanı olan 0 ile dolu
      // ================================================================
      const INPUT_SIZE = 2004;
      const classifierInput = new Float32Array(INPUT_SIZE); // tamamı 0 ile başlar
      let offset = 0;

      // --- Pose landmark'larını doldur (25 nokta × [x, y] = 50 değer) ---
      if (poseScore > 0.5) {
        for (let i = 0; i < POSE_POINT_COUNT; i++) {
          const xRaw = (poseLandmarksRaw[i * 4]     - POSE_ZERO_PT) * POSE_SCALE;
          const yRaw = (poseLandmarksRaw[i * 4 + 1] - POSE_ZERO_PT) * POSE_SCALE;
          classifierInput[offset++] = xRaw / 256;
          classifierInput[offset++] = yRaw / 256;
        }
      } else {
        offset += POSE_POINT_COUNT * 2; // pose yok — bu slotları 0 bırak, offset'i atla
      }

      // --- Face landmark'larını doldur (468 nokta × [x, y] = 936 değer) ---
      if (faceScore > 0.5) {
        for (let i = 0; i < FACE_POINT_COUNT; i++) {
          const xRaw = (faceLandmarksRaw[i * 3]     - FACE_ZERO_PT) * FACE_SCALE;
          const yRaw = (faceLandmarksRaw[i * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE;
          classifierInput[offset++] = xRaw / 192;
          classifierInput[offset++] = yRaw / 192;
        }
      }
      // offset = 986; kalan 1018 eleman zaten 0 (padding)

      // ================================================================
      // AŞAMA 2 — DURUŞ SINIFLANDIRICI'YI ÇALIŞTIR
      // Çıktı: olasılık dizisi — index 0 = kambur/hatalı duruş olasılığı
      // ================================================================
      const classifierOutputs = postureClassifier.model.runSync([classifierInput]);
      const probabilities = classifierOutputs[0] as Float32Array;

      // Sınıf eşleşmesi model etiketlerine göre ayarlanmalı:
      // 0 = kambur/hatalı duruş varsayımı — Netron ile doğrulayın
      const BAD_POSTURE_CLASS_INDEX = 0;
      const BAD_POSTURE_THRESHOLD = 0.70; // %70 ve üzeri → uyarı tetikle

      if (probabilities[BAD_POSTURE_CLASS_INDEX] > BAD_POSTURE_THRESHOLD) {
        triggerPostureWarningJS(probabilities[BAD_POSTURE_CLASS_INDEX]);
      }

      // ================================================================
      // UI DURUMU GÜNCELLEMESİ — skeleton overlay için landmark'ları JS'e gönder
      // ================================================================
      const parsedPoseLandmarks: { x: number; y: number }[] = [];
      if (poseScore > 0.5) {
        for (let i = 0; i < POSE_POINT_COUNT; i++) {
          const xRaw = (poseLandmarksRaw[i * 4]     - POSE_ZERO_PT) * POSE_SCALE;
          const yRaw = (poseLandmarksRaw[i * 4 + 1] - POSE_ZERO_PT) * POSE_SCALE;
          parsedPoseLandmarks.push({ x: xRaw / 256, y: yRaw / 256 });
        }
      }

      const parsedFaceLandmarks: { x: number; y: number }[] = [];
      if (faceScore > 0.5) {
        for (let i = 0; i < FACE_POINT_COUNT; i++) {
          const xRaw = (faceLandmarksRaw[i * 3]     - FACE_ZERO_PT) * FACE_SCALE;
          const yRaw = (faceLandmarksRaw[i * 3 + 1] - FACE_ZERO_PT) * FACE_SCALE;
          parsedFaceLandmarks.push({ x: xRaw / 192, y: yRaw / 192 });
        }
      }

      updateLandmarksJS(
        JSON.stringify(parsedPoseLandmarks),
        JSON.stringify(parsedFaceLandmarks),
        poseScore,
        faceScore,
      );
    } catch (_e) {
      // Worklet'te uygulama çökmesini önlemek için hataları sessizce yut
    }
  }, [posePlugin.model, facePlugin.model, postureClassifier.model]);

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

  if (!isPoseModelLoaded || !isFaceModelLoaded || !isPostureModelLoaded) {
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

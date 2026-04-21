import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GlassCard } from '../../components/GlassCard';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const MODES = [
  { id: 'live', title: 'Live Rehearsal', icon: 'videocam', description: 'Real-time AI coaching' },
  { id: 'upload', title: 'Video Upload', icon: 'cloud-upload', description: 'Analyze pre-recorded clips' },
  { id: 'free', title: 'Freestyle Mode', icon: 'mic', description: 'Script-free practice' },
];

const CHARACTERS = [
  { id: 'hamlet', name: 'Hamlet', role: 'Prince of Denmark' },
  { id: 'ophelia', name: 'Ophelia', role: 'Noblewoman' },
  { id: 'macbeth', name: 'Macbeth', role: 'Thane of Glamis' },
  { id: 'romeo', name: 'Romeo', role: 'Montague' },
];

export default function RehearsalScreen() {
  const [selectedMode, setSelectedMode] = useState('live');
  const [selectedCharacter, setSelectedCharacter] = useState('hamlet');
  const router = useRouter();

  const handleStartSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (selectedMode === 'live') {
      router.push('/live-rehearsal');
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Select Practice Mode</Text>
        
        <View style={styles.modesContainer}>
          {MODES.map((mode) => (
            <TouchableOpacity 
              key={mode.id} 
              onPress={() => setSelectedMode(mode.id)}
              activeOpacity={0.8}
            >
              <GlassCard style={[
                styles.modeCard, 
                selectedMode === mode.id && styles.activeModeCard
              ]}>
                <Ionicons 
                  name={mode.icon as any} 
                  size={32} 
                  color={selectedMode === mode.id ? Colors.primary : Colors.textSecondary} 
                />
                <Text style={[
                  styles.modeTitle,
                  selectedMode === mode.id && styles.activeModeText
                ]}>{mode.title}</Text>
                <Text style={styles.modeDesc}>{mode.description}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select Character Profile</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.characterScroll}>
          {CHARACTERS.map((char) => (
            <TouchableOpacity 
              key={char.id} 
              onPress={() => setSelectedCharacter(char.id)}
              style={styles.characterWrapper}
            >
              <GlassCard style={[
                styles.characterCard,
                selectedCharacter === char.id && styles.activeCharacterCard
              ]}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{char.name[0]}</Text>
                </View>
                <Text style={styles.characterName}>{char.name}</Text>
                <Text style={styles.characterRole}>{char.role}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.startButton}
            onPress={handleStartSession}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <Ionicons name="play" size={24} color="#FFF" />
              <Text style={styles.startButtonText}>Begin Session</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.calibrationText}>Camera & Mic calibration required</Text>
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    ...Theme.typography.h2,
    marginBottom: 20,
  },
  modesContainer: {
    marginBottom: 30,
    gap: 16,
  },
  modeCard: {
    padding: 20,
    alignItems: 'flex-start',
  },
  activeModeCard: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  modeTitle: {
    ...Theme.typography.h3,
    marginTop: 12,
    marginBottom: 4,
  },
  activeModeText: {
    color: Colors.primary,
  },
  modeDesc: {
    ...Theme.typography.body2,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    marginBottom: 16,
  },
  characterScroll: {
    marginBottom: 40,
  },
  characterWrapper: {
    marginRight: 16,
  },
  characterCard: {
    width: 140,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  activeCharacterCard: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    ...Theme.typography.h2,
    color: Colors.text,
  },
  characterName: {
    ...Theme.typography.h3,
    textAlign: 'center',
    marginBottom: 4,
  },
  characterRole: {
    ...Theme.typography.caption,
    textAlign: 'center',
  },
  actionContainer: {
    alignItems: 'center',
  },
  startButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  gradientButton: {
    flex: 1,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  startButtonText: {
    ...Theme.typography.h3,
    color: '#FFF',
  },
  calibrationText: {
    ...Theme.typography.caption,
    marginTop: 12,
    opacity: 0.7,
  },
});

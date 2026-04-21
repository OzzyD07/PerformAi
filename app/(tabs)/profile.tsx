import React from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GlassCard } from '../../components/GlassCard';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

const MockSlider = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.sliderContainer}>
    <View style={styles.sliderHeader}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Text style={styles.sliderValue}>{Math.round(value * 100)}%</Text>
    </View>
    <View style={styles.sliderTrack}>
      <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
      <View style={[styles.sliderThumb, { left: `${value * 100}%` }]} />
    </View>
  </View>
);

const SettingRow = ({ label, icon, value, color = Colors.text }: { label: string; icon: any; value: string; color?: string }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.settingIcon} />
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    <Text style={[styles.settingValue, { color }]}>{value}</Text>
  </View>
);

export default function ProfileScreen() {
  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Account Overview */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>OZ</Text>
          </View>
          <Text style={styles.userName}>Ozan</Text>
          <Text style={styles.userEmail}>ozan@example.com</Text>
          <View style={styles.subscriptionBadge}>
            <Text style={styles.subscriptionText}>Premium Plan</Text>
          </View>
        </View>

        {/* AI Feedback Tuning */}
        <Text style={styles.sectionTitle}>AI Feedback Tuning</Text>
        <GlassCard style={styles.card}>
          <MockSlider label="Coach Sensitivity" value={0.7} />
          <MockSlider label="Speech Detection" value={0.85} />
          <MockSlider label="Emotion Threshold" value={0.6} />
        </GlassCard>

        {/* Privacy & Security */}
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        <GlassCard style={styles.card}>
          <View style={styles.privacyRow}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyTitle}>Privacy-by-Design</Text>
              <Text style={styles.privacyDesc}>
                Facial and pose data is processed locally on your device and never uploaded to the cloud.
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* System Diagnostics */}
        <Text style={styles.sectionTitle}>System Status</Text>
        <GlassCard style={styles.card}>
          <SettingRow 
            label="Cloud API" 
            icon="cloud-outline" 
            value="Connected" 
            color={Colors.success} 
          />
          <SettingRow 
            label="MediaPipe Model" 
            icon="cube-outline" 
            value="Ready" 
            color={Colors.success} 
          />
          <SettingRow 
            label="TFLite Engine" 
            icon="hardware-chip-outline" 
            value="Active" 
            color={Colors.success} 
          />
          <SettingRow 
            label="Microphone" 
            icon="mic-outline" 
            value="Calibrated" 
            color={Colors.success} 
          />
        </GlassCard>

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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: {
    ...Theme.typography.h1,
    color: '#FFF',
    fontSize: 28,
  },
  userName: {
    ...Theme.typography.h2,
    marginBottom: 4,
  },
  userEmail: {
    ...Theme.typography.body1,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  subscriptionBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  subscriptionText: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    marginBottom: 24,
    padding: 20,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    ...Theme.typography.body2,
    color: Colors.text,
  },
  sliderValue: {
    ...Theme.typography.body2,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sliderThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyTitle: {
    ...Theme.typography.h3,
    fontSize: 16,
    marginBottom: 4,
  },
  privacyDesc: {
    ...Theme.typography.body2,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 24,
  },
  settingLabel: {
    ...Theme.typography.body1,
  },
  settingValue: {
    ...Theme.typography.body1,
    fontWeight: '600',
  },
});

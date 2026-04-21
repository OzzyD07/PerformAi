import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GlassCard } from '../../components/GlassCard';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const lineData = [
    { value: 60, label: 'Mon' },
    { value: 65, label: 'Tue' },
    { value: 70, label: 'Wed' },
    { value: 68, label: 'Thu' },
    { value: 75, label: 'Fri' },
    { value: 80, label: 'Sat' },
    { value: 85, label: 'Sun' },
  ];

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Personalized Greeting */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good Morning, Ozan!</Text>
          <Text style={styles.subGreeting}>Ready to master your next scene?</Text>
        </View>

        {/* Daily Goal Tracker */}
        <GlassCard style={styles.goalCard}>
          <View style={styles.goalRow}>
            <View>
              <Text style={styles.goalTitle}>Daily Goal</Text>
              <Text style={styles.goalSubtitle}>30 min daily goal</Text>
            </View>
            <View style={styles.progressRing}>
              <Text style={styles.progressText}>65%</Text>
            </View>
          </View>
        </GlassCard>

        {/* Last Performance Card */}
        <GlassCard style={styles.performanceCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Last Performance</Text>
            <Text style={styles.dateText}>Today, 10:30 AM</Text>
          </View>
          <Text style={styles.characterName}>Hamlet</Text>
          
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Ionicons name="sad-outline" size={20} color={Colors.accent} />
              <Text style={styles.metricLabel}>Dominant Emotion</Text>
              <Text style={styles.metricValue}>Sadness</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="mic-outline" size={20} color={Colors.secondary} />
              <Text style={styles.metricLabel}>Diction Score</Text>
              <Text style={styles.metricValue}>85/100</Text>
            </View>
          </View>
        </GlassCard>

        {/* Performance Trend */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Weekly Growth</Text>
          <GlassCard style={styles.chartCard}>
            <LineChart
              data={lineData}
              color={Colors.primary}
              thickness={3}
              dataPointsColor={Colors.secondary}
              textColor={Colors.textSecondary}
              hideRules
              hideYAxisText
              xAxisColor="transparent"
              yAxisColor="transparent"
              width={width - 80}
              height={150}
              curved
              startFillColor={Colors.primary}
              endFillColor="transparent"
              startOpacity={0.3}
              endOpacity={0.0}
              areaChart
            />
          </GlassCard>
        </View>

        {/* AI Coach Insight */}
        <GlassCard style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb" size={24} color={Colors.secondary} />
            <Text style={styles.insightTitle}>Coach Insight</Text>
          </View>
          <Text style={styles.insightText}>
            Your 'Anger' intensity was low in the last session. Try the 'Macbeth' monologue today to push your range.
          </Text>
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
    marginBottom: 24,
  },
  greeting: {
    ...Theme.typography.h1,
    fontSize: 28,
  },
  subGreeting: {
    ...Theme.typography.body1,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  goalCard: {
    marginBottom: 20,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: {
    ...Theme.typography.h3,
    marginBottom: 4,
  },
  goalSubtitle: {
    ...Theme.typography.body2,
  },
  progressRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    color: Colors.success,
    fontWeight: 'bold',
    fontSize: 12,
  },
  performanceCard: {
    marginBottom: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.4)', // Slightly different for contrast
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    ...Theme.typography.label,
    color: Colors.textSecondary,
  },
  dateText: {
    ...Theme.typography.caption,
  },
  characterName: {
    ...Theme.typography.h2,
    marginBottom: 16,
    color: Colors.primary,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: Colors.glassBorder,
  },
  metricLabel: {
    ...Theme.typography.caption,
    marginTop: 4,
  },
  metricValue: {
    ...Theme.typography.h3,
    marginTop: 2,
  },
  chartContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    marginBottom: 12,
  },
  chartCard: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  insightCard: {
    marginBottom: 20,
    borderColor: Colors.secondary,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightTitle: {
    ...Theme.typography.h3,
    color: Colors.secondary,
  },
  insightText: {
    ...Theme.typography.body1,
    fontStyle: 'italic',
  },
});

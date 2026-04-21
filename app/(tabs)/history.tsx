import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { GlassCard } from '../../components/GlassCard';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

const SESSIONS = [
  { id: '1', title: 'Hamlet - Act 1, Scene 2', date: 'Mar 1, 2026', score: 85, emotion: 'sad', character: 'Hamlet' },
  { id: '2', title: 'Romeo & Juliet - Balcony', date: 'Feb 28, 2026', score: 92, emotion: 'happy', character: 'Romeo' },
  { id: '3', title: 'Macbeth - Soliloquy', date: 'Feb 25, 2026', score: 78, emotion: 'angry', character: 'Macbeth' },
  { id: '4', title: 'The Seagull - Nina', date: 'Feb 20, 2026', score: 88, emotion: 'neutral', character: 'Nina' },
];

const EMOTION_ICONS: Record<string, any> = {
  sad: 'sad-outline',
  happy: 'happy-outline',
  angry: 'flame-outline',
  neutral: 'ellipse-outline',
};

const EMOTION_COLORS: Record<string, string> = {
  sad: '#6C5CE7',
  happy: '#FDCB6E',
  angry: '#FF7675',
  neutral: '#A0A0A0',
};

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = SESSIONS.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.character.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: typeof SESSIONS[0] }) => (
    <GlassCard style={styles.sessionCard}>
      <View style={styles.sessionRow}>
        <View style={[styles.emotionIndicator, { backgroundColor: EMOTION_COLORS[item.emotion] }]}>
          <Ionicons name={EMOTION_ICONS[item.emotion]} size={20} color="#FFF" />
        </View>
        
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle}>{item.title}</Text>
          <Text style={styles.sessionDate}>{item.date} • {item.character}</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreValue}>{item.score}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by character or scene..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredSessions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.headerTitle}>Past Sessions</Text>
          }
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    ...Theme.typography.h2,
    marginBottom: 16,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    height: '100%',
  },
  listContent: {
    paddingBottom: 130,
  },
  sessionCard: {
    marginBottom: 12,
    padding: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    ...Theme.typography.h3,
    fontSize: 16,
    marginBottom: 4,
  },
  sessionDate: {
    ...Theme.typography.caption,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  scoreValue: {
    ...Theme.typography.h2,
    color: Colors.primary,
  },
  scoreLabel: {
    ...Theme.typography.caption,
    fontSize: 10,
  },
});

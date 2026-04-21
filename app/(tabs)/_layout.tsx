import React from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 32 : 24,
          left: 24,
          right: 24,
          elevation: 0,
          backgroundColor: 'rgba(30, 30, 30, 0.75)',
          borderRadius: 24,
          height: 68,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
        },
        tabBarBackground: () => (
          <View style={styles.blurContainer}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: Platform.OS === 'ios' ? 15 : 0, // iOS'ta ikonları merkeze almak için
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "home" : "home-outline"} size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="rehearsal"
        options={{
          title: "Rehearsal",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "mic" : "mic-outline"} size={28} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "time" : "time-outline"} size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    position: 'absolute',
    bottom: -12, // İkonun tam altında durması için
  },
});

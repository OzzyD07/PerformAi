import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../constants/Colors";
import { StatusBar } from "expo-status-bar";

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenWrapper({ children, style }: ScreenWrapperProps) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.background, "#1A1A2E"]} // Dark blue/charcoal gradient
        style={styles.gradient}
      />
      <SafeAreaView style={[styles.content, style]}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
  },
});

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Colors } from "../constants/Colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlassCard({ children, style }: GlassCardProps) {
  return (
    <BlurView intensity={20} tint="dark" style={[styles.container, style]}>
      <View style={styles.content}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.glass,
    borderColor: Colors.glassBorder,
    borderWidth: 1,
  },
  content: {
    padding: 16,
  },
});

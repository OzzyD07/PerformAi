import { StyleSheet } from "react-native";
import { Colors } from "./Colors";

export const Theme = {
  colors: Colors,
  fonts: {
    // Assuming we use system fonts for now, but can be replaced with custom fonts
    regular: "System",
    medium: "System-Medium",
    bold: "System-Bold",
  },
  typography: StyleSheet.create({
    h1: {
      fontSize: 32,
      fontWeight: "bold",
      color: Colors.text,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: "bold",
      color: Colors.text,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize: 20,
      fontWeight: "600",
      color: Colors.text,
    },
    body1: {
      fontSize: 16,
      color: Colors.text,
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      color: Colors.textSecondary,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  }),
  layout: StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
    },
    glassCard: {
      backgroundColor: Colors.glass,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: Colors.glassBorder,
    },
  }),
};

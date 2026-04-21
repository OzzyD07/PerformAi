import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const router = useRouter();

  const handleLogin = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Mock login logic
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background, '#1A1A2E', '#0f0c29']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        <Animated.View entering={FadeInUp.delay(200).duration(1000)} style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="mic-circle" size={80} color={Colors.primary} />
            <Text style={styles.title}>PerformAi</Text>
          </View>
          <Text style={styles.subtitle}>Your Personal AI Acting Coach</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(1000)} style={styles.formContainer}>
          <View style={styles.glassCard}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            
            <TouchableOpacity style={styles.googleButton} onPress={handleLogin}>
              <Ionicons name="logo-google" size={24} color="#FFF" />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>

            <TextInput
              placeholder="Email"
              placeholderTextColor="#666"
              style={styles.input}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
              style={styles.input}
            />

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    justifyContent: 'center',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...Theme.typography.h1,
    color: Colors.primary,
    fontWeight: '800',
  },
  subtitle: {
    ...Theme.typography.body1,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  glassCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  welcomeText: {
    ...Theme.typography.h2,
    marginBottom: 24,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DB4437',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  orText: {
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

const ASSETS = {
  icon: require('../assets/images/aquasense-icon.png'),
  wordmark: require('../assets/images/aquasense-wordmark.png'),
};

export default function Splashscreen() {
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.95)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(10)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Pega o usuário e o estado de loading do contexto
  const { user, loadingAuth } = useAuth();

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),

      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(100),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(1000),

      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Só redireciona depois que o Firebase terminou de verificar a sessão
      if (loadingAuth) return;

      if (user && user.emailVerified) {
        // Usuário já logado e verificado → vai direto pra home
        router.replace('/(tabs)/home' as any);
      } else {
        // Sem usuário ou e-mail não verificado → vai pro login
        router.replace('/login');
      }
    });
  }, [loadingAuth, user]);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }}
        >
          <Image
            source={ASSETS.icon}
            style={styles.icon}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={{
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslateY }],
          }}
        >
          <Image
            source={ASSETS.wordmark}
            style={styles.wordmark}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    transform: [{ translateY: -20 }],
  },
  icon: {
    width: 250,
    height: 200,
  },
  wordmark: {
    width: 250,
    height: 100,
    marginTop: -20,
  },
});
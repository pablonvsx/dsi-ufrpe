// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TabHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AquaSense</Text>
      <Text style={styles.subtitle}>em desenvolvimento</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
  },
});
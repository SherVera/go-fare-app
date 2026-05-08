import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface State {
  hasError: boolean;
}

export class MapErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[MapErrorBoundary] Map failed to load:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Ionicons name="map-outline" size={40} color="#94A3B8" />
          <Text style={styles.text}>Mapa no disponible</Text>
          <Text style={styles.sub}>
            Activa Maps SDK en Google Cloud Console
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  sub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

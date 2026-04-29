import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Animated } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { tokens } from '@/theme/tokens';

export const MapCard = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('Buscando ubicación...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso denegado');
        setAddress('Ubicación desconocida');
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(location);

        let geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          const name = place.street || place.district || place.city || 'Desconocida';
          setAddress(`Ubicación actual: ${name}`);
        } else {
          setAddress('Ubicación actual: Coordenadas');
        }
      } catch (error) {
        try {
          // Fallback to last known position
          let location = await Location.getLastKnownPositionAsync({});
          if (location) {
            setLocation(location);
            setAddress('Ubicación aproximada');
            return;
          }
        } catch (e) {
          // Ignore
        }
        setErrorMsg('Error al obtener ubicación');
        setAddress('Ubicación no disponible');
      }
    })();
  }, []);

  const renderMap = () => {
    if (!location) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
        </View>
      );
    }

    if (Platform.OS === 'web') {
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      // Use standard iframe element for React Native Web
      const Iframe = 'iframe' as any;
      return (
        <Iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={`https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`}
        />
      );
    }

    return (
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title="Tu Ubicación"
        />
      </MapView>
    );
  };

  const dotColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#94A3B8', '#3B82F6'], // Gris a Azul
  });

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        {renderMap()}
        <View style={styles.badge}>
          <Animated.View style={[styles.dot, errorMsg ? { backgroundColor: '#EF4444' } : { backgroundColor: dotColor }]} />
          <Text style={styles.badgeText} numberOfLines={1}>{address}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  badge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  badgeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.textDark,
  },
});

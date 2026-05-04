import React from 'react';
import * as Location from 'expo-location';

interface NativeMapProps {
  location: Location.LocationObject;
}

export const NativeMap = ({ location }: NativeMapProps) => {
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
};

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function PayTripScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert('Código Escaneado', `Información: ${data}`, [
      { text: 'Aceptar', onPress: () => setScanned(false) }
    ]);
  };

  if (!permission) {
    // Camera permissions are still loading
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Pagar Viajes</Text>
        </View>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" style={{ marginBottom: 16 }} />
          <Text style={styles.permissionText}>Necesitamos acceso a tu cámara para escanear los códigos QR.</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Otorgar Permiso</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Pagar Viajes</Text>
      </View>

      <View style={styles.content}>
        {/* ── SCANNER FRAME ── */}
        <View style={styles.scannerWrapper}>
          <View style={styles.scannerBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />

            {/* Corner Borders */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Laser Line */}
            <LinearGradient
              colors={['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.laserLine}
            />
          </View>
        </View>

        {/* ── TEXT INFO ── */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Escanea el código QR del bus</Text>
          <Text style={styles.subtitle}>
            Ubica el código dentro del recuadro{'\n'}para pagar tu viaje
          </Text>
        </View>
      </View>

      {/* ── BOTTOM ACTIONS ── */}
      <View style={styles.bottomSection}>
        <View style={styles.actionButtonsRow}>
          
          <View style={styles.actionItem}>
            <Pressable style={styles.scanButtonActive}>
              <MaterialCommunityIcons name="qrcode-scan" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.actionTextActive}>ESCANEAR</Text>
          </View>

          <View style={styles.actionItem}>
            <Pressable style={styles.galleryButton}>
              <Ionicons name="image-outline" size={24} color="#9CA3AF" />
            </Pressable>
            <Text style={styles.actionTextInactive}>GALERÍA</Text>
          </View>
          
        </View>

        <View style={styles.secureBadge}>
          <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
          <Text style={styles.secureText}>PAGO SEGURO ENCRIPTADO</Text>
        </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // Very dark background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scannerWrapper: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBox: {
    width: 280,
    height: 280,
    backgroundColor: '#000000', // Black inner scanner area
    borderRadius: 24,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#818CF8', // Lighter glowing blue
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 24,
  },
  laserLine: {
    width: '90%',
    height: 2,
    position: 'absolute',
    top: '30%', // Position the laser slightly above center
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    marginBottom: 32,
  },
  actionItem: {
    alignItems: 'center',
  },
  scanButtonActive: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2937', // Dark gray
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTextActive: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    letterSpacing: 1,
  },
  actionTextInactive: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secureText: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#9CA3AF',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 20,
    shadowColor: tokens.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
});

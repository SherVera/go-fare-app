import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getBackendProfile, getMyTransportOwnerProfile } from '@/lib/api';
import { sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

interface PendingApprovalScreenProps {
  onApproved?: () => void;
}

export function PendingApprovalScreen({
  onApproved,
}: PendingApprovalScreenProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const checkStatusSilently = useCallback(async () => {
    try {
      const ownerProfile = await getMyTransportOwnerProfile();
      if (ownerProfile && ownerProfile.status === 'approved') {
        if (onApproved) {
          onApproved();
        } else {
          router.replace('/vehicle-owner/dashboard');
        }
      }
    } catch (_) {}
  }, [onApproved, router]);

  useEffect(() => {
    checkStatusSilently();
  }, [checkStatusSilently]);

  const handleSignOut = async () => {
    try {
      await sigOutAccount();
    } catch {
      // ignore
    }
    router.replace('/landing');
  };

  const handleCheckStatus = async () => {
    try {
      setChecking(true);
      const ownerProfile = await getMyTransportOwnerProfile();
      const profile = ownerProfile
        ? null
        : await getBackendProfile().catch(() => null);

      const status =
        ownerProfile?.status ||
        (profile as any)?.transportOwner?.status ||
        (profile as any)?.transport_owner?.status ||
        (profile as any)?.ownerStatus ||
        (profile as any)?.status;

      if (status === 'approved') {
        Alert.alert(
          '¡Solicitud Aprobada!',
          'Tu cuenta ha sido aprobada por el administrador. Ya puedes acceder al panel de control.',
          [
            {
              text: 'Continuar',
              onPress: () => {
                if (onApproved) {
                  onApproved();
                } else {
                  router.replace('/vehicle-owner/dashboard');
                }
              },
            },
          ],
        );
      } else if (status === 'rejected') {
        const reason =
          ownerProfile?.rejectionReason ||
          (profile as any)?.transportOwner?.rejectionReason ||
          'No cumple con los requisitos solicitados.';
        Alert.alert(
          'Solicitud Rechazada',
          `El administrador ha rechazado tu solicitud.\n\nMotivo: ${reason}`,
        );
      } else {
        Alert.alert(
          'Aún en Revisión',
          'Tu solicitud sigue en proceso de revisión por parte del administrador. Por favor, intenta de nuevo más tarde.',
        );
      }
    } catch (err: any) {
      console.warn('[PendingApproval] Error comprobando estado:', err);
      Alert.alert(
        'Error de Conexión',
        'No se pudo verificar el estado en este momento. Intenta de nuevo.',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title="Solicitud Enviada" onBack={handleSignOut} />
        <ScrollView
          contentContainerStyle={[styles.scroll, { justifyContent: 'center' }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <Ionicons
                name="time-outline"
                size={96}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          <View style={[styles.titleBlock, { alignItems: 'center' }]}>
            <Text style={[styles.titleDark, { textAlign: 'center' }]}>
              Solicitud en
            </Text>
            <Text style={[styles.titleBlue, { textAlign: 'center' }]}>
              Revisión
            </Text>
            <Text
              style={[styles.subtitle, { textAlign: 'center', marginTop: 12 }]}
            >
              Tu solicitud de registro como Dueño de Vehículo ha sido enviada
              con éxito.
              {'\n\n'}
              El administrador del sistema revisará y verificará tus datos
              comerciales. Una vez aprobada la solicitud, se habilitará tu
              cuenta para acceder a tu panel de dueño de vehículo.
            </Text>
          </View>

          {/* Botón Comprobar Estado */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleCheckStatus}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.ctaText}>Comprobar Estado</Text>
                <Ionicons
                  name="sync-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          {/* Botón Volver / Cerrar Sesión */}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSignOut}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color="#64748B"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.secondaryBtnText}>Cerrar Sesión</Text>
          </Pressable>

          <Text style={styles.footerLegal}>
            CARACAS MOVE • REGISTRO DE SOCIO
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FC',
  },
  blob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#DCE7F6',
    top: -60,
    right: -60,
    opacity: 0.6,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  fakeShadow: {
    position: 'absolute',
    width: 148,
    height: 136,
    borderRadius: 30,
    backgroundColor: '#91B4E0',
    opacity: 0.3,
    top: 18,
    transform: [{ scaleX: 0.9 }],
  },
  iconCard: {
    width: 160,
    height: 148,
    backgroundColor: '#D6E5F8',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5080C0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#EBF4FF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    opacity: 0.75,
  },
  titleBlock: { marginBottom: 24 },
  titleDark: {
    fontSize: 38,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    lineHeight: 44,
  },
  titleBlue: {
    fontSize: 38,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    lineHeight: 44,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    lineHeight: 22,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 60,
    marginTop: 10,
    marginBottom: 12,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#64748B',
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

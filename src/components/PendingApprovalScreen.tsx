import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
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
import { auth, sigOutAccount } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

interface PendingApprovalScreenProps {
  onApproved?: () => void;
}

export function PendingApprovalScreen({
  onApproved,
}: PendingApprovalScreenProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<
    'pending' | 'rejected' | 'approved' | 'suspended'
  >('pending');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>(
    auth.currentUser?.email || '',
  );

  const checkStatusSilently = useCallback(async () => {
    try {
      if (!userEmail && auth.currentUser?.email) {
        setUserEmail(auth.currentUser.email);
      }

      // Esta pantalla es EXCLUSIVA para dueños de vehículo.
      // Si el rol es conductor, administrador o pasajero, redirigir inmediatamente.
      const cachedRole = await SecureStore.getItemAsync('user_role');
      if (cachedRole === 'driver' || cachedRole === 'conductor') {
        router.replace('/driver/dashboard');
        return;
      }
      if (cachedRole === 'platform_admin' || cachedRole === 'admin') {
        router.replace('/admin/dashboard');
        return;
      }

      // Verificar rol en backend para conductores y administradores
      const profile = await getBackendProfile().catch(() => null);
      if (profile) {
        const roles = (profile as any)?.roles || [];
        const isDriver =
          roles.some((r: any) => {
            const name = (r?.name || r?.role || r || '')
              .toString()
              .toLowerCase();
            return name === 'driver' || name === 'conductor';
          }) ||
          (profile as any)?.role === 'driver' ||
          (profile as any)?.firstName?.toLowerCase().includes('conductor') ||
          (profile as any)?.displayName?.toLowerCase().includes('conductor');

        if (isDriver) {
          router.replace('/driver/dashboard');
          return;
        }

        const isAdmin = roles.some((r: any) => {
          const name = (r?.name || r?.role || r || '').toString().toLowerCase();
          return name === 'platform_admin' || name === 'admin';
        });
        if (isAdmin) {
          router.replace('/admin/dashboard');
          return;
        }
      }

      const ownerProfile = await getMyTransportOwnerProfile().catch(() => null);

      if (ownerProfile?.user?.email) {
        setUserEmail(ownerProfile.user.email);
      } else if (ownerProfile?.email) {
        setUserEmail(ownerProfile.email);
      }

      const resolvedStatus =
        ownerProfile?.status ||
        (profile as any)?.transportOwner?.status ||
        (profile as any)?.transport_owner?.status ||
        (profile as any)?.ownerStatus ||
        (profile as any)?.status;

      const reason =
        ownerProfile?.rejectionReason ||
        ownerProfile?.rejection_reason ||
        ownerProfile?.suspensionReason ||
        ownerProfile?.suspension_reason ||
        (profile as any)?.transportOwner?.rejectionReason ||
        (profile as any)?.transportOwner?.suspensionReason ||
        (profile as any)?.rejectionReason ||
        (profile as any)?.suspensionReason ||
        '';

      if (resolvedStatus === 'approved') {
        setStatus('approved');
        if (onApproved) {
          onApproved();
        } else {
          router.replace('/vehicle-owner/dashboard');
        }
        return;
      }

      if (resolvedStatus === 'suspended') {
        setStatus('suspended');
        setRejectionReason(reason);
        return;
      }

      if (resolvedStatus === 'rejected') {
        setStatus('rejected');
        setRejectionReason(reason);
        return;
      }

      setStatus('pending');

      // Si no tiene perfil de dueño o no ha solicitado ser dueño (pasajero estándar)
      if (!ownerProfile || ownerProfile.status === 'not_applied') {
        router.replace('/(tabs)');
      }
    } catch (_) {}
  }, [onApproved, router, userEmail]);

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

      const resolvedStatus =
        ownerProfile?.status ||
        (profile as any)?.transportOwner?.status ||
        (profile as any)?.transport_owner?.status ||
        (profile as any)?.ownerStatus ||
        (profile as any)?.status;

      const reason =
        ownerProfile?.rejectionReason ||
        ownerProfile?.rejection_reason ||
        ownerProfile?.suspensionReason ||
        ownerProfile?.suspension_reason ||
        (profile as any)?.transportOwner?.rejectionReason ||
        (profile as any)?.transportOwner?.suspensionReason ||
        (profile as any)?.rejectionReason ||
        (profile as any)?.suspensionReason ||
        '';

      if (resolvedStatus === 'approved') {
        setStatus('approved');
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
      } else if (resolvedStatus === 'suspended') {
        setStatus('suspended');
        setRejectionReason(reason);
        Alert.alert(
          'Cuenta Suspendida',
          `Tu cuenta se encuentra suspendida por la administración.${reason ? `\n\nMotivo: ${reason}` : '\n\nSi consideras que se trata de un error, comunícate con el equipo de soporte.'}`,
        );
      } else if (resolvedStatus === 'rejected') {
        setStatus('rejected');
        setRejectionReason(reason);
        Alert.alert(
          'Solicitud Rechazada',
          `El administrador ha rechazado tu solicitud.${reason ? `\n\nMotivo: ${reason}` : '\n\nNo se especificó un motivo.'}`,
        );
      } else {
        setStatus('pending');
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

  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';
  const isBlocked = isRejected || isSuspended;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader
          title={
            isSuspended
              ? 'Cuenta Suspendida'
              : isRejected
                ? 'Solicitud Rechazada'
                : 'Solicitud Enviada'
          }
          onBack={handleSignOut}
        />
        <ScrollView
          contentContainerStyle={[styles.scroll, { justifyContent: 'center' }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconSection}>
            <View
              style={[
                styles.fakeShadow,
                isBlocked && { backgroundColor: '#F87171', opacity: 0.25 },
              ]}
            />
            <View
              style={[
                styles.iconCard,
                isBlocked && {
                  backgroundColor: '#FEE2E2',
                  shadowColor: '#EF4444',
                },
              ]}
            >
              <View
                style={[
                  styles.topShine,
                  isBlocked && { backgroundColor: '#FEF2F2' },
                ]}
              />
              <Ionicons
                name={
                  isSuspended
                    ? 'ban-outline'
                    : isRejected
                      ? 'close-circle-outline'
                      : 'time-outline'
                }
                size={96}
                color={isBlocked ? '#DC2626' : tokens.colors.primary}
              />
            </View>
          </View>

          <View style={[styles.titleBlock, { alignItems: 'center' }]}>
            <Text style={[styles.titleDark, { textAlign: 'center' }]}>
              {isSuspended ? 'Cuenta' : 'Solicitud'}
            </Text>
            <Text
              style={[
                styles.titleBlue,
                isBlocked && { color: '#DC2626' },
                { textAlign: 'center' },
              ]}
            >
              {isSuspended
                ? 'Suspendida'
                : isRejected
                  ? 'Rechazada'
                  : 'Revisión'}
            </Text>

            {userEmail ? (
              <View
                style={[
                  styles.emailBadge,
                  isBlocked && {
                    backgroundColor: '#FEF2F2',
                    borderColor: '#FECACA',
                  },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={14}
                  color={isBlocked ? '#DC2626' : '#2563EB'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.emailBadgeText,
                    isBlocked && { color: '#991B1B' },
                  ]}
                  numberOfLines={1}
                >
                  {userEmail}
                </Text>
              </View>
            ) : null}

            {isSuspended ? (
              <View style={styles.rejectionNoticeCard}>
                <View style={styles.rejectionHeaderRow}>
                  <Ionicons name="alert-circle" size={22} color="#DC2626" />
                  <Text style={styles.rejectionNoticeTitle}>
                    Aviso de Suspensión
                  </Text>
                </View>
                <Text style={styles.rejectionNoticeBody}>
                  Tu cuenta ha sido suspendida temporalmente por la administración de la plataforma.
                </Text>
                {rejectionReason ? (
                  <View style={styles.rejectionReasonBox}>
                    <Text style={styles.rejectionReasonLabel}>
                      Motivo de la suspensión:
                    </Text>
                    <Text style={styles.rejectionReasonText}>
                      {rejectionReason}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rejectionReasonBox}>
                    <Text style={styles.rejectionReasonLabel}>Información:</Text>
                    <Text style={styles.rejectionReasonText}>
                      El acceso a las operaciones ha sido inhabilitado por disposición administrativa. Si consideras que se trata de un error o requieres asistencia para reactivar tu cuenta, ponte en contacto con soporte técnico o la administración.
                    </Text>
                  </View>
                )}
              </View>
            ) : isRejected ? (
              <View style={styles.rejectionNoticeCard}>
                <View style={styles.rejectionHeaderRow}>
                  <Ionicons name="alert-circle" size={22} color="#DC2626" />
                  <Text style={styles.rejectionNoticeTitle}>
                    Aviso del Administrador
                  </Text>
                </View>
                <Text style={styles.rejectionNoticeBody}>
                  Tu solicitud de registro como Dueño de Vehículo ha sido rechazada.
                </Text>
                {rejectionReason ? (
                  <View style={styles.rejectionReasonBox}>
                    <Text style={styles.rejectionReasonLabel}>
                      Motivo del rechazo:
                    </Text>
                    <Text style={styles.rejectionReasonText}>
                      {rejectionReason}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rejectionReasonBox}>
                    <Text style={styles.rejectionReasonLabel}>Motivo:</Text>
                    <Text style={styles.rejectionReasonText}>
                      No se especificó un motivo adicional. Si consideras que se trata de un error, comunícate con soporte.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
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
            )}
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
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  emailBadgeText: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#1E40AF',
  },
  rejectionNoticeCard: {
    width: '100%',
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    padding: 18,
    marginTop: 18,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  rejectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectionNoticeTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#991B1B',
    marginLeft: 8,
  },
  rejectionNoticeBody: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  rejectionReasonBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginTop: 12,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#B91C1C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#1E293B',
    lineHeight: 20,
  },
});

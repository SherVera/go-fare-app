import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  getBackendProfile,
  syncWithBackend,
  updateBackendProfile,
} from '@/lib/api';
import { refreshAuthSessionPhase } from '@/lib/auth-session';
import { auth, sigOutAccount, updateUser } from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

function vePhoneFromE164(phone: string | null | undefined): string {
  if (!phone?.startsWith('+58') || phone.length < 12) return '';
  return `0${phone.slice(3)}`;
}

export default function OnboardingScreen() {
  const user = auth.currentUser;

  const [fullName, setFullName] = useState(
    () => user?.displayName?.trim() ?? '',
  );
  const [idNumber, setIdNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(() =>
    vePhoneFromE164(user?.phoneNumber ?? undefined),
  );
  const [hasPhone, setHasPhone] = useState(() =>
    Boolean(user?.phoneNumber && user.phoneNumber.trim().length > 0),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfileData = async () => {
      try {
        // Intentar obtener de la caché primero
        const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
        if (cached && active) {
          const parsed = JSON.parse(cached);
          if (parsed.displayName) setFullName(parsed.displayName);
          if (parsed.nationalId || parsed.idNumber) {
            const rawId = parsed.nationalId || parsed.idNumber || '';
            setIdNumber(
              typeof rawId === 'string' ? rawId.replace('V-', '').trim() : '',
            );
          }
          if (parsed.phoneNumber) {
            setPhoneNumber(parsed.phoneNumber);
            setHasPhone(true);
          }
        }

        // Luego intentar del backend para frescura
        const freshProfile = await getBackendProfile();
        if (freshProfile && active) {
          // Si el usuario es administrador, socio o conductor, no requiere onboarding de pasajero
          const roles = (freshProfile as any).roles || [];
          const isAdmin = roles.some((r: any) => r.name === 'platform_admin' || r.name === 'admin');
          const isOwner = roles.some((r: any) => r.name === 'transport_owner');
          const isDriver = roles.some((r: any) => r.name === 'driver');

          if (isAdmin || isOwner || isDriver) {
            const resolvedRole = isAdmin
              ? 'platform_admin'
              : isOwner
                ? 'transport_owner'
                : 'driver';
            console.log('[Onboarding] Rol no pasajero detectado en backend:', resolvedRole, '. Omitiendo onboarding.');
            await AsyncStorage.setItem('user_role', resolvedRole);
            await refreshAuthSessionPhase();
            return;
          }

          // Fallback: verificar Firebase Custom Claims si el backend dice passenger
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              const idTokenResult = await currentUser.getIdTokenResult(false);
              const claimRole = (idTokenResult.claims as any)?.role as string | undefined;
              const PRIVILEGED_ROLES = ['platform_admin', 'admin', 'transport_owner', 'driver'];
              if (claimRole && PRIVILEGED_ROLES.includes(claimRole)) {
                console.log('[Onboarding] Rol de Custom Claim detectado:', claimRole, '. Omitiendo onboarding.');
                await AsyncStorage.setItem('user_role', claimRole);
                await refreshAuthSessionPhase();
                return;
              }
            }
          } catch (claimErr) {
            console.warn('[Onboarding] Error leyendo custom claims:', claimErr);
          }

          if (freshProfile.displayName) {
            setFullName(freshProfile.displayName);
          } else if (freshProfile.firstName || freshProfile.lastName) {
            setFullName(
              `${freshProfile.firstName || ''} ${freshProfile.lastName || ''}`.trim(),
            );
          }

          if (freshProfile.nationalId) {
            const rawId = freshProfile.nationalId;
            setIdNumber(
              typeof rawId === 'string' ? rawId.replace('V-', '').trim() : '',
            );
          }
          if (freshProfile.phoneNumber) {
            setPhoneNumber(freshProfile.phoneNumber);
            setHasPhone(true);
          }
        }
      } catch (err) {
        console.log('[onboarding] Error pre-populating profile fields:', err);
      }
    };

    loadProfileData();
    return () => {
      active = false;
    };
  }, []);

  if (!user) {
    return null;
  }

  const email = user.email ?? '';

  const handleBack = () => {
    Alert.alert(
      'Salir del registro',
      'Si sales ahora, cerraremos la sesión y podrás elegir otro método de acceso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await sigOutAccount();
            } catch (e) {
              console.warn('[onboarding] signOut:', e);
            }
          },
        },
      ],
    );
  };

  const validateForm = (): boolean => {
    if (fullName.trim().length < 3) {
      Alert.alert('Atención', 'El nombre debe tener al menos 3 caracteres.');
      return false;
    }
    if (!/^\d{5,10}$/.test(idNumber.trim())) {
      Alert.alert(
        'Atención',
        'La cédula debe contener entre 5 y 10 dígitos (solo números).',
      );
      return false;
    }
    if (!hasPhone) {
      if (!/^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(phoneNumber.trim())) {
        Alert.alert(
          'Atención',
          'Por favor, ingresa un número de teléfono válido (ej. 04120000000).',
        );
        return false;
      }
    }
    return true;
  };

  const handlePrimary = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      console.log('[Onboarding] Actualizando perfil en Firebase Auth...');
      await updateUser(user, { displayName: fullName.trim() });

      console.log(
        '[Onboarding] Autenticando y sincronizando con el backend...',
      );
      const response = await syncWithBackend(user);

      console.log('[Onboarding] Actualizando perfil en el backend...');
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || undefined;

      const updatePayload: any = {
        displayName: fullName.trim(),
        firstName,
        lastName,
        nationalId: idNumber.trim(),
      };

      if (!hasPhone) {
        updatePayload.phoneNumber = phoneNumber.trim();
      }

      await updateBackendProfile(response.user.id, updatePayload);

      // Guardar perfil completo en caché local
      const cachedProfile = {
        uid: user.uid,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        firstName,
        lastName,
        idNumber: idNumber.trim(),
        nationalId: idNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email || undefined,
        onboardingCompleted: true,
      };
      await AsyncStorage.setItem(
        'gofare_cached_user_profile',
        JSON.stringify(cachedProfile),
      );

      console.log('[Onboarding] Completado, refrescando sesión...');
      await refreshAuthSessionPhase();
    } catch (e: any) {
      console.error('[onboarding] save:', e);
      Alert.alert(
        'Error',
        e?.message ?? 'No se pudo guardar tu perfil. Intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.blob} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Completa tu perfil" onBack={handleBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconSection}>
            <View style={styles.fakeShadow} />
            <View style={styles.iconCard}>
              <View style={styles.topShine} />
              <MaterialCommunityIcons
                name="card-account-details-outline"
                size={88}
                color={tokens.colors.primary}
              />
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.titleDark}>Completa tu</Text>
            <Text style={styles.titleBlue}>perfil</Text>
            <Text style={styles.subtitle}>
              Ingresa tus datos personales para activar tu cuenta.
            </Text>
          </View>

          {email ? (
            <View style={styles.emailHint}>
              <Ionicons
                name="mail-outline"
                size={16}
                color="#8594AB"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.emailHintText}>{email}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
          <View style={styles.inputCard}>
            <Ionicons name="person-outline" size={20} color="#3072ffe7" />
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="ej. Carlos Pérez"
              placeholderTextColor="#B8C4D4"
              value={fullName}
              onChangeText={setFullName}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

          <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD</Text>
          <View style={styles.inputCard}>
            <Text style={styles.prefix}>V-</Text>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="00000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="number-pad"
              value={idNumber}
              onChangeText={setIdNumber}
              maxLength={10}
              selectionColor={tokens.colors.primary}
              editable={!loading}
            />
          </View>

          <Text style={styles.inputLabel}>TELÉFONO</Text>
          <View style={[styles.inputCard, hasPhone && styles.disabledInputCard]}>
            <Ionicons
              name={hasPhone ? 'lock-closed-outline' : 'call-outline'}
              size={20}
              color={hasPhone ? '#8594AB' : '#3072ffe7'}
            />
            <View style={styles.divider} />
            <TextInput
              style={[styles.input, hasPhone && { color: '#8594AB' }]}
              placeholder="04120000000"
              placeholderTextColor="#B8C4D4"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              maxLength={11}
              selectionColor={tokens.colors.primary}
              editable={!loading && !hasPhone}
            />
          </View>

          <View style={{ flex: 1, minHeight: 32 }} />

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
            onPress={() => void handlePrimary()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Finalizar</Text>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <Text style={styles.footerLegal}>GOFARE • ONBOARDING</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ECF1F9' },
  blob: {
    position: 'absolute',
    top: 90,
    right: 24,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#B8C8DF',
    opacity: 0.6,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 36,
  },
  iconSection: { alignItems: 'center', marginBottom: 28 },
  fakeShadow: {
    position: 'absolute',
    width: 132,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#91B4E0',
    opacity: 0.3,
    top: 14,
    transform: [{ scaleX: 0.9 }],
  },
  iconCard: {
    width: 144,
    height: 132,
    backgroundColor: '#D6E5F8',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5080C0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: '#EBF4FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    opacity: 0.75,
  },
  titleBlock: { marginBottom: 20 },
  titleDark: {
    fontSize: 34,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#18243E',
    lineHeight: 40,
  },
  titleBlue: {
    fontSize: 34,
    fontFamily: tokens.typography.fontFamily.black,
    color: tokens.colors.primary,
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#6B7A93',
    lineHeight: 22,
  },
  emailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2EAF4',
  },
  emailHintText: {
    flex: 1,
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#6B7A93',
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#8594AB',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 56,
    marginBottom: 14,
    shadowColor: '#8594AB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2EAF4',
  },
  disabledInputCard: {
    backgroundColor: '#ECF1F9',
    borderColor: '#D4DEEC',
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: '#D4DEEC',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#18243E',
    includeFontPadding: false,
  },
  prefix: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: tokens.colors.primary,
    minWidth: 28,
  },
  cta: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 56,
    marginBottom: 20,
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  footerLegal: {
    textAlign: 'center',
    fontSize: 9.5,
    fontFamily: tokens.typography.fontFamily.black,
    color: '#B0BCCC',
    letterSpacing: 1.1,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { linkPhoneNumber } from '@/lib/api';
import {
  auth,
  linkPhoneWithCredential,
  sendLinkPhoneCode,
} from '@/lib/firebase';
import { tokens } from '@/theme/tokens';

interface PhoneLinkModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPhoneNumber?: string;
}

export function PhoneLinkModal({
  visible,
  onClose,
  onSuccess,
  initialPhoneNumber = '',
}: PhoneLinkModalProps) {
  const [phone, setPhone] = useState(initialPhoneNumber);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!/^((04|02)\d{9}|\+\d{10,15})$/.test(trimmed)) {
      Alert.alert(
        'Atención',
        'Ingresa un número venezolano válido (ej. 04120000000).',
      );
      return;
    }
    const e164 = trimmed.startsWith('+') ? trimmed : `+58${trimmed.slice(1)}`;
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoading(true);
      const vId = await sendLinkPhoneCode(e164);
      setVerificationId(vId);
      setStep('otp');
    } catch (error: any) {
      console.error('[PhoneLinkModal] sendCode error:', error);
      if (error?.code === 'auth/invalid-phone-number') {
        Alert.alert('Error', 'El número de teléfono no es válido.');
      } else if (error?.code === 'auth/too-many-requests') {
        Alert.alert('Error', 'Demasiados intentos. Intenta más tarde.');
      } else if (error?.code === 'auth/credential-already-in-use') {
        Alert.alert(
          'Error',
          'Este número de teléfono ya está vinculado a otra cuenta.',
        );
      } else {
        Alert.alert(
          'Error',
          error?.message ?? 'No se pudo enviar el código SMS.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.trim().length < 6) {
      Alert.alert(
        'Atención',
        'El código de verificación debe tener 6 dígitos.',
      );
      return;
    }
    const user = auth.currentUser;
    if (!user || !verificationId) return;

    try {
      setLoading(true);
      await linkPhoneWithCredential(verificationId, otp.trim());
      const firebaseToken = await user.getIdToken(true);
      await linkPhoneNumber(firebaseToken);
      Alert.alert(
        'Éxito',
        'Tu teléfono ha sido vinculado y verificado correctamente.',
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[PhoneLinkModal] verifyCode error:', error);
      Alert.alert('Error', error?.message ?? 'Código incorrecto o inválido.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPhone(initialPhoneNumber);
    setOtp('');
    setStep('phone');
    setVerificationId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Vincular Teléfono</Text>
            <Pressable onPress={handleCancel} hitSlop={10}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>
          <Text style={styles.description}>
            {step === 'phone'
              ? 'Se requiere un número verificado por SMS para realizar pagos y adquirir fares.'
              : 'Ingresa el código de 6 dígitos enviado a tu teléfono por SMS.'}
          </Text>

          {step === 'phone' ? (
            <View style={styles.inputContainer}>
              <Ionicons
                name="call-outline"
                size={20}
                color="#3B82F6"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="04140000000"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={11}
                editable={!loading}
              />
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <Ionicons
                name="keypad-outline"
                size={20}
                color="#3B82F6"
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { letterSpacing: 4, fontSize: 18 }]}
                placeholder="000000"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                editable={!loading}
              />
            </View>
          )}

          <Pressable
            style={styles.ctaButton}
            onPress={step === 'phone' ? handleSendCode : handleVerifyCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>
                {step === 'phone'
                  ? 'Enviar Código SMS'
                  : 'Confirmar y Vincular'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#0F172A',
  },
  description: {
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.regular,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.medium,
    color: '#0F172A',
  },
  ctaButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D5BD9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: tokens.typography.fontFamily.bold,
  },
});

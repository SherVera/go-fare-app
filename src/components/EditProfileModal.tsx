import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
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
import { updateBackendProfile, updateOwnNationalId } from '@/lib/api';
import { tokens } from '@/theme/tokens';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userUuid?: string;
  currentFullName?: string;
  currentNationalId?: string;
}

const NATIONALITY_OPTIONS = ['V', 'E', 'J', 'P'];

export function EditProfileModal({
  visible,
  onClose,
  onSuccess,
  userUuid,
  currentFullName = '',
  currentNationalId = 'V-00000000',
}: EditProfileModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationality, setNationality] = useState('V');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      // Separar el nombre completo en firstName y lastName
      const parts = currentFullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(' '));
      } else {
        setFirstName(currentFullName);
        setLastName('');
      }

      // Parsear la cédula si tiene formato "V-123456"
      if (currentNationalId.includes('-')) {
        const [prefix, num] = currentNationalId.split('-');
        if (NATIONALITY_OPTIONS.includes(prefix.toUpperCase())) {
          setNationality(prefix.toUpperCase());
        }
        setIdNumber(num || '');
      } else {
        setIdNumber(currentNationalId);
      }
    }
  }, [visible, currentFullName, currentNationalId]);

  const handleSave = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedId = idNumber.trim().replace(/[^0-9]/g, '');

    if (trimmedFirstName.length < 2) {
      Alert.alert('Atención', 'El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (trimmedLastName.length < 2) {
      Alert.alert('Atención', 'El apellido debe tener al menos 2 caracteres.');
      return;
    }
    if (!/^\d{5,10}$/.test(trimmedId)) {
      Alert.alert(
        'Atención',
        'La cédula debe contener entre 5 y 10 dígitos numéricos.',
      );
      return;
    }

    const calculatedDisplayName = `${trimmedFirstName} ${trimmedLastName}`;
    const finalNationalId = `${nationality}-${trimmedId}`;

    try {
      setLoading(true);

      // 1. Actualizar nombres en el backend via PUT /users/:id
      if (userUuid) {
        await updateBackendProfile(userUuid, {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName: calculatedDisplayName,
          nationalId: finalNationalId,
        });
      }

      // 2. Actualizar cédula en el backend via PATCH /auth/me/national-id
      try {
        await updateOwnNationalId(finalNationalId);
      } catch (natErr) {
        console.warn(
          '[EditProfileModal] Error al actualizar nationalId:',
          natErr,
        );
      }

      // 3. Guardar en la caché local AsyncStorage
      try {
        const cached = await AsyncStorage.getItem('gofare_cached_user_profile');
        const parsed = cached ? JSON.parse(cached) : {};
        const updatedCache = {
          ...parsed,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName: calculatedDisplayName,
          fullName: calculatedDisplayName,
          nationalId: finalNationalId,
          idNumber: finalNationalId,
        };
        await AsyncStorage.setItem(
          'gofare_cached_user_profile',
          JSON.stringify(updatedCache),
        );
      } catch (cacheErr) {
        console.warn(
          '[EditProfileModal] Error guardando en caché local:',
          cacheErr,
        );
      }

      Alert.alert('Éxito', 'Tu perfil ha sido actualizado correctamente.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[EditProfileModal] Error al guardar perfil:', error);
      Alert.alert(
        'Error',
        error?.message || 'No se pudo actualizar el perfil.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Editar Perfil</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          {/* Nombre */}
          <Text style={styles.label}>NOMBRES</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ingresa tus nombres"
            placeholderTextColor="#94A3B8"
          />

          {/* Apellido */}
          <Text style={styles.label}>APELLIDOS</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Ingresa tus apellidos"
            placeholderTextColor="#94A3B8"
          />

          {/* Cédula */}
          <Text style={styles.label}>CÉDULA DE IDENTIDAD</Text>
          <View style={styles.idRow}>
            <View style={styles.nationalityContainer}>
              {NATIONALITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={({ pressed }) => [
                    styles.nationalityBadge,
                    nationality === opt && styles.nationalityBadgeActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setNationality(opt)}
                >
                  <Text
                    style={[
                      styles.nationalityText,
                      nationality === opt && styles.nationalityTextActive,
                    ]}
                  >
                    {opt}-
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.idInput]}
              value={idNumber}
              onChangeText={setIdNumber}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="Número de cédula"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Botones de acción */}
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[styles.saveBtn, loading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  idRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  nationalityContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 2,
    marginBottom: 16,
  },
  nationalityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nationalityBadgeActive: {
    backgroundColor: tokens.colors.primary,
  },
  nationalityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  nationalityTextActive: {
    color: '#FFFFFF',
  },
  idInput: {
    flex: 1,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: tokens.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

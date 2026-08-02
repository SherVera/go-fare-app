import { Alert, Clipboard as RNClipboard } from 'react-native';

/**
 * Copia un texto al portapapeles de forma segura.
 * Utiliza expo-clipboard si la librería nativa está enlazada o la implementación
 * nativa de React Native / Alerta como respaldo sin provocar cierres en tiempo de ejecución.
 */
export async function setClipboardText(
  text: string,
  label?: string,
): Promise<void> {
  let copied = false;

  // 1. Intentar con expo-clipboard si el binario nativo lo contiene
  try {
    const ExpoClipboard = require('expo-clipboard');
    if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === 'function') {
      await ExpoClipboard.setStringAsync(text);
      copied = true;
    }
  } catch (_e) {
    // Si no está disponible en la build nativa actual de Expo, continuamos al fallback
  }

  // 2. Fallback con React Native Clipboard
  if (!copied) {
    try {
      if (RNClipboard && typeof RNClipboard.setString === 'function') {
        RNClipboard.setString(text);
        copied = true;
      }
    } catch (_e2) {
      console.warn('[Clipboard] Fallback no disponible');
    }
  }

  // 3. Notificación al usuario
  if (label) {
    Alert.alert('¡Copiado!', `${label} copiado al portapapeles:\n${text}`);
  }
}

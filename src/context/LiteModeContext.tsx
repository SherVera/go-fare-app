import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

const LITE_MODE_STORAGE_KEY = '@gofare_lite_mode';

interface LiteModeContextType {
  isLiteMode: boolean;
  setLiteMode: (enabled: boolean) => Promise<void>;
  toggleLiteMode: () => Promise<void>;
}

const LiteModeContext = createContext<LiteModeContextType>({
  isLiteMode: false,
  setLiteMode: async () => {},
  toggleLiteMode: async () => {},
});

export const LiteModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLiteMode, setIsLiteModeState] = useState<boolean>(false);

  useEffect(() => {
    const loadLiteMode = async () => {
      try {
        const value = await AsyncStorage.getItem(LITE_MODE_STORAGE_KEY);
        if (value !== null) {
          setIsLiteModeState(value === 'true');
        }
      } catch (error) {
        console.warn(
          '[LiteMode] Error al cargar preferencia de Lite Mode:',
          error,
        );
      }
    };
    loadLiteMode();
  }, []);

  const setLiteMode = async (enabled: boolean) => {
    try {
      setIsLiteModeState(enabled);
      await AsyncStorage.setItem(
        LITE_MODE_STORAGE_KEY,
        enabled ? 'true' : 'false',
      );
    } catch (error) {
      console.warn(
        '[LiteMode] Error al guardar preferencia de Lite Mode:',
        error,
      );
    }
  };

  const toggleLiteMode = async () => {
    await setLiteMode(!isLiteMode);
  };

  return (
    <LiteModeContext.Provider
      value={{
        isLiteMode,
        setLiteMode,
        toggleLiteMode,
      }}
    >
      {children}
    </LiteModeContext.Provider>
  );
};

export const useLiteMode = () => useContext(LiteModeContext);

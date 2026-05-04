#!/bin/bash
# Script para compilar y correr GoFare en Android correctamente
# Uso: bash run.sh

export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="C:/Users/sirfu/AppData/Local/Android/Sdk"

# Recrear local.properties por si fue borrado
echo "sdk.dir=C\:\\\\Users\\\\sirfu\\\\AppData\\\\Local\\\\Android\\\\Sdk" > android/local.properties

# Matar procesos Gradle colgados
taskkill //F //IM java.exe //T 2>/dev/null || true
sleep 2

# Compilar e instalar
npx expo run:android

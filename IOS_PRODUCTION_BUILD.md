# GoFare — Instalar la app en iPhone desde cero

Guía **completa**, paso a paso, para alguien **sin experiencia en programación** que parte de una Mac vacía (sin herramientas instaladas) y quiere instalar la app GoFare en un iPhone físico.

**Tiempo estimado total:** 2–4 horas la primera vez (la mayor parte es descargar Xcode).

---

## Índice

1. [Contexto: qué puedes y qué no puedes hoy](#1-contexto-qué-puedes-y-qué-no-puedes-hoy)
2. [Qué necesitas antes de empezar](#2-qué-necesitas-antes-de-empezar)
3. [Abrir la Terminal por primera vez](#3-abrir-la-terminal-por-primera-vez)
4. [Instalar Xcode](#4-instalar-xcode)
5. [Instalar herramientas de línea de comandos de Apple](#5-instalar-herramientas-de-línea-de-comandos-de-apple)
6. [Instalar Homebrew](#6-instalar-homebrew)
7. [Instalar Node.js](#7-instalar-nodejs)
8. [Verificar que Git funciona](#8-verificar-que-git-funciona)
9. [Descargar el código de GoFare](#9-descargar-el-código-de-gofare)
10. [Instalar dependencias del proyecto](#10-instalar-dependencias-del-proyecto)
11. [Copiar archivos de Firebase](#11-copiar-archivos-de-firebase)
12. [Crear y completar el archivo .env](#12-crear-y-completar-el-archivo-env)
13. [Generar el proyecto iOS nativo (prebuild)](#13-generar-el-proyecto-ios-nativo-prebuild)
14. [Preparar el iPhone](#14-preparar-el-iphone)
15. [Configurar firma en Xcode](#15-configurar-firma-en-xcode)
16. [Compilar e instalar la app (Release)](#16-compilar-e-instalar-la-app-release)
17. [Activar la app en el iPhone](#17-activar-la-app-en-el-iphone)
18. [Reinstalar cuando la app expire](#18-reinstalar-cuando-la-app-expire)
19. [Problemas frecuentes](#19-problemas-frecuentes)
20. [Cuando GoFare tenga cuenta Apple de pago](#20-cuando-gofare-tenga-cuenta-apple-de-pago)
21. [Glosario](#21-glosario)

---

## 1. Contexto: qué puedes y qué no puedes hoy

GoFare **aún no tiene** cuenta de pago del [Apple Developer Program](https://developer.apple.com/programs/) ($99 USD/año).

Usarás tu **Apple ID normal** (iCloud, gratis) como “Personal Team”. Eso permite pruebas, con limitaciones:

| ✅ Sí puedes | ❌ No puedes (hasta pagar Apple) |
|-------------|----------------------------------|
| Instalar GoFare en un iPhone con cable | Publicar en App Store |
| App que abre sola (Release) | TestFlight |
| Probar login, mapas, QR, etc. | Notificaciones push |
| iPhone de otra persona (conectado a tu Mac) | Enviar link de instalación remota |

**Limitaciones a recordar:**

- La app **caduca en ~7 días** → reinstalar conectando el iPhone a la Mac.
- Máximo **3 iPhones distintos por año** por Apple ID.
- El iPhone debe estar **conectado por cable USB** a tu Mac para instalar.

---

## 2. Qué necesitas antes de empezar

### Hardware y cuentas

| Item | Detalle |
|------|---------|
| **Mac** | MacBook o iMac con macOS actualizado |
| **Espacio en disco** | Al menos **20 GB libres** (Xcode ocupa ~12 GB) |
| **Internet** | Wi‑Fi estable durante toda la instalación |
| **Apple ID** | Tu cuenta iCloud (gratis). La usarás en Xcode |
| **iPhone** | Cualquier iPhone compatible, con cable USB (Lightning o USB‑C) |
| **Cable** | Que conecte el iPhone a la Mac |

### Materiales que debes pedir al admin de GoFare

Antes de empezar, consigue esto por email/Drive/1Password:

- [ ] Acceso al repositorio **o** un archivo `.zip` del proyecto `go-fare-app`
- [ ] Archivo **`GoogleService-Info.plist`**
- [ ] Archivo **`google-services.json`**
- [ ] Valores para el archivo `.env`:
  - `GOOGLE_MAPS_IOS_API_KEY`
  - `GOOGLE_MAPS_ANDROID_API_KEY`
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

**Plantilla de mensaje al admin:**

```
Hola, voy a instalar GoFare en un iPhone desde cero.
¿Me puedes enviar?

1. Link del repo go-fare-app (o zip del código)
2. GoogleService-Info.plist
3. google-services.json
4. Valores para .env (Maps keys, API URL, Google Web Client ID)

Gracias.
```

---

## 3. Abrir la Terminal por primera vez

La **Terminal** es una app de la Mac donde escribes comandos de texto. Todos los pasos de instalación usan la Terminal.

### Cómo abrirla

1. Pulsa **⌘ + Espacio** (Command + barra espaciadora).
2. Escribe: `Terminal`
3. Pulsa **Enter**.

Verás una ventana con fondo oscuro o claro y un cursor parpadeando. Algo como:

```
tu-nombre@MacBook-Pro ~ %
```

### Cómo pegar comandos

1. **Copia** el bloque de código de esta guía (selecciona → ⌘+C).
2. En la Terminal, pulsa **⌘+V** para pegar.
3. Pulsa **Enter** para ejecutar.

> **No escribas los comandos a mano** si puedes copiarlos: un espacio de más puede causar errores.

### Comandos básicos que usarás

| Comando | Qué hace |
|---------|----------|
| `cd carpeta` | Entrar en una carpeta |
| `cd ..` | Subir un nivel |
| `ls` | Listar archivos de la carpeta actual |
| `pwd` | Mostrar en qué carpeta estás |

Si un comando falla, **lee el mensaje de error**, no cierres la Terminal, y busca el error en la [sección 19](#19-problemas-frecuentes).

---

## 4. Instalar Xcode

Xcode es la herramienta de Apple para compilar apps iOS. Es **gratis**, pero grande.

### Paso 4.1 — Descargar desde App Store

1. Abre **App Store** (icono azul con la A).
2. Busca: **Xcode**
3. Pulsa **Obtener** / **Instalar**.
4. Espera la descarga (**30 min – 2 horas** según tu internet).
5. Si pide contraseña de Apple ID, introdúcela.

### Paso 4.2 — Abrir Xcode la primera vez

1. Abre **Xcode** desde Aplicaciones o Spotlight (⌘+Espacio → `Xcode`).
2. Acepta la **licencia** si aparece.
3. Si pregunta por “Additional Components”, pulsa **Install** y espera.
4. Puedes cerrar Xcode después; no necesitas crear ningún proyecto.

### Paso 4.3 — Verificar instalación

En **Terminal**:

```bash
xcodebuild -version
```

Debe mostrar algo como:

```
Xcode 16.x
Build version ...
```

Si dice `command not found`, Xcode no terminó de instalarse o no se abrió al menos una vez.

---

## 5. Instalar herramientas de línea de comandos de Apple

En **Terminal**:

```bash
xcode-select --install
```

- Si aparece una ventana → pulsa **Instalar** → Aceptar → espera.
- Si dice *“can't install the software because it is not currently available”*, probablemente ya están instaladas. Continúa.

Acepta la licencia:

```bash
sudo xcodebuild -license accept
```

> `sudo` puede pedir la **contraseña de tu Mac** (la que usas para iniciar sesión). Al escribirla **no verás caracteres** en pantalla; es normal. Pulsa Enter.

---

## 6. Instalar Homebrew

**Homebrew** instala programas en la Mac desde la Terminal (como Node.js).

En **Terminal**, pega **todo este bloque** y pulsa Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- Pulsa **Enter** cuando pregunte.
- Escribe tu contraseña de Mac si la pide.
- Al terminar, la Terminal puede mostrar **dos líneas** que debes copiar y ejecutar. Se ven así:

```
==> Next steps:
- Run these two commands in your terminal to add Homebrew to your PATH:
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Copia y ejecuta esas dos líneas** si aparecen.

Verifica:

```bash
brew --version
```

Debe mostrar `Homebrew 4.x.x` o similar.

---

## 7. Instalar Node.js

**Node.js** ejecuta el código JavaScript del proyecto y trae **npm** (instalador de dependencias).

En **Terminal**:

```bash
brew install node@20
```

Cuando termine:

```bash
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Verifica **Node** y **npm**:

```bash
node --version
npm --version
```

Debes ver:

```
v20.x.x
10.x.x
```

Si `node --version` falla, cierra la Terminal, ábrela de nuevo y repite el bloque `echo` + `source`.

---

## 8. Verificar que Git funciona

**Git** descarga el código del proyecto. Viene con Xcode; solo verificamos:

```bash
git --version
```

Debe mostrar `git version 2.x.x`.

Si falla:

```bash
brew install git
```

---

## 9. Descargar el código de GoFare

Elige **una** opción.

### Opción A — Con Git (si el admin te dio un link del repo)

```bash
cd ~/Desktop
git clone <PEGA-AQUÍ-LA-URL-DEL-REPO>
cd go-fare-app
```

Ejemplo de URL: `https://github.com/tu-org/go-fare-app.git`

Verifica que estás en la carpeta correcta:

```bash
pwd
ls
```

Debes ver archivos como `package.json`, `app.config.ts`, `README.md`.

### Opción B — Con archivo ZIP (sin Git)

1. Descarga el `.zip` que te envió el admin.
2. Haz doble clic para descomprimirlo en el **Escritorio**.
3. En Terminal:

```bash
cd ~/Desktop/go-fare-app
```

> Si la carpeta tiene otro nombre, ajusta el comando. Usa `ls ~/Desktop` para ver el nombre exacto.

---

## 10. Instalar dependencias del proyecto

Estando dentro de `go-fare-app` (comprueba con `pwd`):

```bash
npm install
```

**Qué esperar:**

- Tarda **3–10 minutos** la primera vez.
- Verás muchas líneas de texto; es normal.
- Al final debe volver el prompt (`%`) sin decir `ERR!`.

Si hay errores de red, verifica Wi‑Fi y repite:

```bash
npm install
```

---

## 11. Copiar archivos de Firebase

El admin te envió dos archivos. **No vienen en git**; debes copiarlos tú.

### Paso 11.1 — Ubicación correcta

Los archivos deben quedar **dentro** de la carpeta `go-fare-app`, al mismo nivel que `package.json`:

```
Desktop/
└── go-fare-app/
    ├── GoogleService-Info.plist    ← aquí
    ├── google-services.json        ← aquí
    ├── package.json
    ├── app.config.ts
    └── ...
```

### Paso 11.2 — Cómo copiarlos

1. Abre **Finder** → Escritorio → `go-fare-app`.
2. Arrastra `GoogleService-Info.plist` y `google-services.json` a esa carpeta.

### Paso 11.3 — Verificar en Terminal

```bash
cd ~/Desktop/go-fare-app
ls GoogleService-Info.plist google-services.json
```

Debe listar los dos archivos. Si dice `No such file`, están en la carpeta equivocada.

---

## 12. Crear y completar el archivo .env

El archivo `.env` guarda configuración secreta (URLs, claves de mapas).

### Paso 12.1 — Crear desde la plantilla

```bash
cd ~/Desktop/go-fare-app
cp .env.example .env
```

### Paso 12.2 — Editar el archivo

**Opción fácil — TextEdit:**

```bash
open -a TextEdit .env
```

Completa con los valores que te pasó el admin. Debe quedar **similar** a esto (con tus valores reales):

```env
GOOGLE_MAPS_IOS_API_KEY=AIzaSy...tu-clave...
GOOGLE_MAPS_ANDROID_API_KEY=AIzaSy...tu-clave...
EXPO_PUBLIC_API_URL=https://go-fare-backend-1.onrender.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
EAS_PROJECT_ID=1e738e60-7dd4-48be-b8f6-dd713dee3b67

# Obligatorio sin cuenta Apple de pago:
IOS_PERSONAL_TEAM_BUILD=1
```

**Reglas:**

- Sin espacios alrededor del `=`.
- Sin comillas en los valores.
- **`IOS_PERSONAL_TEAM_BUILD=1` es obligatorio** sin cuenta de pago (permite firmar sin push).
- Guarda el archivo (⌘+S) y cierra TextEdit.

### Paso 12.3 — Verificar

```bash
grep IOS_PERSONAL_TEAM_BUILD .env
```

Debe mostrar: `IOS_PERSONAL_TEAM_BUILD=1`

---

## 13. Generar el proyecto iOS nativo (prebuild)

Este comando crea la carpeta `ios/` con el proyecto que Xcode compila:

```bash
cd ~/Desktop/go-fare-app
npm run prebuild
```

**Qué esperar:**

- Tarda **2–5 minutos**.
- Al final debe decir algo como `Finished prebuild`.
- Si falla por Firebase, vuelve al [paso 11](#11-copiar-archivos-de-firebase).

Verifica:

```bash
ls ios
```

Debe existir la carpeta `ios` con contenido.

---

## 14. Preparar el iPhone

El iPhone puede ser de otra persona, pero **debe estar conectado a tu Mac** con cable.

### Paso 14.1 — Conectar

1. Conecta iPhone a la Mac con cable USB.
2. **Desbloquea** el iPhone.
3. Si pregunta **“¿Confiar en este ordenador?”** → **Confiar** → código del iPhone si pide.

### Paso 14.2 — Modo desarrollador (iOS 16 o posterior)

1. En el iPhone: **Ajustes → Privacidad y seguridad**.
2. Baja hasta **Modo desarrollador**.

**Si NO aparece** (normal la primera vez):

1. Deja el iPhone conectado.
2. Continúa al [paso 15](#15-configurar-firma-en-xcode) y [16](#16-compilar-e-instalar-la-app-release).
3. Después de intentar compilar, **cierra Ajustes por completo** (desliza hacia arriba en el conmutador de apps) y vuelve a abrirlo.
4. Activa **Modo desarrollador → Reiniciar → Activar**.

---

## 15. Configurar firma en Xcode

### Paso 15.1 — Abrir el proyecto

En Terminal:

```bash
cd ~/Desktop/go-fare-app
open ios/GoFare.xcworkspace
```

> Importante: abre **`.xcworkspace`**, no `.xcodeproj`.

Se abre Xcode con el proyecto GoFare.

### Paso 15.2 — Iniciar sesión con Apple ID (si no lo hiciste)

1. Menú **Xcode → Settings…** (o **Preferences**).
2. Pestaña **Accounts**.
3. Pulsa **+** → **Apple ID** → inicia sesión con tu Apple ID (iCloud).

### Paso 15.3 — Configurar firma automática

1. Panel **izquierdo** → icono azul **GoFare** (el de arriba).
2. En el centro, bajo **TARGETS**, selecciona **GoFare**.
3. Pestaña **Signing & Capabilities**.
4. Marca ✅ **Automatically manage signing**.
5. En **Team**, elige tu nombre + **(Personal Team)**.
   - Ejemplo: *Germán Vera (Personal Team)*.
6. **Bundle Identifier** debe ser: `com.gofare.app`.

Si hay error rojo, léelo:

- *Failed to register bundle identifier* → espera unos segundos o cambia temporalmente a `com.gofare.app.test` (solo si el admin lo autoriza).
- *Signing requires a development team* → selecciona Personal Team en el paso 5.

### Paso 15.4 — Seleccionar el iPhone

Arriba en Xcode, en la barra central, haz clic donde dice un simulador (ej. “iPhone 16”) y elige **tu iPhone físico** (nombre del dispositivo, con icono de móvil).

Si no aparece el iPhone:

- Desbloquea el teléfono.
- Reconecta el cable.
- En iPhone: Confiar en el ordenador.

---

## 16. Compilar e instalar la app (Release)

**Release** = la app abre directo, **sin** pedir conectar a la laptop.

### Opción A — Terminal (recomendada)

Cierra Xcode o déjalo abierto. En Terminal:

```bash
cd ~/Desktop/go-fare-app
npx expo run:ios --device --configuration Release
```

**Qué pasa:**

1. Puede pedirte **elegir el dispositivo** → selecciona tu iPhone.
2. Compila (**10–25 minutos** la primera vez). Verás muchas líneas; es normal.
3. Al terminar, la app **GoFare** aparece en el iPhone.

### Opción B — Desde Xcode

1. Menú **Product → Scheme → Edit Scheme…**
2. Izquierda: **Run** → **Build Configuration** → **Release** → **Close**.
3. Pulsa **▶ Run** (o ⌘+R).

### Si falla al final con “failed to launch” o “not trusted”

La app **sí puede estar instalada**. Ve al [paso 17](#17-activar-la-app-en-el-iphone).

---

## 17. Activar la app en el iPhone

Haz esto **en el iPhone** (tú o la persona dueña del teléfono):

### Paso 17.1 — Confiar en el desarrollador

1. **Ajustes → General → VPN y gestión de dispositivos**
   - En algunos iOS: **Gestión de dispositivos** o **Perfiles y gestión de dispositivos**.
2. Bajo **APPS DE DESARROLLADOR**, toca tu nombre (ej. *Germán Vera*).
3. **Confiar en "…"** → Confirmar.

### Paso 17.2 — Abrir la app

1. Busca el icono **GoFare** en la pantalla de inicio.
2. Tócalo **desde el iPhone** (no desde la Mac).

Si abre correctamente → **listo**.

### Paso 17.3 — Instrucciones para enviar a quien tenga el iPhone (remoto)

Copia y envía:

```
Para usar GoFare en tu iPhone:

1. Ajustes → Privacidad y seguridad → Modo desarrollador → Activado
   (si no aparece, avísame)

2. Ajustes → General → VPN y gestión de dispositivos
   → Toca mi nombre → Confiar

3. Abre la app GoFare desde el icono

Nota: la app caduca en ~7 días. Para renovarla necesito
conectar tu iPhone a mi Mac otra vez con cable.
```

---

## 18. Reinstalar cuando la app expire

Cada **~7 días** (Personal Team gratis) la app dejará de abrir.

1. Conecta el iPhone a la Mac.
2. En Terminal:

```bash
cd ~/Desktop/go-fare-app
npx expo run:ios --device --configuration Release
```

3. Vuelve a **Confiar** en Ajustes si iOS lo pide.

No hace falta repetir pasos 4–13 salvo que borres el proyecto o cambies `.env`.

---

## 19. Problemas frecuentes

| Error / síntoma | Solución |
|-----------------|----------|
| `command not found: brew` | Repite [paso 6](#6-instalar-homebrew) — las líneas “Next steps” del PATH |
| `command not found: node` | Repite [paso 7](#7-instalar-nodejs); cierra y abre Terminal |
| `Missing Firebase file(s)` | [Paso 11](#11-copiar-archivos-de-firebase) — archivos en la raíz de `go-fare-app` |
| `No profiles for com.gofare.app` | Pon `IOS_PERSONAL_TEAM_BUILD=1` en `.env` → `npm run prebuild` → Personal Team en Xcode |
| `Push Notifications capability` | Igual: `IOS_PERSONAL_TEAM_BUILD=1` + `npm run prebuild` |
| `Developer Mode disabled` | Modo desarrollador en iPhone ([paso 14.2](#142--modo-desarrollador-ios-16-o-posterior)) |
| `not been explicitly trusted` | [Paso 17.1](#paso-171--confiar-en-el-desarrollador) |
| No veo Modo desarrollador | Conecta iPhone, compila una vez, reinicia Ajustes |
| La app pide “Connect to Metro” | Usaste Debug; repite con `--configuration Release` |
| Compilación tarda mucho | Normal 10–25 min la primera vez |
| `npm install` falla | Verifica internet; borra `node_modules` y repite: `rm -rf node_modules && npm install` |
| iPhone no aparece en Xcode | Cable, desbloquear, Confiar, reconectar |

---

## 20. Cuando GoFare tenga cuenta Apple de pago

Con el [Apple Developer Program](https://developer.apple.com/programs/) ($99/año) podrás:

- Notificaciones **push**
- **TestFlight** (testers sin cable)
- App Store
- App que **no caduca a los 7 días**

### Cambios en el proyecto

1. En `.env`, quita o comenta:
   ```env
   # IOS_PERSONAL_TEAM_BUILD=1
   ```
2. Regenera iOS:
   ```bash
   npm run prebuild
   ```
3. Instala EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   eas build --platform ios --profile production
   eas submit --platform ios --profile production
   ```

Los testers instalarán vía **TestFlight** sin necesitar tu Mac ni cable.

---

## 21. Glosario

| Término | Qué es |
|---------|--------|
| **Terminal** | App de la Mac para escribir comandos |
| **Xcode** | Programa de Apple para compilar apps iOS |
| **Homebrew** | Instalador de herramientas (`brew install …`) |
| **Node.js / npm** | Motor JavaScript e instalador de librerías del proyecto |
| **Git** | Descarga código desde un repositorio |
| **npm install** | Descarga dependencias del proyecto (carpeta `node_modules`) |
| **prebuild** | Genera la carpeta `ios/` nativa |
| **Personal Team** | Cuenta Apple ID gratis para pruebas limitadas |
| **Release** | Build final empaquetado; abre sin la laptop |
| **.env** | Archivo de configuración secreta (claves, URLs) |
| **Firebase** | Servicio de Google (login; push requiere cuenta de pago) |

---

## Hoja de ruta rápida (todos los comandos en orden)

Para quien ya leyó la guía y solo necesita la secuencia:

```bash
# 1. Herramientas (una sola vez)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
xcode-select --install
sudo xcodebuild -license accept
# + Instalar Xcode desde App Store (manual)

# 2. Proyecto
cd ~/Desktop
git clone <URL-REPO> && cd go-fare-app   # o cd a carpeta descomprimida
npm install
cp .env.example .env                       # editar con TextEdit + IOS_PERSONAL_TEAM_BUILD=1
# Copiar GoogleService-Info.plist y google-services.json a esta carpeta

# 3. Build iOS
npm run prebuild
open ios/GoFare.xcworkspace                # Personal Team + iPhone en Xcode
npx expo run:ios --device --configuration Release

# 4. En el iPhone: Confiar desarrollador → Abrir GoFare
```

---

¿Atascado? Envía al equipo GoFare: captura del error, en qué paso estás, y la salida de `xcodebuild -version` y `node --version`.

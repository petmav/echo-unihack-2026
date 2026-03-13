# Echo — Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Framer Motion.

Mobile-first. 375 px baseline. Runs as a web app or as a native Android APK via Capacitor.

---

## Running locally (web)

```bash
npm install
npm run dev          # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` in a `.env.local` file to point at the backend:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Building the Android APK

### Prerequisites

#### 1. Android Studio (required for the Gradle build)

Download from https://developer.android.com/studio and run the installer.
Accept all default SDK components. This installs:
- Android SDK (API 34 by default)
- Gradle (bundled)
- ADB (Android Debug Bridge)
- **JDK 17** (bundled — this is the JDK the build scripts will use)

After installing, **open Android Studio once** so it can finish downloading SDK components. The build scripts pin Gradle to Android Studio's bundled JDK automatically (see `scripts/setup-android.js`) — you do not need to install a separate JDK or change `JAVA_HOME`.

> **If you see `Unsupported class file major version 69` (or any similar version error)**:
> This means Gradle picked up your system Java (Java 25 produces version 69) instead of
> the Android Studio JDK. Run `node scripts/setup-android.js` from the `frontend/`
> directory — it detects Android Studio's bundled JDK and writes `org.gradle.java.home`
> into `android/gradle.properties`. The `build:apk` script does this automatically.

#### 2. Enable USB debugging on your phone

1. Open **Settings → About phone**
2. Tap **Build number** 7 times to unlock Developer Options
3. Go to **Settings → Developer Options → USB Debugging** and enable it
4. Connect phone to laptop via USB and accept the RSA fingerprint prompt

#### 3. Scaffold the Android project (first time only)

```bash
cd frontend
npm run cap:setup       # runs cap add android + patches gradle.properties with the right JDK
```

The `android/` directory is gitignored (it's generated, ~50 MB). Run this once per machine. `cap:setup` is idempotent — re-running it is safe.

---

### Option A — CI/CD (recommended)

The `Build Android APK` GitHub Actions workflow builds the APK automatically:

- **Automatic**: triggers on every push to `main` that touches `frontend/`
- **Manual**: go to **Actions → Build Android APK → Run workflow** and optionally paste an API URL

The backend URL is baked into the static export at build time. Set it once as a **repository secret**:

```
Settings → Secrets and variables → Actions → New repository secret
Name:  NEXT_PUBLIC_API_URL
Value: https://your-backend.fly.dev/api/v1
```

When the workflow completes, download the APK from the **Artifacts** section of the run and install it:

```bash
adb install app-debug.apk
```

---

### Option B — Local build

Use this when you want the APK to talk to the backend on your **local machine over WiFi** (phone and laptop on the same network).

#### 1. Find your LAN IP

```powershell
ipconfig
# Look for: Wi-Fi adapter → IPv4 Address → e.g. 192.168.1.100
```

`localhost` will NOT work — on the phone, localhost refers to the phone itself.

#### 2. Build the static export

```bash
cd frontend
cross-env NEXT_OUTPUT=export NEXT_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1 npx next build
```

Or using the npm script (same thing):
```bash
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000/api/v1 npm run build:mobile
```

> If you switch WiFi networks the LAN IP may change — rebuild the APK with the new IP.

#### 3. Sync and build

```bash
npx cap sync android

cd android
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 4. Install on phone

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK file to the phone and open it from Files.

---

## Build scripts reference

| Script | What it does |
|--------|--------------|
| `npm run dev` | Next.js dev server at localhost:3000 |
| `npm run build` | Production build (standalone, for Docker) |
| `npm run build:mobile` | Static export (`out/`) for Capacitor |
| `npm run cap:setup` | `cap add android` + patches `gradle.properties` with Android Studio JDK |
| `npm run cap:sync` | Sync `out/` into the Android project |
| `npm run cap:open` | Open Android project in Android Studio |
| `npm run build:apk` | Full pipeline: export → sync → JDK patch → Gradle debug APK |
| `npm run lint` | ESLint |

---

## Capacitor config

See `capacitor.config.ts`. Key settings:

| Setting | Value | Reason |
|---------|-------|--------|
| `webDir` | `out` | Next.js static export output directory |
| `androidScheme` | `https` | Required for Web Crypto API (secure context) |
| `allowMixedContent` | `true` | Allows HTTP backend during local demo |
| `StatusBar.backgroundColor` | `#FAF7F2` | Matches Echo's beige theme |

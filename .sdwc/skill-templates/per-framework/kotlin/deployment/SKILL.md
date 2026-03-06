# Deployment — Kotlin (Android)

> This skill defines deployment rules for the **{{ name }}** service.
> Distribution: **{{ distribution }}** | Update: **{{ update_strategy }}**

---

## 1. Build & Package

```bash
# Debug APK
./gradlew assembleDebug

# Release APK
./gradlew assembleRelease

# Release App Bundle (preferred for Play Store)
./gradlew bundleRelease
```

**Rules:**
- Always commit `gradle.lockfile` (if dependency locking is enabled).
- Pin dependency versions in `libs.versions.toml` (version catalog).
- Use App Bundle (`.aab`) for Play Store — APK only for direct distribution.
- Enable R8 minification and resource shrinking for release builds.

```kotlin
// app/build.gradle.kts
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
```

---

## 2. App Signing

- Use **debug.keystore** (auto-generated) for development.
- Use a dedicated **release keystore** for distribution.
- Store keystore file outside the repo.

```kotlin
// app/build.gradle.kts
android {
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("RELEASE_STORE_FILE") ?: "release.keystore")
            storePassword = System.getenv("RELEASE_STORE_PASSWORD")
            keyAlias = System.getenv("RELEASE_KEY_ALIAS")
            keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

**Rules:**
- Never hardcode signing credentials in build files.
- Back up the release keystore securely — losing it means you cannot update the app.
- Use **Play App Signing** (Google manages the upload key) for additional safety.

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Use build flavors or `buildConfigField` for environment variables:**

```kotlin
// app/build.gradle.kts
android {
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"https://api.production.com\"")
        }
    }
}
```

```kotlin
// Access in code
val apiUrl = BuildConfig.API_BASE_URL
```

**With product flavors (multiple environments):**

```kotlin
android {
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000\"")
        }
        create("prod") {
            dimension = "environment"
            buildConfigField("String", "API_BASE_URL", "\"https://api.production.com\"")
        }
    }
}
```

**Rules:**
- Never embed secrets in the app bundle — they can be extracted via APK decompilation.
- API keys for third-party services: use server-proxied calls when possible.
- Use `buildConfigField` or `local.properties` (not committed) for sensitive config.
{% if deployment.secrets_management %}
- **Secrets management: {{ deployment.secrets_management }}** — for CI/CD signing credentials only.
{% endif %}

---

## 4. CI/CD Pipeline

{% if deployment.ci %}
**Tool: {{ deployment.ci.tool }}**
{% if deployment.ci.pipeline_stages %}
**Stages: {{ deployment.ci.pipeline_stages }}**
{% endif %}

Standard pipeline steps:

```
1. Checkout code
2. Setup JDK (17+)
3. Cache Gradle dependencies
4. Lint (./gradlew lint)
5. Static analysis (./gradlew detekt)
6. Unit tests (./gradlew test)
7. Build (./gradlew bundleRelease)
8. Instrumented tests (./gradlew connectedAndroidTest) — on emulator
9. Upload to distribution platform
```

**Tools:**
- **Fastlane** with `supply` for Play Store upload.
- **GitHub Actions + android-emulator-runner** or **Bitrise** for CI.
- **Gradle Build Cache** for faster builds.
{% endif %}

{% if deployment.cd %}
**CD Tool: {{ deployment.cd.tool }}**
{% if deployment.cd.strategy %}
**Strategy: {{ deployment.cd.strategy }}**
{% endif %}
{% endif %}

---

## 5. Distribution

{% if distribution %}
**Distribution: {{ distribution }}**
{% endif %}

| Platform | Tool | Notes |
|----------|------|-------|
| Play Store | Google Play Console / Fastlane `supply` | Use internal → closed → open testing tracks |
| Internal testing | Firebase App Distribution | Quick distribution for QA |
| Direct APK | Manual / CI artifact | Side-loading, requires "Unknown sources" |

**Version management:**

```kotlin
// app/build.gradle.kts
android {
    defaultConfig {
        versionCode = System.getenv("BUILD_NUMBER")?.toIntOrNull() ?: 1
        versionName = "1.2.3"
    }
}
```

- `versionCode`: integer, increments every build. CI sets via env var.
- `versionName`: semver `major.minor.patch` for user-facing version.
- `build.gradle.kts` is the single source of truth for versions.

---

## 6. Updates

{% if update_strategy %}
**Update strategy: {{ update_strategy }}**
{% endif %}

{% if update_strategy == "force" %}
**Force update (In-App Updates API — IMMEDIATE):**

```kotlin
val appUpdateManager = AppUpdateManagerFactory.create(context)
val appUpdateInfoTask = appUpdateManager.appUpdateInfo
appUpdateInfoTask.addOnSuccessListener { info ->
    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
        && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
    ) {
        appUpdateManager.startUpdateFlowForResult(info, AppUpdateType.IMMEDIATE, activity, REQUEST_CODE)
    }
}
```

- Blocks app usage until update completes.
- Also check minimum version via backend API as fallback.
{% endif %}
{% if update_strategy == "soft" %}
**Soft update (In-App Updates API — FLEXIBLE):**

```kotlin
appUpdateManager.startUpdateFlowForResult(info, AppUpdateType.FLEXIBLE, activity, REQUEST_CODE)
```

- Downloads in background, prompts user to install.
- Allow user to dismiss and continue using current version.
{% endif %}
{% if update_strategy == "code_push" %}
**Note:** Native Android apps cannot use OTA code push (Play Store policy).
- All updates require Play Store review.
- Use feature flags (server-driven) for gradual rollout without new builds.
- Consider Firebase Remote Config for toggling features.
{% endif %}

---

## 7. Operational Commands

```bash
# Build debug
./gradlew assembleDebug

# Build release bundle
./gradlew bundleRelease

# Run unit tests
./gradlew test

# Run instrumented tests
./gradlew connectedAndroidTest

# Lint
./gradlew lint

# Static analysis
./gradlew detekt

# Clean
./gradlew clean

# Dependency updates check
./gradlew dependencyUpdates

# Install on connected device
adb install app/build/outputs/apk/debug/app-debug.apk

# List connected devices
adb devices
```

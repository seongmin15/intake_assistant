# Deployment — Flutter

> This skill defines deployment rules for the **{{ name }}** service.
> Distribution: **{{ distribution }}** | Update: **{{ update_strategy }}**

---

## 1. Build & Package

```bash
# iOS
flutter build ios --release

# Android (APK)
flutter build apk --release

# Android (App Bundle — preferred for Play Store)
flutter build appbundle --release
```

**Rules:**
- Always commit `pubspec.lock`.
- Use `flutter pub get` (not `flutter pub upgrade`) in CI for reproducible builds.
- Pin Flutter SDK version in CI (use FVM or `.flutter-version` file).
- Run `flutter doctor` to verify toolchain before first CI setup.

---

## 2. App Signing

### iOS
- Use Xcode managed signing for development.
- Use match (fastlane) or manual profiles for CI/distribution.
- Never commit certificates or provisioning profiles to git.

### Android
- Store keystore file outside the repo.
- Reference keystore path and passwords via environment variables.

```groovy
// android/app/build.gradle
signingConfigs {
    release {
        storeFile file(System.getenv("RELEASE_STORE_FILE") ?: "release.keystore")
        storePassword System.getenv("RELEASE_STORE_PASSWORD")
        keyAlias System.getenv("RELEASE_KEY_ALIAS")
        keyPassword System.getenv("RELEASE_KEY_PASSWORD")
    }
}
```

**Rules:**
- Never hardcode signing credentials in build files.
- Use `--obfuscate --split-debug-info=build/symbols` for release builds (code protection + smaller size).

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Use `--dart-define` or `--dart-define-from-file` for environment variables:**

```bash
# Option A: inline
flutter build apk --dart-define=API_URL=https://api.production.com

# Option B: from file (preferred)
flutter build apk --dart-define-from-file=env/production.json
```

```dart
// Access in code
const apiUrl = String.fromEnvironment('API_URL');
```

**Rules:**
- Never embed secrets in the app bundle — they can be extracted.
- API keys for third-party services: use server-proxied calls when possible.
- Per-environment config files. Only development config may be committed.
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
2. Setup Flutter SDK (pinned version)
3. flutter pub get
4. dart analyze
5. dart format --set-exit-if-changed lib/ test/
6. flutter test
7. flutter build ios --release
8. flutter build appbundle --release
9. Integration tests (on emulator/simulator)
10. Upload to distribution platform
```

**Tools:**
- **Fastlane** for build automation and store upload (both platforms).
- **Codemagic** or **GitHub Actions + flutter-action** for CI.
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
| App Store (iOS) | App Store Connect / Fastlane | Review takes 1-3 days |
| Play Store (Android) | Google Play Console / Fastlane | Use App Bundle (.aab) |
| TestFlight (iOS beta) | Fastlane `pilot` | Up to 10,000 testers |
| Internal testing | Firebase App Distribution | Quick distribution for QA |

**Version management:**

```yaml
# pubspec.yaml
version: 1.2.3+45    # semver+buildNumber
```

- `version` in `pubspec.yaml` is the single source of truth.
- Flutter auto-syncs to `Info.plist` (iOS) and `build.gradle` (Android).
- Build number (`+N`) increments on every CI build.
- Use `--build-name` and `--build-number` flags to override in CI.

---

## 6. Updates

{% if update_strategy %}
**Update strategy: {{ update_strategy }}**
{% endif %}

{% if update_strategy == "code_push" %}
**Shorebird (Code Push for Flutter):**
- Dart-only changes can be pushed without app store review.
- Native changes or Flutter engine updates require a full store release.
- Always test patches on staging before production.
- Set rollback policy: auto-rollback if crash rate increases.
- Run `shorebird patch` to push updates.
{% endif %}
{% if update_strategy == "force" %}
**Force update:**
- Check minimum version on app start via API.
- Compare `packageInfo.version` against server minimum.
- Block usage if version is below minimum.
- Show update prompt with link to store.
{% endif %}
{% if update_strategy == "soft" %}
**Soft update:**
- Show non-blocking update prompt when new version available.
- Allow user to dismiss and continue.
- Use `in_app_update` (Android) or custom dialog with store link.
{% endif %}

---

## 7. Operational Commands

```bash
# Run on connected device
flutter run

# Run on specific device
flutter run -d <device_id>

# List available devices
flutter devices

# Clean build artifacts
flutter clean

# Rebuild dependencies
flutter pub get

# Check project health
flutter doctor

# Analyze code
dart analyze

# Build size analysis
flutter build apk --analyze-size
flutter build ios --analyze-size
```

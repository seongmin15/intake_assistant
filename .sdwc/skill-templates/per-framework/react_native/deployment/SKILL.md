# Deployment — React Native

> This skill defines deployment rules for the **{{ name }}** service.
> Distribution: **{{ distribution }}** | Update: **{{ update_strategy }}**

---

## 1. Build & Package

```bash
# iOS
cd ios && pod install && cd ..
npx react-native run-ios --mode Release

# Android
cd android && ./gradlew assembleRelease
```

**Rules:**
- Always commit `ios/Podfile.lock` and `android/gradle.lock`.
- Use `--frozen-lockfile` for `npm ci` / `yarn install` in CI.
- Pin React Native version and all native dependency versions.

---

## 2. App Signing

### iOS
- Use Xcode managed signing for development.
- Use match (fastlane) or manual profiles for CI/distribution.
- Never commit certificates or provisioning profiles to git.

### Android
- Store keystore file outside the repo.
- Reference keystore path and passwords via environment variables.

```properties
# android/gradle.properties (NOT committed)
RELEASE_STORE_FILE=release.keystore
RELEASE_STORE_PASSWORD=***
RELEASE_KEY_ALIAS=***
RELEASE_KEY_PASSWORD=***
```

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Use `react-native-config` for environment variables:**

```bash
# .env.development
API_URL=http://localhost:8000

# .env.production
API_URL=https://api.production.com
```

```typescript
import Config from "react-native-config";
const apiUrl = Config.API_URL;
```

**Rules:**
- Never embed secrets in the app bundle — they can be extracted.
- API keys for third-party services: use server-proxied calls when possible.
- Per-environment `.env` files. Only `.env.development` may be committed.
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
2. Install dependencies (--frozen-lockfile)
3. Lint (eslint src/)
4. Type check (tsc --noEmit)
5. Unit tests (jest)
6. iOS build (xcodebuild or fastlane)
7. Android build (./gradlew assembleRelease)
8. E2E tests (Detox on simulator)
9. Upload to distribution platform
```

**Tools:**
- **Fastlane** for build automation (both platforms).
- **EAS Build** if using Expo.
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
| Play Store (Android) | Google Play Console / Fastlane | Review takes hours-days |
| TestFlight (iOS beta) | Fastlane `pilot` | Up to 10,000 testers |
| Internal testing | Firebase App Distribution | Quick distribution for QA |

**Version management:**
- Bump version in `package.json`, `ios/Info.plist`, and `android/app/build.gradle` together.
- Use `react-native-version` or manual script to sync.
- Follow semver: major.minor.patch. Build number increments on every build.

---

## 6. Updates

{% if update_strategy %}
**Update strategy: {{ update_strategy }}**
{% endif %}

{% if update_strategy == "code_push" %}
**CodePush / OTA updates:**
- JS-only changes can be pushed without app store review.
- Native changes require a full app store release.
- Always test OTA updates on staging before production.
- Set rollback policy: auto-rollback if crash rate increases.
{% endif %}
{% if update_strategy == "force" %}
**Force update:**
- Check minimum version on app start via API.
- Block usage if version is below minimum.
- Show update prompt with link to store.
{% endif %}
{% if update_strategy == "soft" %}
**Soft update:**
- Show non-blocking update prompt when new version available.
- Allow user to dismiss and continue.
{% endif %}

---

## 7. Operational Commands

```bash
# Run on iOS simulator
npx react-native run-ios

# Run on Android emulator
npx react-native run-android

# Clean builds
cd ios && xcodebuild clean && cd ..
cd android && ./gradlew clean && cd ..

# Reset Metro cache
npx react-native start --reset-cache

# Check native dependencies
npx react-native doctor
```

# Deployment — Swift (UIKit)

> This skill defines deployment rules for the **{{ name }}** service.
> Distribution: **{{ distribution }}** | Update: **{{ update_strategy }}**

---

## 1. Build & Package

```bash
# Archive for distribution
xcodebuild archive \
  -scheme {{ name }} \
  -archivePath build/{{ name }}.xcarchive \
  -destination 'generic/platform=iOS' \
  -configuration Release

# Export IPA
xcodebuild -exportArchive \
  -archivePath build/{{ name }}.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ExportOptions.plist
```

**Rules:**
- Always commit `Package.resolved` (SPM) or `Podfile.lock` (CocoaPods).
- Pin dependency versions — no unresolved ranges in CI.
- Use `Release` configuration for distribution builds.
- Set `ENABLE_BITCODE = NO` (deprecated since Xcode 14).

---

## 2. App Signing

- Use **Xcode managed signing** for development.
- Use **Fastlane match** or manual provisioning profiles for CI/distribution.
- Never commit certificates or provisioning profiles to git.

```ruby
# Fastlane Matchfile
git_url("https://github.com/org/certificates")
type("appstore")
app_identifier("com.company.{{ name }}")
```

**Rules:**
- Rotate distribution certificates before expiry (annual).
- Use separate provisioning profiles per environment (development, ad-hoc, app-store).
- Store signing credentials in CI secrets — never in the repo.

---

## 3. Environment Configuration

{% for env in deployment.environments %}
- **{{ env.name }}**: {{ env.purpose }}{{ " — " ~ env.differences if env.differences else "" }}
{% endfor %}

**Use build configurations + xcconfig files:**

```
# Config/Development.xcconfig
API_BASE_URL = http:/$()/localhost:8000
BUNDLE_IDENTIFIER = com.company.{{ name }}.dev

# Config/Production.xcconfig
API_BASE_URL = https:/$()/api.production.com
BUNDLE_IDENTIFIER = com.company.{{ name }}
```

```swift
// Access in code via Info.plist
enum Config {
    static let apiBaseURL: URL = {
        guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("API_BASE_URL not configured")
        }
        return url
    }()
}
```

**Rules:**
- Never embed secrets in the app bundle — they can be extracted.
- API keys for third-party services: use server-proxied calls when possible.
- Per-environment `.xcconfig` files. Use Xcode schemes to select configuration.
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
2. Install dependencies (swift package resolve / pod install)
3. Lint (swiftlint lint --strict)
4. Build (xcodebuild build -scheme {{ name }})
5. Unit tests (xcodebuild test)
6. UI tests (xcodebuild test -scheme {{ name }}UITests)
7. Archive (xcodebuild archive)
8. Export IPA (xcodebuild -exportArchive)
9. Upload to distribution platform
```

**Tools:**
- **Fastlane** for build automation, signing, and store upload.
- **Xcode Cloud**, **GitHub Actions + macos-latest**, or **Bitrise** for CI.
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
| App Store | App Store Connect / Fastlane `deliver` | Review takes 1-3 days |
| TestFlight | Fastlane `pilot` | Up to 10,000 external testers |
| Ad Hoc | Fastlane / manual IPA | Up to 100 registered devices |
| Enterprise | In-house distribution | Requires Enterprise Program membership |

**Version management:**

Set version in Xcode target → General → Identity:
- **Version** (`CFBundleShortVersionString`): semver `1.2.3`
- **Build** (`CFBundleVersion`): increments every CI build

```bash
# Bump via agvtool
agvtool new-marketing-version 1.2.3
agvtool next-version -all
```

- Use `agvtool` or Fastlane `increment_build_number` in CI.
- Version and build number are the single source of truth in the Xcode project.

---

## 6. Updates

{% if update_strategy %}
**Update strategy: {{ update_strategy }}**
{% endif %}

{% if update_strategy == "force" %}
**Force update:**
- Check minimum version on app start via API.
- Compare `Bundle.main.infoDictionary["CFBundleShortVersionString"]` against server minimum.
- Block usage if version is below minimum.
- Show alert with "Update" button linking to App Store.
{% endif %}
{% if update_strategy == "soft" %}
**Soft update:**
- Show non-blocking alert when new version available.
- Allow user to dismiss and continue.
- Check via App Store lookup API or custom backend endpoint.
{% endif %}
{% if update_strategy == "code_push" %}
**Note:** Native Swift apps cannot use OTA code push (App Store policy).
- All updates require App Store review.
- Use feature flags (server-driven) for gradual rollout without new builds.
- Consider Remote Config (Firebase) for toggling features.
{% endif %}

---

## 7. Operational Commands

```bash
# Build for simulator
xcodebuild build -scheme {{ name }} -destination 'platform=iOS Simulator,name=iPhone 16'

# Run tests
xcodebuild test -scheme {{ name }} -destination 'platform=iOS Simulator,name=iPhone 16'

# Clean build folder
xcodebuild clean -scheme {{ name }}

# Resolve SPM dependencies
swift package resolve

# Install CocoaPods (if used)
pod install

# List simulators
xcrun simctl list devices

# Open project
open {{ name }}.xcodeproj
# or workspace
open {{ name }}.xcworkspace
```

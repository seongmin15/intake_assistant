# Framework — SwiftUI

> This skill defines SwiftUI-specific patterns for the **{{ name }}** service.
> Approach: **{{ approach }}** | Navigation: **{{ navigation_pattern }}**
> Min OS: **{{ min_os_versions }}**
> Read this before building or modifying any mobile logic.

---

## 1. Application Bootstrap

```swift
// App/{{ name }}App.swift
@main
struct {{ name }}App: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }
}
```

```swift
// App/AppState.swift
@Observable
final class AppState {
    var isAuthenticated = false
    let apiClient: APIClient
    let authService: AuthService

    init() {
        apiClient = APIClient(baseURL: Config.apiBaseURL)
        authService = AuthService(apiClient: apiClient)
    }
}
```

```swift
// App/RootView.swift
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        if appState.isAuthenticated {
            MainTabView()
        } else {
            LoginView()
        }
    }
}
```

**Rules:**
- Use `@main` on the `App` struct — no AppDelegate unless needed for push notifications.
- Use `@Observable` (iOS 17+) for shared state. Inject via `.environment()`.
- Initialize services in `AppState` or a dedicated container — not in views.
- Use `AppDelegate` adapter only when required (push tokens, background fetch).

```swift
// AppDelegate adapter (only if needed)
@main
struct {{ name }}App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    // ...
}
```

---

## 2. Navigation

{% if navigation_pattern == "tab" %}
**Tab navigation:**

```swift
struct MainTabView: View {
    @State private var selectedTab = Tab.home

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView()
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(Tab.home)

            NavigationStack {
                SearchView()
            }
            .tabItem { Label("Search", systemImage: "magnifyingglass") }
            .tag(Tab.search)

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label("Profile", systemImage: "person") }
            .tag(Tab.profile)
        }
    }
}

enum Tab { case home, search, profile }
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Sidebar / drawer navigation (NavigationSplitView):**

```swift
struct MainView: View {
    @State private var selectedSection: SidebarSection? = .home

    var body: some View {
        NavigationSplitView {
            List(SidebarSection.allCases, selection: $selectedSection) { section in
                Label(section.title, systemImage: section.icon)
            }
        } detail: {
            switch selectedSection {
            case .home: HomeView()
            case .settings: SettingsView()
            case nil: Text("Select an item")
            }
        }
    }
}

enum SidebarSection: String, CaseIterable, Identifiable {
    case home, settings
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var icon: String {
        switch self {
        case .home: "house"
        case .settings: "gear"
        }
    }
}
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation:**

```swift
struct HomeView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ItemListView(onSelect: { id in
                path.append(Route.detail(id: id))
            })
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .detail(let id):
                    DetailView(itemId: id)
                case .settings:
                    SettingsView()
                }
            }
        }
    }
}

enum Route: Hashable {
    case detail(id: String)
    case settings
}
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested stacks:**

```swift
struct MainTabView: View {
    @State private var selectedTab = Tab.home
    @State private var homePath = NavigationPath()
    @State private var profilePath = NavigationPath()

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $homePath) {
                HomeListView(onSelect: { id in
                    homePath.append(HomeRoute.detail(id: id))
                })
                .navigationDestination(for: HomeRoute.self) { route in
                    switch route {
                    case .detail(let id):
                        HomeDetailView(itemId: id)
                    }
                }
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(Tab.home)

            NavigationStack(path: $profilePath) {
                ProfileView()
            }
            .tabItem { Label("Profile", systemImage: "person") }
            .tag(Tab.profile)
        }
    }
}
```
{% endif %}

**Rules:**
- Use **NavigationStack** (iOS 16+) with `NavigationPath` — not deprecated `NavigationView`.
- Define routes as `Hashable` enums — type-safe navigation.
- Each tab owns its own `NavigationStack` and path state.
- Auth flow: conditional view swap in `RootView` — not navigation push.

---

## 3. State Management

### Property wrapper guide

| Wrapper | Scope | Use when |
|---------|-------|----------|
| `@State` | View-local | Simple value types owned by this view |
| `@Binding` | Parent → child | Child needs read/write access to parent's state |
| `@Environment` | Ancestor → descendant | Shared app-wide or subtree state |
| `@Observable` + `@State` | ViewModel | iOS 17+ ViewModel pattern |

### ViewModel pattern (iOS 17+ with @Observable)

```swift
@Observable
final class UserListViewModel {
    private let userService: UserServiceProtocol
    var users: [User] = []
    var isLoading = false
    var errorMessage: String?

    init(userService: UserServiceProtocol) {
        self.userService = userService
    }

    @MainActor
    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }
        do {
            users = try await userService.fetchAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

```swift
struct UserListView: View {
    @State private var viewModel: UserListViewModel

    init(userService: UserServiceProtocol) {
        _viewModel = State(initialValue: UserListViewModel(userService: userService))
    }

    var body: some View {
        List(viewModel.users) { user in
            Text(user.name)
        }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
        .task { await viewModel.loadUsers() }
    }
}
```

**Rules:**
- Use `@Observable` (iOS 17+) — automatic fine-grained tracking, no `@Published` needed.
- Use `.task { }` modifier for async work on view appear — auto-cancelled on disappear.
- Mark mutating methods `@MainActor` when they update published state.
- Inject dependencies via initializer — not via environment for ViewModels.

---

## 4. Data Fetching

**Use URLSession with async/await (same client as UIKit).**

```swift
// Networking/APIClient.swift
final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let tokenStore: TokenStoreProtocol

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = tokenStore.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

---

## 5. Offline Support

{% if offline_support %}
**Offline support: enabled**
{% if local_storage %}**Local storage: {{ local_storage }}**{% endif %}
{% if sync_strategy %}**Sync strategy: {{ sync_strategy }}**{% endif %}

**Rules:**
- Cache critical data locally (SwiftData, Core Data, or UserDefaults for small data).
- Queue mutations when offline, sync when connection restored.
- Monitor reachability via `NWPathMonitor`.
- Show clear UI indicators for offline state and pending syncs.
{% endif %}
{% if not offline_support %}
**Offline support: not enabled.** Handle network errors gracefully with retry and user feedback.
{% endif %}

---

## 6. Device Features

{% for device_i in device_features %}
### {{ device_i.feature }}

- **Purpose:** {{ device_i.purpose }}
- **Permission:** {{ device_i.permission }}
- **On denial:** {{ device_i.denial_behavior }}

{% endfor %}

**Permission handling pattern:**

```swift
import AVFoundation

func requestCameraPermission() async -> Bool {
    let status = AVCaptureDevice.authorizationStatus(for: .video)
    switch status {
    case .authorized:
        return true
    case .notDetermined:
        return await AVCaptureDevice.requestAccess(for: .video)
    case .denied, .restricted:
        // show alert guiding user to Settings
        return false
    @unknown default:
        return false
    }
}
```

**Rules:**
- Request permissions at point of use, not on app launch.
- Always handle denial gracefully — show explanation and settings link.
- Use SwiftUI `.alert()` for permission rationale dialogs.

---

## 7. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Setup via AppDelegate adapter:**

```swift
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            DispatchQueue.main.async { application.registerForRemoteNotifications() }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        // send token to backend
    }
}
```

**Rules:**
- Register for push tokens after auth completes.
- Handle notifications in three states: foreground, background, terminated.
- Deep link from notification payload via NavigationPath manipulation.
{% endif %}

---

## 8. Performance

- **View identity:** Use stable `id` in `ForEach`. Prefer `Identifiable` conformance.
- **Lazy stacks:** Use `LazyVStack` / `LazyHStack` for large lists — not `VStack`.
- **Images:** Use `AsyncImage` for simple cases, `Kingfisher` or `SDWebImage` for cached images.
- **Animations:** Use `.animation()` modifier or `withAnimation { }`. SwiftUI optimizes implicit animations.
- **State granularity:** Keep `@State` as local as possible — avoid broad state objects that trigger wide rebuilds.
- **Startup:** Defer non-critical work with `.task { }` — it runs after first render.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

---

## 9. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```swift
@main
struct {{ name }}App: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }
        switch components.path {
        case let path where path.hasPrefix("/user/"):
            let userId = String(path.dropFirst("/user/".count))
            appState.navigate(to: .userProfile(userId: userId))
        case "/settings":
            appState.navigate(to: .settings)
        default:
            break
        }
    }
}
```

**Rules:**
- Use `.onOpenURL { }` modifier for deep link handling.
- Validate deep link parameters before navigating.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
{% endif %}

---

## 10. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `NavigationView` (deprecated) | Inconsistent behavior | Use `NavigationStack` (iOS 16+) |
| `@ObservedObject` for owned state | Object recreated on parent redraw | `@StateObject` or `@State` + `@Observable` |
| Missing `id` in `ForEach` | List diffing breaks, wrong animations | Conform models to `Identifiable` |
| `VStack` for 100+ items | All items rendered at once | `LazyVStack` or `List` |
| Force unwraps (`!`) | Runtime crash | `guard let` / `if let` / nil coalescing |
| Storing tokens in UserDefaults | Not encrypted | Use Keychain for sensitive data |
| Business logic in View body | Untestable, re-executes on every render | Extract to `@Observable` ViewModel |
| Ignoring `.task` cancellation | Work continues after view disappears | `.task { }` auto-cancels; check `Task.isCancelled` for manual tasks |

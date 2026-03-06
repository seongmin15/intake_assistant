# Framework — Swift (UIKit)

> This skill defines UIKit-specific patterns for the **{{ name }}** service.
> Approach: **{{ approach }}** | Navigation: **{{ navigation_pattern }}**
> Min OS: **{{ min_os_versions }}**
> Read this before building or modifying any mobile logic.

---

## 1. Application Bootstrap

```swift
// App/AppDelegate.swift
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        DependencyContainer.shared.register()
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
    }
}
```

```swift
// App/SceneDelegate.swift
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private let coordinator = AppCoordinator()

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = coordinator.start()
        window?.makeKeyAndVisible()
    }
}
```

**Dependency injection pattern:**

```swift
// App/DependencyContainer.swift
final class DependencyContainer {
    static let shared = DependencyContainer()
    private var services: [String: Any] = [:]

    func register() {
        let apiClient = APIClient(baseURL: Config.apiBaseURL)
        register(UserServiceProtocol.self, instance: UserService(apiClient: apiClient))
        register(AuthServiceProtocol.self, instance: AuthService(apiClient: apiClient))
    }

    func register<T>(_ type: T.Type, instance: T) {
        services[String(describing: type)] = instance
    }

    func resolve<T>(_ type: T.Type) -> T {
        guard let service = services[String(describing: type)] as? T else {
            fatalError("No registration for \(type)")
        }
        return service
    }
}
```

**Rules:**
- Use `SceneDelegate` for window setup (iOS 13+).
- Register all dependencies at app launch in `DependencyContainer`.
- Inject dependencies via initializers — not by accessing singletons in view controllers.

---

## 2. Navigation

### Coordinator pattern

```swift
protocol Coordinator: AnyObject {
    var navigationController: UINavigationController { get }
    func start() -> UIViewController
}
```

{% if navigation_pattern == "tab" %}
**Tab navigation:**

```swift
final class AppCoordinator: Coordinator {
    let navigationController = UINavigationController()

    func start() -> UIViewController {
        let tabBar = UITabBarController()
        tabBar.viewControllers = [
            makeHomeTab(),
            makeSearchTab(),
            makeProfileTab(),
        ]
        return tabBar
    }

    private func makeHomeTab() -> UINavigationController {
        let nav = UINavigationController()
        nav.tabBarItem = UITabBarItem(title: "Home", image: UIImage(systemName: "house"), tag: 0)
        let vc = HomeViewController(viewModel: HomeViewModel())
        nav.viewControllers = [vc]
        return nav
    }
}
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Side menu / drawer navigation:**

```swift
final class AppCoordinator: Coordinator {
    let navigationController = UINavigationController()

    func start() -> UIViewController {
        let menuVC = SideMenuViewController(delegate: self)
        let homeVC = HomeViewController(viewModel: HomeViewModel())
        navigationController.viewControllers = [homeVC]

        let container = SideMenuContainerViewController(
            menuController: menuVC,
            contentController: navigationController
        )
        return container
    }
}

extension AppCoordinator: SideMenuDelegate {
    func didSelect(menuItem: MenuItem) {
        switch menuItem {
        case .home: navigationController.popToRootViewController(animated: true)
        case .settings: navigationController.pushViewController(SettingsViewController(), animated: true)
        }
    }
}
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation:**

```swift
final class AppCoordinator: Coordinator {
    let navigationController = UINavigationController()

    func start() -> UIViewController {
        let vm = HomeViewModel()
        vm.onSelectItem = { [weak self] id in
            self?.showDetail(id: id)
        }
        let vc = HomeViewController(viewModel: vm)
        navigationController.viewControllers = [vc]
        return navigationController
    }

    private func showDetail(id: String) {
        let vc = DetailViewController(viewModel: DetailViewModel(id: id))
        navigationController.pushViewController(vc, animated: true)
    }
}
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested stacks:**

```swift
final class AppCoordinator: Coordinator {
    let navigationController = UINavigationController()

    func start() -> UIViewController {
        let tabBar = UITabBarController()

        let homeNav = UINavigationController()
        homeNav.tabBarItem = UITabBarItem(title: "Home", image: UIImage(systemName: "house"), tag: 0)
        let homeCoordinator = HomeCoordinator(navigationController: homeNav)
        homeNav.viewControllers = [homeCoordinator.start()]

        let profileNav = UINavigationController()
        profileNav.tabBarItem = UITabBarItem(title: "Profile", image: UIImage(systemName: "person"), tag: 1)
        profileNav.viewControllers = [ProfileViewController()]

        tabBar.viewControllers = [homeNav, profileNav]
        return tabBar
    }
}
```
{% endif %}

**Auth flow:**

```swift
final class AppCoordinator: Coordinator {
    // ...
    func start() -> UIViewController {
        if authService.isAuthenticated {
            return makeMainFlow()
        } else {
            return makeAuthFlow()
        }
    }

    func didCompleteLogin() {
        window?.rootViewController = makeMainFlow()
    }
}
```

**Rules:**
- Use **Coordinator** pattern — view controllers never create or push other view controllers.
- Each tab or major flow gets its own coordinator.
- Navigation actions flow from ViewModel → Coordinator via closures or delegates.
- Auth flow: swap root view controller — not push/present.

---

## 3. Data Fetching

**Use URLSession with async/await.**

```swift
// Networking/APIClient.swift
final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let tokenStore: TokenStoreProtocol

    init(baseURL: URL, session: URLSession = .shared, tokenStore: TokenStoreProtocol) {
        self.baseURL = baseURL
        self.session = session
        self.tokenStore = tokenStore
    }

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = tokenStore.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)
        case 401:
            throw APIError.unauthorized
        default:
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
    }
}
```

```swift
// Networking/Endpoint.swift
struct Endpoint {
    let path: String
    let method: HTTPMethod
    let body: Encodable?

    static func getUser(id: String) -> Endpoint {
        Endpoint(path: "/users/\(id)", method: .get, body: nil)
    }
}
```

---

## 4. Offline Support

{% if offline_support %}
**Offline support: enabled**
{% if local_storage %}**Local storage: {{ local_storage }}**{% endif %}
{% if sync_strategy %}**Sync strategy: {{ sync_strategy }}**{% endif %}

**Rules:**
- Cache critical data locally (Core Data, Realm, or UserDefaults for small data) for offline access.
- Queue mutations when offline, sync when connection restored.
- Monitor reachability via `NWPathMonitor`.
- Show clear UI indicators for offline state and pending syncs.
- Resolve conflicts with server-wins or last-write-wins strategy (document which).

```swift
import Network

final class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private(set) var isConnected = true

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isConnected = (path.status == .satisfied)
        }
        monitor.start(queue: DispatchQueue(label: "NetworkMonitor"))
    }
}
```
{% endif %}
{% if not offline_support %}
**Offline support: not enabled.** Handle network errors gracefully with retry and user feedback.
{% endif %}

---

## 5. Device Features

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
        promptOpenSettings()
        return false
    @unknown default:
        return false
    }
}

private func promptOpenSettings() {
    guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(settingsURL)
}
```

**Rules:**
- Request permissions at point of use, not on app launch.
- Always handle `.denied` and `.restricted` — show explanation and settings link.
- Check permission status before each use (user can revoke anytime).

---

## 6. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Setup pattern:**

```swift
// AppDelegate
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
```

**Rules:**
- Register for push tokens after auth completes.
- Handle notifications in three states: foreground, background, terminated.
- Deep link from notification payload to the relevant screen via Coordinator.
{% endif %}

---

## 7. Performance

- **Table/Collection views:** Use cell reuse identifiers. Implement `prefetchDataSource` for pagination.
- **Images:** Use `NSCache` or a library (Kingfisher, SDWebImage) for cached network images.
- **Animations:** Use `UIView.animate` or `UIViewPropertyAnimator`. Avoid Core Animation unless needed.
- **Memory:** Profile with Instruments (Leaks, Allocations). Watch for retain cycles in closures.
- **Startup:** Defer non-critical work to `viewDidAppear` or `DispatchQueue.main.async`.
- **Auto Layout:** Avoid ambiguous constraints. Use `layoutIfNeeded()` inside animation blocks.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

---

## 8. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```swift
// SceneDelegate
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    coordinator.handleDeepLink(url)
}

func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let url = userActivity.webpageURL else { return }
    coordinator.handleDeepLink(url)
}
```

```swift
// AppCoordinator
func handleDeepLink(_ url: URL) {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true) else { return }
    switch components.path {
    case let path where path.hasPrefix("/user/"):
        let userId = String(path.dropFirst("/user/".count))
        showUserProfile(userId: userId)
    case "/settings":
        showSettings()
    default:
        break
    }
}
```

**Rules:**
- Handle both custom scheme (`{{ deep_link_scheme }}://`) and universal links (`https://`).
- Validate deep link parameters before navigating.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
{% endif %}

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Force unwraps (`!`) | Runtime crash on nil | `guard let` / `if let` / nil coalescing |
| Retain cycles | Memory leaks, VC never deallocated | `[weak self]` in escaping closures |
| Main thread violations | UI updates from background thread crash | `@MainActor` or `DispatchQueue.main.async` |
| Massive ViewController | Untestable, unmaintainable | MVVM + Coordinator pattern |
| Storyboard merge conflicts | Git conflicts on XML files | Programmatic UI or one VC per storyboard |
| Missing `loadViewIfNeeded` in tests | Nil outlets in unit tests | Call `loadViewIfNeeded()` in `setUp()` |
| Blocking main thread | App freeze, watchdog kill | `async/await` for network/disk I/O |
| Storing tokens in UserDefaults | Not encrypted | Use Keychain for sensitive data |

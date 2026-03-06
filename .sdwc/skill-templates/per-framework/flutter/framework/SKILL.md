# Framework — Flutter

> This skill defines Flutter-specific patterns for the **{{ name }}** service.
> Approach: **{{ approach }}** | Navigation: **{{ navigation_pattern }}**
> Min OS: **{{ min_os_versions }}**
> Read this before building or modifying any mobile logic.

---

## 1. Application Bootstrap

```dart
// main.dart
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const App());
}
```

```dart
// app/app.dart
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(               // Riverpod (if used)
      child: MaterialApp.router(
        routerConfig: appRouter,
        theme: appTheme,
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
```

**Provider nesting order (if wrapping manually):**

```dart
ProviderScope(                          // state management (outermost)
  child: AuthGuard(                     // auth gate
    child: MaterialApp.router(
      routerConfig: appRouter,
      theme: appTheme,
      localizationsDelegates: [...],
    ),
  ),
)
```

**Rules:**
- Call `WidgetsFlutterBinding.ensureInitialized()` before any plugin usage in `main()`.
- Use `MaterialApp.router()` with declarative routing (GoRouter).
- Initialize async services (SharedPreferences, Firebase) before `runApp()`.

---

## 2. Navigation

{% if navigation_pattern == "tab" %}
**Tab navigation with GoRouter:**

```dart
final appRouter = GoRouter(
  initialLocation: '/home',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, child) => ScaffoldWithNavBar(child: child),
      branches: [
        StatefulShellBranch(routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ]),
      ],
    ),
  ],
);
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Drawer navigation with GoRouter:**

```dart
final appRouter = GoRouter(
  initialLocation: '/home',
  routes: [
    ShellRoute(
      builder: (context, state, child) => ScaffoldWithDrawer(child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      ],
    ),
  ],
);
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation with GoRouter:**

```dart
final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(
      path: '/detail/:id',
      builder: (_, state) => DetailScreen(id: state.pathParameters['id']!),
    ),
  ],
);
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested stacks:**

```dart
final appRouter = GoRouter(
  initialLocation: '/home',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, child) => ScaffoldWithNavBar(child: child),
      branches: [
        StatefulShellBranch(routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomeListScreen(),
            routes: [
              GoRoute(
                path: 'detail/:id',
                builder: (_, state) =>
                    HomeDetailScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ]),
      ],
    ),
  ],
);
```
{% endif %}

**Auth-aware routing:**

```dart
final appRouter = GoRouter(
  redirect: (context, state) {
    final isLoggedIn = ref.read(authProvider).isAuthenticated;
    final isLoginRoute = state.matchedLocation == '/login';
    if (!isLoggedIn && !isLoginRoute) return '/login';
    if (isLoggedIn && isLoginRoute) return '/home';
    return null;
  },
  routes: [...],
);
```

**Rules:**
- Use **GoRouter** for declarative, type-safe routing.
- Define all routes in a single `router.dart` file.
- Always validate path parameters before use.
- Auth flow: use `redirect` guard — not separate widget trees.

---

## 3. Data Fetching

**Use Dio for HTTP + a repository/service layer.**

```dart
// services/api_client.dart
class ApiClient {
  final Dio _dio;

  ApiClient({required String baseUrl, Dio? dio})
      : _dio = (dio ?? Dio())
          ..options.baseUrl = baseUrl
          ..options.connectTimeout = const Duration(seconds: 10)
          ..interceptors.add(AuthInterceptor());

  Future<T> get<T>(String path, {T Function(dynamic)? fromJson}) async {
    final response = await _dio.get(path);
    return fromJson != null ? fromJson(response.data) : response.data as T;
  }

  Future<T> post<T>(String path, {dynamic data, T Function(dynamic)? fromJson}) async {
    final response = await _dio.post(path, data: data);
    return fromJson != null ? fromJson(response.data) : response.data as T;
  }
}
```

```dart
// services/user_api.dart
class UserApi {
  final ApiClient _client;
  UserApi(this._client);

  Future<User> getById(String id) =>
      _client.get('/users/$id', fromJson: User.fromJson);
}
```

**Auth interceptor pattern:**

```dart
class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await SecureStorage.readToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // trigger logout or token refresh
    }
    handler.next(err);
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
- Cache critical data locally (Hive, Isar, or drift) for offline access.
- Queue mutations when offline, sync when connection restored.
- Listen to connectivity changes via `connectivity_plus`.
- Show clear UI indicators for offline state and pending syncs.
- Resolve conflicts with server-wins or last-write-wins strategy (document which).
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

```dart
import 'package:permission_handler/permission_handler.dart';

Future<bool> requestCameraPermission() async {
  final status = await Permission.camera.request();
  if (status.isPermanentlyDenied) {
    openAppSettings();
    return false;
  }
  return status.isGranted;
}
```

**Rules:**
- Request permissions at point of use, not on app launch.
- Always handle denial gracefully — show explanation and alternative.
- Check permission status before each use (user can revoke anytime).
- Use `openAppSettings()` when permanently denied.

---

## 6. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Setup pattern (Firebase Messaging):**

```dart
Future<void> initNotifications() async {
  await FirebaseMessaging.instance.requestPermission();
  final token = await FirebaseMessaging.instance.getToken();
  // send token to backend

  // Foreground
  FirebaseMessaging.onMessage.listen(_handleForeground);
  // Background / terminated
  FirebaseMessaging.onBackgroundMessage(_handleBackground);
  // Notification tap
  FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);
}
```

**Rules:**
- Register for push tokens after auth completes.
- Handle notifications in three states: foreground, background, terminated.
- Deep link from notification payload to the relevant screen via GoRouter.
{% endif %}

---

## 7. Performance

- **Widget rebuilds:** Use `const` constructors. Split large widgets into small `StatelessWidget`s.
- **Lists:** Use `ListView.builder` / `SliverList` — never `Column` with `children: list.map(...)`.
- **Images:** Use `cached_network_image` for network images with disk caching.
- **Animations:** Prefer implicit animations (`AnimatedContainer`, `AnimatedOpacity`). Use `AnimationController` only when needed.
- **Shader compilation jank:** Run `flutter build` with `--bundle-sksl-warmup` for release builds.
- **Bundle size:** Use `--split-debug-info` and `--obfuscate` for release. Monitor with `flutter build --analyze-size`.
- **Startup:** Defer non-critical work. Use `Future.microtask` or `WidgetsBinding.addPostFrameCallback`.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

---

## 8. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```dart
final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: '/user/:userId',
      builder: (_, state) =>
          UserProfileScreen(userId: state.pathParameters['userId']!),
    ),
    GoRoute(
      path: '/settings',
      builder: (_, __) => const SettingsScreen(),
    ),
  ],
);
```

**Platform config:**
- **iOS:** Add Associated Domains in `Runner.entitlements` + `apple-app-site-association` on server.
- **Android:** Add `<intent-filter>` with `autoVerify="true"` in `AndroidManifest.xml` + `assetlinks.json` on server.

**Rules:**
- Validate deep link parameters before navigating.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
- Test deep links on both platforms — behavior differs.
{% endif %}

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Missing `const` constructors | Unnecessary widget rebuilds | Add `const` wherever possible |
| `setState` in large widgets | Entire subtree rebuilds | Split into small widgets or use state management |
| `Column` + `map()` for long lists | All items rendered at once (no virtualization) | `ListView.builder` with `itemBuilder` |
| Storing tokens in SharedPreferences | Not encrypted on device | Use `flutter_secure_storage` for secrets |
| Unhandled permission denial | App crash or bad UX | Always handle denial + permanently denied cases |
| Platform-specific bugs | Works on iOS, breaks Android | Test on both platforms regularly |
| Large images in memory | OOM on low-end devices | Use disk cache, resize before display |
| Blocking `main()` | White screen on startup | Async init with splash screen |

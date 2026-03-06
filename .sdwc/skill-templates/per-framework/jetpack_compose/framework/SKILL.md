# Framework — Jetpack Compose

> This skill defines Compose-specific patterns for the **{{ name }}** service.
> Approach: **{{ approach }}** | Navigation: **{{ navigation_pattern }}**
> Min OS: **{{ min_os_versions }}**
> Read this before building or modifying any mobile logic.

---

## 1. Application Bootstrap

```kotlin
// app/{{ name }}Application.kt
@HiltAndroidApp
class {{ name }}Application : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }
    }
}
```

```kotlin
// app/MainActivity.kt
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                AppNavGraph()
            }
        }
    }
}
```

```kotlin
// app/theme/Theme.kt
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) darkColorScheme() else lightColorScheme()
    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        content = content,
    )
}
```

**Rules:**
- Use **Hilt** for DI — `@HiltAndroidApp` on Application, `@AndroidEntryPoint` on Activity.
- Single Activity with `setContent { }` — all UI is Compose.
- Define theme in `app/theme/` — `Theme.kt`, `Color.kt`, `Type.kt`.
- No XML layouts — `activity_main.xml` is not needed.

---

## 2. Navigation

Use **Navigation Compose** with type-safe routes.

{% if navigation_pattern == "tab" %}
**Tab / Bottom navigation:**

```kotlin
@Composable
fun AppNavGraph() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(navController, startDestination = Route.Home, Modifier.padding(padding)) {
            composable<Route.Home> { HomeScreen(onNavigateToDetail = { navController.navigate(Route.Detail(it)) }) }
            composable<Route.Search> { SearchScreen() }
            composable<Route.Profile> { ProfileScreen() }
            composable<Route.Detail> { DetailScreen() }
        }
    }
}
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Drawer navigation:**

```kotlin
@Composable
fun AppNavGraph() {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                DrawerItem("Home") { navController.navigate(Route.Home); scope.launch { drawerState.close() } }
                DrawerItem("Settings") { navController.navigate(Route.Settings); scope.launch { drawerState.close() } }
            }
        },
    ) {
        NavHost(navController, startDestination = Route.Home) {
            composable<Route.Home> { HomeScreen() }
            composable<Route.Settings> { SettingsScreen() }
        }
    }
}
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation:**

```kotlin
@Composable
fun AppNavGraph() {
    val navController = rememberNavController()

    NavHost(navController, startDestination = Route.Home) {
        composable<Route.Home> {
            HomeScreen(onNavigateToDetail = { id -> navController.navigate(Route.Detail(id)) })
        }
        composable<Route.Detail> {
            DetailScreen(onBack = { navController.popBackStack() })
        }
    }
}
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested graphs:**

```kotlin
@Composable
fun AppNavGraph() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = { AppBottomBar(navController) },
    ) { padding ->
        NavHost(navController, startDestination = Route.HomeGraph, Modifier.padding(padding)) {
            navigation<Route.HomeGraph>(startDestination = Route.HomeList) {
                composable<Route.HomeList> {
                    HomeListScreen(onNavigateToDetail = { navController.navigate(Route.HomeDetail(it)) })
                }
                composable<Route.HomeDetail> {
                    HomeDetailScreen(onBack = { navController.popBackStack() })
                }
            }
            composable<Route.Profile> { ProfileScreen() }
        }
    }
}
```
{% endif %}

**Type-safe routes (Kotlin Serialization):**

```kotlin
// navigation/Route.kt
@Serializable sealed interface Route {
    @Serializable data object Home : Route
    @Serializable data object Search : Route
    @Serializable data object Profile : Route
    @Serializable data class Detail(val itemId: String) : Route
    @Serializable data object Settings : Route
}
```

**Auth-aware navigation:**

```kotlin
@Composable
fun AppNavGraph(isAuthenticated: Boolean) {
    val navController = rememberNavController()
    val startDestination = if (isAuthenticated) Route.Home else Route.Login

    NavHost(navController, startDestination = startDestination) {
        composable<Route.Login> {
            LoginScreen(onLoginSuccess = {
                navController.navigate(Route.Home) { popUpTo(Route.Login) { inclusive = true } }
            })
        }
        composable<Route.Home> { HomeScreen() }
    }
}
```

**Rules:**
- Use **type-safe routes** with `@Serializable` — not string-based routes.
- Define all routes in `navigation/Route.kt`.
- Auth flow: conditional `startDestination` + `popUpTo(inclusive = true)` after login.
- Bottom nav: use `launchSingleTop`, `saveState`, `restoreState` to avoid duplicate screens.

---

## 3. Data Fetching

**Use Retrofit + coroutines (same as Android Views).**

```kotlin
interface UserApi {
    @GET("users/{id}")
    suspend fun getById(@Path("id") id: String): UserDto

    @GET("users")
    suspend fun getAll(): List<UserDto>
}
```

**Repository → ViewModel → Compose state:**

```kotlin
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val repository: UserRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<User>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<User>>> = _uiState.asStateFlow()

    init { loadUsers() }

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            repository.getUsers()
                .onSuccess { _uiState.value = UiState.Success(it) }
                .onFailure { _uiState.value = UiState.Error(it.message ?: "Unknown error") }
        }
    }
}

// Screen composable
@Composable
fun UserListScreen(viewModel: UserListViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // render based on uiState
}
```

---

## 4. Offline Support

{% if offline_support %}
**Offline support: enabled**
{% if local_storage %}**Local storage: {{ local_storage }}**{% endif %}
{% if sync_strategy %}**Sync strategy: {{ sync_strategy }}**{% endif %}

**Rules:**
- Cache critical data locally (Room database) for offline access.
- Queue mutations when offline using WorkManager, sync when connection restored.
- Monitor connectivity via `ConnectivityManager` + `NetworkCallback`.
- Show clear UI indicators for offline state and pending syncs.

```kotlin
@Composable
fun rememberConnectivityState(): State<Boolean> {
    val context = LocalContext.current
    return produceState(initialValue = true) {
        val cm = context.getSystemService<ConnectivityManager>()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { value = true }
            override fun onLost(network: Network) { value = false }
        }
        cm?.registerDefaultNetworkCallback(callback)
        awaitDispose { cm?.unregisterNetworkCallback(callback) }
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

**Permission handling pattern (Compose):**

```kotlin
@Composable
fun CameraFeature() {
    val cameraPermissionState = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) { /* open camera */ }
        else { /* show rationale */ }
    }

    Button(onClick = {
        cameraPermissionState.launch(Manifest.permission.CAMERA)
    }) {
        Text("Open Camera")
    }
}
```

**Rules:**
- Use `rememberLauncherForActivityResult` inside composables — not Activity-level launcher.
- Request permissions at point of use, not on app launch.
- Always handle denial gracefully — show rationale and settings link.

---

## 6. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Setup pattern (Firebase Messaging — same as Android Views):**

```kotlin
class AppFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // send token to backend
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        remoteMessage.notification?.let { showNotification(it) }
        remoteMessage.data.let { handleDataPayload(it) }
    }
}
```

**Rules:**
- Register for push tokens after auth completes.
- Handle data-only messages in `onMessageReceived`.
- Create notification channels (required Android 8+).
- Deep link from notification payload via type-safe `Route` + `NavController`.
{% endif %}

---

## 7. Performance

- **Stability:** Mark model classes `@Stable` or `@Immutable` to help Compose skip recomposition.
- **Lists:** Use `LazyColumn` / `LazyRow` with stable `key` parameter.
- **Images:** Use **Coil Compose** (`AsyncImage`) for cached network images.
- **Recomposition:** Avoid unnecessary recomposition — use `derivedStateOf`, `remember` with keys.
- **Startup:** Use **App Startup** library. Defer non-critical init to `LaunchedEffect`.
- **Compose compiler reports:** Enable to detect unstable parameters causing recomposition.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

```kotlin
// Minimize recomposition
val sortedUsers by remember(users) { derivedStateOf { users.sortedBy { it.name } } }

// Stable keys for LazyColumn
LazyColumn {
    items(users, key = { it.id }) { user -> UserCard(user) }
}
```

**Compose compiler stability check:**

```kotlin
// build.gradle.kts
composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose_compiler")
}
```

---

## 8. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```kotlin
// navigation/NavGraph.kt
NavHost(navController, startDestination = Route.Home) {
    composable<Route.Detail>(
        deepLinks = listOf(
            navDeepLink<Route.Detail>(basePath = "{{ deep_link_scheme }}://detail"),
            navDeepLink<Route.Detail>(basePath = "https://yourdomain.com/detail"),
        ),
    ) {
        DetailScreen()
    }
}
```

```xml
<!-- AndroidManifest.xml -->
<activity android:name=".app.MainActivity">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="{{ deep_link_scheme }}" />
        <data android:scheme="https" android:host="yourdomain.com" />
    </intent-filter>
</activity>
```

**Rules:**
- Define deep links alongside route composables in the nav graph.
- Validate deep link parameters in the destination screen.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
- Test with `adb shell am start -d "{{ deep_link_scheme }}://detail/123"`.
{% endif %}

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `!!` not-null assertion | Runtime crash | `?.let { }`, `?:`, safe calls |
| `collectAsState()` | Not lifecycle-aware, leaks | `collectAsStateWithLifecycle()` |
| Unstable params in composables | Unnecessary recomposition | `@Stable` / `@Immutable` on model classes |
| `mutableStateOf` in ViewModel | Compose dependency in ViewModel layer | `MutableStateFlow` + collect in UI |
| Missing `key` in `LazyColumn` | Wrong items after reorder/delete | `items(list, key = { it.id })` |
| `GlobalScope.launch` | Unscoped, leaks, untestable | `viewModelScope` / `LaunchedEffect` |
| Side effects in composition | Runs on every recomposition | `LaunchedEffect`, `DisposableEffect`, `SideEffect` |
| Storing tokens in SharedPreferences | Not encrypted | Use `EncryptedSharedPreferences` |
| Missing notification channel | Notifications silently dropped (Android 8+) | Create channels at app startup |

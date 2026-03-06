# Framework — Kotlin (Android)

> This skill defines Android-specific patterns for the **{{ name }}** service.
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
// app/di/AppModule.kt
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideApiClient(): ApiClient {
        return ApiClient(baseUrl = BuildConfig.API_BASE_URL)
    }

    @Provides
    @Singleton
    fun provideUserRepository(apiClient: ApiClient, userDao: UserDao): UserRepository {
        return UserRepositoryImpl(apiClient, userDao)
    }
}
```

```kotlin
// MainActivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity(R.layout.activity_main) {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val navController = findNavController(R.id.navHostFragment)
        // setup with bottom nav or toolbar as needed
    }
}
```

**Rules:**
- Use **Hilt** for dependency injection — annotate `Application` with `@HiltAndroidApp`, activities/fragments with `@AndroidEntryPoint`.
- Register dependencies in Hilt modules (`@Module` + `@InstallIn`).
- Use `SingletonComponent` for app-scoped, `ViewModelComponent` for ViewModel-scoped.
- Single-Activity architecture with Fragments as screens.

---

## 2. Navigation

Use **Navigation Component** with nav graph XML.

{% if navigation_pattern == "tab" %}
**Tab / Bottom navigation:**

```xml
<!-- res/navigation/nav_graph.xml -->
<navigation xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    app:startDestination="@id/homeFragment">

    <fragment android:id="@+id/homeFragment"
        android:name="com.company.app.features.home.ui.HomeFragment"
        android:label="Home" />
    <fragment android:id="@+id/searchFragment"
        android:name="com.company.app.features.search.ui.SearchFragment"
        android:label="Search" />
    <fragment android:id="@+id/profileFragment"
        android:name="com.company.app.features.profile.ui.ProfileFragment"
        android:label="Profile" />
</navigation>
```

```kotlin
// MainActivity
val navController = findNavController(R.id.navHostFragment)
binding.bottomNavigation.setupWithNavController(navController)
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Drawer navigation:**

```xml
<!-- res/layout/activity_main.xml -->
<DrawerLayout ...>
    <LinearLayout ...>
        <Toolbar android:id="@+id/toolbar" ... />
        <FragmentContainerView android:id="@+id/navHostFragment" ... />
    </LinearLayout>
    <NavigationView android:id="@+id/navView"
        app:menu="@menu/drawer_menu" />
</DrawerLayout>
```

```kotlin
val navController = findNavController(R.id.navHostFragment)
val appBarConfig = AppBarConfiguration(
    setOf(R.id.homeFragment, R.id.settingsFragment),
    binding.drawerLayout
)
setupActionBarWithNavController(navController, appBarConfig)
binding.navView.setupWithNavController(navController)
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation:**

```xml
<navigation app:startDestination="@id/homeFragment">
    <fragment android:id="@+id/homeFragment" ...>
        <action android:id="@+id/action_home_to_detail"
            app:destination="@id/detailFragment" />
    </fragment>
    <fragment android:id="@+id/detailFragment" ...>
        <argument android:name="itemId" app:argType="string" />
    </fragment>
</navigation>
```

```kotlin
// Navigate with Safe Args
val action = HomeFragmentDirections.actionHomeToDetail(itemId = "123")
findNavController().navigate(action)
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested graphs:**

```xml
<!-- res/navigation/home_graph.xml -->
<navigation android:id="@+id/homeGraph"
    app:startDestination="@id/homeListFragment">
    <fragment android:id="@+id/homeListFragment" ...>
        <action android:id="@+id/action_list_to_detail"
            app:destination="@id/homeDetailFragment" />
    </fragment>
    <fragment android:id="@+id/homeDetailFragment" ...>
        <argument android:name="itemId" app:argType="string" />
    </fragment>
</navigation>
```

```xml
<!-- res/navigation/nav_graph.xml -->
<navigation app:startDestination="@id/homeGraph">
    <include app:graph="@navigation/home_graph" />
    <fragment android:id="@+id/profileFragment" ... />
</navigation>
```

```kotlin
binding.bottomNavigation.setupWithNavController(navController)
```
{% endif %}

**Safe Args for type-safe navigation:**

```kotlin
// Receiving arguments
@AndroidEntryPoint
class DetailFragment : Fragment(R.layout.fragment_detail) {
    private val args: DetailFragmentArgs by navArgs()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val itemId = args.itemId
    }
}
```

**Auth flow:**

```kotlin
navController.addOnDestinationChangedListener { _, destination, _ ->
    if (destination.id != R.id.loginFragment && !authManager.isAuthenticated) {
        navController.navigate(R.id.loginFragment)
    }
}
```

**Rules:**
- Use **Safe Args** plugin — no manual Bundle construction.
- Define navigation graph in XML under `res/navigation/`.
- Single Activity with `NavHostFragment` — Fragments as screens.
- Auth guard: use `OnDestinationChangedListener` or nav graph `<action>` with popUpTo.

---

## 3. Data Fetching

**Use Retrofit + coroutines.**

```kotlin
// data/remote/UserApi.kt
interface UserApi {
    @GET("users/{id}")
    suspend fun getById(@Path("id") id: String): UserDto

    @GET("users")
    suspend fun getAll(): List<UserDto>
}
```

```kotlin
// data/remote/ApiClient.kt
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenStore: TokenStore): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore))
            .connectTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApi {
        return retrofit.create(UserApi::class.java)
    }
}
```

**Auth interceptor:**

```kotlin
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder().apply {
            tokenStore.accessToken?.let { addHeader("Authorization", "Bearer $it") }
        }.build()

        val response = chain.proceed(request)
        if (response.code == 401) {
            // trigger logout or token refresh
        }
        return response
    }
}
```

**Repository pattern:**

```kotlin
class UserRepositoryImpl @Inject constructor(
    private val api: UserApi,
    private val dao: UserDao
) : UserRepository {

    override suspend fun getUsers(): Result<List<User>> = runCatching {
        val remote = api.getAll()
        val entities = remote.map { it.toEntity() }
        dao.insertAll(entities)
        entities.map { it.toDomain() }
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
- Cache critical data locally (Room database) for offline access.
- Queue mutations when offline using WorkManager, sync when connection restored.
- Monitor connectivity via `ConnectivityManager` + `NetworkCallback`.
- Show clear UI indicators for offline state and pending syncs.
- Resolve conflicts with server-wins or last-write-wins strategy (document which).

```kotlin
val connectivityManager = getSystemService<ConnectivityManager>()
val networkCallback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) { /* online */ }
    override fun onLost(network: Network) { /* offline */ }
}
connectivityManager?.registerDefaultNetworkCallback(networkCallback)
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

**Permission handling pattern (Activity Result API):**

```kotlin
private val cameraPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission()
) { isGranted ->
    if (isGranted) {
        openCamera()
    } else {
        showPermissionDeniedDialog()
    }
}

fun requestCamera() {
    when {
        ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED -> openCamera()
        shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) ->
            showRationaleDialog { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) }
        else -> cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
    }
}
```

**Rules:**
- Use **Activity Result API** — not deprecated `onRequestPermissionsResult`.
- Request permissions at point of use, not on app launch.
- Always handle denial gracefully — show rationale and settings link.
- Check permission status before each use (user can revoke anytime).

---

## 6. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Setup pattern (Firebase Messaging):**

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

```xml
<!-- AndroidManifest.xml -->
<service android:name=".app.AppFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

**Rules:**
- Register for push tokens after auth completes.
- Handle data-only messages in `onMessageReceived`.
- Create notification channels (required Android 8+).
- Deep link from notification payload via PendingIntent + NavDeepLinkBuilder.
{% endif %}

---

## 7. Performance

- **RecyclerView:** Use `DiffUtil` / `ListAdapter` for efficient list updates. Set fixed size when possible.
- **Images:** Use **Coil** or **Glide** for cached network images.
- **Startup:** Use **App Startup** library for initializer ordering. Defer non-critical work.
- **Memory:** Avoid leaking Context in long-lived objects. Use `applicationContext` for singletons.
- **Background:** Use **WorkManager** for guaranteed background work — not raw coroutines.
- **Strict Mode:** Enable in debug builds to catch disk/network on main thread.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

```kotlin
if (BuildConfig.DEBUG) {
    StrictMode.setThreadPolicy(
        StrictMode.ThreadPolicy.Builder().detectAll().penaltyLog().build()
    )
}
```

---

## 8. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```xml
<!-- res/navigation/nav_graph.xml -->
<fragment android:id="@+id/userProfileFragment" ...>
    <deepLink app:uri="{{ deep_link_scheme }}://user/{userId}" />
    <deepLink app:uri="https://yourdomain.com/user/{userId}" />
    <argument android:name="userId" app:argType="string" />
</fragment>
```

```xml
<!-- AndroidManifest.xml -->
<activity android:name=".MainActivity">
    <nav-graph android:value="@navigation/nav_graph" />
</activity>
```

**Rules:**
- Define deep links in nav graph XML — Navigation Component handles routing.
- Validate deep link parameters in the destination Fragment.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
- Test with `adb shell am start -d "{{ deep_link_scheme }}://user/123"`.
{% endif %}

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| `!!` not-null assertion | Runtime crash | `?.let { }`, `?:`, safe calls |
| Leaking Activity/Fragment | Memory leak, crash | `[weak]` refs, `viewLifecycleOwner` |
| Collecting Flow in `onCreate` | Survives config change, duplicate collection | `repeatOnLifecycle(STARTED)` |
| `GlobalScope.launch` | Unscoped, leaks, untestable | `viewModelScope` / `lifecycleScope` |
| Manual Fragment transactions | Error-prone back stack | Navigation Component + Safe Args |
| Storing tokens in SharedPreferences | Not encrypted | Use `EncryptedSharedPreferences` |
| Blocking main thread | ANR dialog | Suspend functions + Dispatchers.IO |
| Missing notification channel | Notifications silently dropped (Android 8+) | Create channels at app startup |

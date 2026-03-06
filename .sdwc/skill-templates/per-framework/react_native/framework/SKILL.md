# Framework — React Native

> This skill defines React Native-specific patterns for the **{{ name }}** service.
> Approach: **{{ approach }}** | Navigation: **{{ navigation_pattern }}**
> Min OS: **{{ min_os_versions }}**
> Read this before building or modifying any mobile logic.

---

## 1. Application Bootstrap

```typescript
// app/App.tsx
import { Providers } from "./providers";
import { RootNavigator } from "./navigation";

export function App() {
  return (
    <Providers>
      <RootNavigator />
    </Providers>
  );
}
```

**Provider nesting order:**

```typescript
// app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            {children}
          </SafeAreaProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## 2. Navigation

{% if navigation_pattern == "tab" %}
**Tab navigation:**

```typescript
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```
{% endif %}
{% if navigation_pattern == "drawer" %}
**Drawer navigation:**

```typescript
import { createDrawerNavigator } from "@react-navigation/drawer";

const Drawer = createDrawerNavigator<DrawerParamList>();

function DrawerNavigator() {
  return (
    <Drawer.Navigator>
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}
```
{% endif %}
{% if navigation_pattern == "stack" %}
**Stack navigation:**

```typescript
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
    </Stack.Navigator>
  );
}
```
{% endif %}
{% if navigation_pattern == "bottom_nav" %}
**Bottom navigation with nested stacks:**

```typescript
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="HomeList" component={HomeListScreen} />
      <HomeStack.Screen name="HomeDetail" component={HomeDetailScreen} />
    </HomeStack.Navigator>
  );
}

function RootNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```
{% endif %}

**Navigation type safety:**

```typescript
type RootStackParamList = {
  Home: undefined;
  UserProfile: { userId: string };
  Settings: undefined;
};

// In screens:
const route = useRoute<RouteProp<RootStackParamList, "UserProfile">>();
const { userId } = route.params;
```

**Rules:**
- Define all navigation types in one place (`types/navigation.ts`).
- Always type navigation params — no untyped `navigation.navigate("Screen")`.
- Auth flow: use separate navigators for authenticated vs unauthenticated states.

---

## 3. Data Fetching

**Same pattern as React web — use React Query.**

```typescript
export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => userApi.getById(id),
  });
}
```

**API client setup:**

```typescript
// services/apiClient.ts
const API_BASE = Config.API_URL;  // from react-native-config

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json();
}
```

---

## 4. Offline Support

{% if offline_support %}
**Offline support: enabled**
{% if local_storage %}**Local storage: {{ local_storage }}**{% endif %}
{% if sync_strategy %}**Sync strategy: {{ sync_strategy }}**{% endif %}

**Rules:**
- Cache critical data locally for offline access.
- Queue mutations when offline, sync when connection restored.
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

```typescript
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";

async function requestCameraPermission(): Promise<boolean> {
  const result = await request(
    Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
  );
  return result === RESULTS.GRANTED;
}
```

**Rules:**
- Request permissions at point of use, not on app launch.
- Always handle denial gracefully — show explanation and alternative.
- Check permission status before each use (user can revoke anytime).

---

## 6. Push Notifications

{% if push_notification %}
**Service: {{ push_notification.service }}**

{% for type_i in push_notification.types %}
- **{{ type_i.type }}**: trigger={{ type_i.trigger }}, content={{ type_i.content }}
{% endfor %}

**Rules:**
- Register for push tokens on app start (after auth).
- Handle notifications in three states: foreground, background, quit.
- Deep link from notification payload to the relevant screen.
{% endif %}

---

## 7. Performance

- **Lists:** Use `FlatList` with `keyExtractor`. Virtualize large lists.
- **Images:** Use `FastImage` for cached network images.
- **Animations:** Use `react-native-reanimated` for performant animations on the UI thread.
- **Bundle size:** Monitor with `react-native-bundle-visualizer`.
- **Startup:** Minimize work in `App.tsx`. Defer non-critical initialization.
- **Memory:** Avoid storing large data in state. Use pagination for lists.

{% if app_size_target %}
**App size target: {{ app_size_target }}**
{% endif %}

---

## 8. Deep Linking

{% if deep_link_scheme %}
**Scheme: {{ deep_link_scheme }}**

```typescript
const linking = {
  prefixes: ["{{ deep_link_scheme }}", "https://yourdomain.com"],
  config: {
    screens: {
      UserProfile: "user/:userId",
      Settings: "settings",
    },
  },
};

<NavigationContainer linking={linking}>
  ...
</NavigationContainer>
```

**Rules:**
- Validate deep link parameters before navigating.
- Handle invalid/expired deep links gracefully (redirect to home or show error).
{% endif %}

---

## 9. Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Inline styles | Re-created every render | `StyleSheet.create()` outside component |
| Missing `keyExtractor` | Poor list performance | Always provide stable unique keys |
| Unhandled permission denial | App crash or bad UX | Always handle denial case |
| Storing sensitive data in AsyncStorage | Security risk | Use Keychain/Keystore for tokens |
| Ignoring keyboard | Input hidden behind keyboard | `KeyboardAvoidingView` + scroll |
| Platform-specific bugs | Works on iOS, breaks Android | Test on both platforms regularly |
| Large images in state | Memory pressure, OOM | Use disk cache, display with URI |

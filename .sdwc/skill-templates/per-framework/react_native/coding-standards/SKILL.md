# Coding Standards — React Native

> This skill defines coding rules for the **{{ name }}** service (React Native / TypeScript).
> Read this before writing or reviewing any code for this service.

---

## 1. Project Structure

```
{{ name }}/
├── src/
│   ├── app/                      ← app root (navigation, providers)
│   │   ├── App.tsx
│   │   ├── navigation.tsx
│   │   └── providers.tsx
│   ├── screens/                  ← screen-level components (one per route)
│   │   └── {ScreenName}/
│   │       ├── index.tsx
│   │       ├── components/
│   │       └── hooks/
│   ├── components/               ← shared/reusable components
│   │   └── {ComponentName}/
│   │       ├── {ComponentName}.tsx
│   │       └── {ComponentName}.test.tsx
│   ├── hooks/                    ← shared custom hooks
│   ├── services/                 ← API call functions
│   │   └── {resource}Api.ts
│   ├── stores/                   ← global state management
│   ├── types/                    ← shared TypeScript types
│   ├── utils/                    ← pure utility functions
│   ├── constants/                ← app-wide constants
│   └── assets/                   ← images, fonts
├── __tests__/
├── android/
├── ios/
├── package.json
└── tsconfig.json
```

**Rules:**
- One component per file. File name matches component name (PascalCase).
- Screen-scoped components stay in the screen folder. Promote when shared by 2+ screens.
- Platform-specific code uses `.ios.tsx` / `.android.tsx` suffixes.
- `services/` contains only API call functions — no UI logic.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Screens | PascalCase + `Screen` | `ProfileScreen.tsx` |
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Utility functions | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `User`, `NavigationParams` |
| Constants | UPPER_SNAKE | `API_BASE_URL` |
| Event handlers | `handle` + event | `handlePress`, `handleSubmit` |
| Boolean props/state | `is`/`has`/`should` prefix | `isLoading`, `hasError` |
| Navigation routes | PascalCase | `"UserProfile"`, `"Settings"` |

---

## 3. TypeScript Rules

**Strict mode enabled.** Same rules as React — no `any`, full type annotations.

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Navigation typing:**

```typescript
type RootStackParamList = {
  Home: undefined;
  UserProfile: { userId: string };
  Settings: undefined;
};

// Typed navigation
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

---

## 4. Import Order

```typescript
// 1. React / React Native
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";

// 2. Third-party
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

// 3. Internal — absolute path
import { Button } from "@/components/Button";
import { useAuth } from "@/hooks/useAuth";

// 4. Relative — local
import { ProfileHeader } from "./components/ProfileHeader";
```

**Rules:**
- Use path aliases (`@/` = `src/`).
- Separate React Native imports from third-party.

---

## 5. Component Patterns

### Functional components only

```typescript
export function UserCard({ user, onPress }: UserCardProps) {
  return (
    <Pressable onPress={() => onPress(user.id)}>
      <Text>{user.name}</Text>
    </Pressable>
  );
}
```

### Use `Pressable` over `TouchableOpacity`

`Pressable` is the modern API with better customization.

### StyleSheet

```typescript
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

**Rules:**
- Define styles with `StyleSheet.create()` outside the component — not inline objects.
- Use named exports for components (no default exports).

---

## 6. Linting & Formatting

| Tool | Purpose | Config location |
|------|---------|----------------|
| **ESLint** | Linter | `.eslintrc.js` |
| **Prettier** | Formatter | `.prettierrc` |

```bash
eslint src/ --fix
prettier --write src/
tsc --noEmit
```

**Additional plugins:** `@react-native/eslint-config`, `eslint-plugin-react-hooks`.

---

## 7. Anti-patterns

| ❌ Anti-pattern | ✅ Correct approach |
|----------------|-------------------|
| Inline style objects | `StyleSheet.create()` outside component |
| `any` type | Proper types or `unknown` with guard |
| Business logic in screens | Extract to hooks or services |
| Direct native module calls everywhere | Wrap in a hook or utility |
| Ignoring keyboard avoidance | Use `KeyboardAvoidingView` |
| Hard-coded dimensions | Use `Dimensions`, responsive units, or flex |
| `console.log` in production | Use structured logger (→ skills/common/observability/) |

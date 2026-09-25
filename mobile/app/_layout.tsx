import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#f9fafb',
        contentStyle: { backgroundColor: '#030712' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Sync Party' }} />
    </Stack>
  );
}

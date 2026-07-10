import { Tabs } from 'expo-router';
import { Home, Search, BookOpen, User } from 'lucide-react-native';
import { colors } from '../../src/lib/theme';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray[100],
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Find Care', tabBarIcon: ({ color, size }) => <Search size={size} color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
      {/* Hidden screens (accessed via navigation) */}
      <Tabs.Screen name="caregiver/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/review" options={{ href: null }} />
      <Tabs.Screen name="booking/track" options={{ href: null }} />
      <Tabs.Screen name="booking/chat" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="medications" options={{ href: null }} />
      <Tabs.Screen name="ai-care" options={{ href: null }} />
    </Tabs>
  );
}

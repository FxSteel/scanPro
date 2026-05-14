import React from 'react';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

import LoginScreen from '../screens/LoginScreen';
import ScanScreen from '../screens/ScanScreen';
import PackagesScreen from '../screens/PackagesScreen';
import RoutesScreen from '../screens/RoutesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { RetiroIcon, PackageIcon, RoutesIcon, ProfileIcon } from '../components/TabIcons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ProfileButton({ navigation }: { navigation: any }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('ProfileModal')}
      style={{ marginRight: 12 }}
    >
      <ProfileIcon color="#fff" size={24} />
    </TouchableOpacity>
  );
}

function MainTabs() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { paddingBottom: 4, height: 56 },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerRight: () => <ProfileButton navigation={navigation} />,
      })}
    >
      <Tab.Screen
        name="Retiros"
        component={ScanScreen}
        options={{
          title: 'Retiros',
          tabBarLabel: 'Retiros',
          headerTitle: 'Retiro de paquetes',
          tabBarIcon: ({ color, size }) => <RetiroIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Packages"
        component={PackagesScreen}
        options={{
          title: 'Paquetes',
          tabBarLabel: 'Paquetes',
          headerTitle: user?.role === 'admin' ? 'Todos los paquetes' : 'Mis paquetes',
          tabBarIcon: ({ color, size }) => <PackageIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Routes"
        component={RoutesScreen}
        options={{
          title: 'Rutas',
          tabBarLabel: 'Rutas',
          headerTitle: user?.role === 'admin' ? 'Todas las rutas' : 'Mis rutas',
          tabBarIcon: ({ color, size }) => <RoutesIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ProfileModal"
              component={ProfileScreen}
              options={{
                headerShown: true,
                headerTitle: 'Mi perfil',
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: '#fff',
                presentation: 'modal',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

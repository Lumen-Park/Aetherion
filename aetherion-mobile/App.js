import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/Login';
import DashboardScreen from './src/screens/Dashboard';
import TaskScreen from './src/screens/Task';
import AgentsScreen from './src/screens/Agents';
import CouncilScreen from './src/screens/Council';
import OverrideScreen from './src/screens/Override';
import { theme } from './src/ui/AetherionUI';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [booting, setBooting] = useState(true);
  useEffect(() => { SecureStore.getItemAsync('aetherion_token').then((token) => setIsAuth(Boolean(token))).finally(() => setBooting(false)); }, []);

  if (booting) return <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }}><ActivityIndicator color={theme.cyan} /><Text style={{ color: theme.muted, fontWeight: '700' }}>Preparing workspace…</Text></View>;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.text, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false, contentStyle: { backgroundColor: theme.bg } }}>
        {!isAuth ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={() => setIsAuth(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'AETHERION' }} />
            <Stack.Screen name="Task" component={TaskScreen} options={{ title: 'TASK PULSE' }} />
            <Stack.Screen name="Agents" component={AgentsScreen} options={{ title: 'AGENT ROSTER' }} />
            <Stack.Screen name="Council" component={CouncilScreen} options={{ title: 'COUNCIL' }} />
            <Stack.Screen name="Override" component={OverrideScreen} options={{ title: 'OVERRIDE' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

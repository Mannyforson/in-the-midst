import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import MeetingScreen from './src/screens/MeetingScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#14111d' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#14111d' },
        }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'In the Midst' }} />
        <Stack.Screen
          name="Meeting"
          component={MeetingScreen}
          options={{ title: 'Gathering', gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

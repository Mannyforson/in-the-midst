import React, { Suspense } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';

// The gathering screen pulls in the video-call engine (react-native-webrtc)
// through MeetingScreen -> rtc.js and VideoTiles. That engine must NOT load
// at app startup: on the first TestFlight build it kept the home screen from
// ever painting (splash, then black). So the gathering screen loads lazily —
// only when the user actually enters a gathering — and any failure while
// loading it shows a plain message instead of a black screen.
const MeetingScreen = React.lazy(() => import('./src/screens/MeetingScreen'));

class MeetingErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Video could not start on this phone.</Text>
          <Text style={styles.fallbackSub}>Go back and try again.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function MeetingFallback() {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>Opening the gathering…</Text>
    </View>
  );
}

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
          options={{ title: 'Gathering', gestureEnabled: false }}>
          {({ route, navigation }) => (
            <MeetingErrorBoundary>
              <Suspense fallback={<MeetingFallback />}>
                <MeetingScreen route={route} navigation={navigation} />
              </Suspense>
            </MeetingErrorBoundary>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#14111d', alignItems: 'center', justifyContent: 'center', padding: 20 },
  fallbackText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  fallbackSub: { color: '#aaa', fontSize: 14, marginTop: 8, textAlign: 'center' },
});

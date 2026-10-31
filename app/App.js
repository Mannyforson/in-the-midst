import React, { Suspense, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';

// DIAGNOSTIC BUILD — build 3 (lazy video engine) still opened to a black
// screen, so the video engine was NOT the cause. This build stages startup
// so the phone itself tells us where it stops:
//   - "BOOT OK" stuck on screen  -> the app mounts but never reaches navigation.
//   - an error message on screen -> the exact render error, finally visible.
//   - black with no "BOOT OK"    -> the app never paints at all (native/bundle).
//   - the home screen            -> it works.
// The gathering screen stays lazy (react-native-webrtc loads only when a
// gathering is entered), exactly as in build 3.
const MeetingScreen = React.lazy(() => import('./src/screens/MeetingScreen'));

class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <ScrollView style={styles.fallback} contentContainerStyle={styles.fallbackContent}>
          <Text style={styles.fallbackText}>The app hit an error while starting:</Text>
          <Text style={styles.fallbackSub}>{String((e && e.message) || e)}</Text>
          <Text style={styles.fallbackSub}>{String((e && e.stack) || '')}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

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
  const [stage, setStage] = useState('boot');
  useEffect(() => {
    setStage('nav');
  }, []);

  if (stage === 'boot') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>BOOT OK — loading the app…</Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#14111d' },
  fallbackContent: { alignItems: 'center', justifyContent: 'center', padding: 20, flexGrow: 1 },
  fallbackText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  fallbackSub: { color: '#aaa', fontSize: 13, marginTop: 8, textAlign: 'center' },
});

// AsyncStorage wrapper mirroring the web app's localStorage store.get/set.
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function get(key, fallback) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

async function set(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — non-fatal, same as the web app
  }
}

module.exports = { get, set };

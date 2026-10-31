import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { TYPES, formatCode, normalizeCode } from '../constants';
import { createRoom, lookupRoom } from '../signaling';
import storage from '../storage';

const TYPE_KEYS = Object.keys(TYPES);

export default function HomeScreen({ navigation }) {
  const [name, setName] = useState('');
  const [tab, setTab] = useState('start');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('prayer');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [code, setCode] = useState('');
  const [joinInfo, setJoinInfo] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setName(await storage.get('ur:name', ''));
      setRecent(await storage.get('ur:hosted', []));
    })();
  }, []);

  const checkName = () => {
    if (!name.trim()) {
      setError('Enter your name first.');
      return false;
    }
    return true;
  };

  const onCodeChange = async (text) => {
    const formatted = formatCode(text);
    setCode(formatted);
    setJoinInfo('');
    if (formatted.replace(/\D/g, '').length !== 9) return;
    try {
      const d = await lookupRoom(formatted);
      setJoinInfo(
        `${d.title} · ${d.typeLabel} · ${d.count ? `${d.count} here now` : 'no one here yet'}`,
      );
    } catch (e) {
      setJoinInfo(e.message);
    }
  };

  const startGathering = async () => {
    if (!checkName()) return;
    setBusy(true);
    setError('');
    try {
      await storage.set('ur:name', name.trim());
      const d = await createRoom({ title: title.trim(), type, waitingRoom });
      await storage.set(`ur:host:${d.id}`, d.hostKey);
      const list = (await storage.get('ur:hosted', [])).filter((x) => x.id !== d.id);
      list.unshift({ id: d.id, title: d.title, type: d.type });
      await storage.set('ur:hosted', list.slice(0, 12));
      setRecent(list.slice(0, 12));
      navigation.navigate('Meeting', {
        roomId: d.id,
        name: name.trim(),
        asHost: true,
      });
    } catch {
      setError('Could not start the gathering. Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const joinGathering = (roomId) => {
    if (roomId.replace(/\D/g, '').length !== 9) {
      setError('Enter the 9-digit meeting code, e.g. 123-456-789.');
      return;
    }
    if (!checkName()) return;
    storage.set('ur:name', name.trim());
    navigation.navigate('Meeting', {
      roomId: normalizeCode(roomId),
      name: name.trim(),
      asHost: false,
    });
  };

  const forgetRecent = async (id) => {
    const list = recent.filter((x) => x.id !== id);
    await storage.set('ur:hosted', list);
    setRecent(list);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>In the Midst</Text>
      <Text style={styles.sub}>Where two or three gather.</Text>

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Mary"
        placeholderTextColor="#888"
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'start' && styles.tabActive]}
          onPress={() => setTab('start')}>
          <Text style={[styles.tabText, tab === 'start' && styles.tabTextActive]}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'join' && styles.tabActive]}
          onPress={() => setTab('join')}>
          <Text style={[styles.tabText, tab === 'join' && styles.tabTextActive]}>Join</Text>
        </TouchableOpacity>
      </View>

      {tab === 'start' ? (
        <View>
          <Text style={styles.label}>Gathering title (optional)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Sunday prayer"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Type</Text>
          {TYPE_KEYS.map((k) => (
            <TouchableOpacity key={k} style={styles.typeRow} onPress={() => setType(k)}>
              <Text style={[styles.typeText, type === k && styles.typeTextActive]}>
                {type === k ? '● ' : '○ '}
                {TYPES[k]}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Use a waiting room</Text>
            <Switch value={waitingRoom} onValueChange={setWaitingRoom} />
          </View>
          <TouchableOpacity
            style={[styles.primary, busy && styles.disabled]}
            onPress={startGathering}
            disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Starting…' : 'Start gathering'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>9-digit code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={onCodeChange}
            placeholder="123-456-789"
            placeholderTextColor="#888"
            keyboardType="number-pad"
          />
          {!!joinInfo && <Text style={styles.info}>{joinInfo}</Text>}
          <TouchableOpacity style={styles.primary} onPress={() => joinGathering(code)}>
            <Text style={styles.primaryText}>Join gathering</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {recent.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.label}>Your gatherings</Text>
          {recent.map((r) => (
            <View key={r.id} style={styles.recentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>{r.title}</Text>
                <Text style={styles.recentMeta}>
                  {TYPES[r.type] || ''} · {r.id}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.smallPrimary}
                onPress={() => {
                  if (!checkName()) return;
                  storage.set('ur:name', name.trim());
                  navigation.navigate('Meeting', {
                    roomId: r.id,
                    name: name.trim(),
                    asHost: true,
                  });
                }}>
                <Text style={styles.smallPrimaryText}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallGhost} onPress={() => forgetRecent(r.id)}>
                <Text style={styles.smallGhostText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14111d' },
  content: { padding: 20, paddingBottom: 40 },
  brand: { color: '#e8b14f', fontSize: 28, fontWeight: '700', marginTop: 12 },
  sub: { color: '#aaa', fontSize: 14, marginBottom: 24 },
  label: { color: '#ddd', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#221d33',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  tabs: { flexDirection: 'row', marginTop: 20, marginBottom: 8 },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  tabActive: { borderBottomColor: '#e8b14f' },
  tabText: { color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  typeRow: { paddingVertical: 8 },
  typeText: { color: '#bbb', fontSize: 16 },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: { color: '#ddd', fontSize: 15 },
  primary: {
    backgroundColor: '#e8b14f',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#14111d', fontSize: 16, fontWeight: '700' },
  info: { color: '#aaa', marginTop: 8 },
  error: { color: '#ff7a7a', marginTop: 12 },
  recent: { marginTop: 32 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  recentTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  recentMeta: { color: '#888', fontSize: 12 },
  smallPrimary: { backgroundColor: '#e8b14f', borderRadius: 8, padding: 8, marginLeft: 8 },
  smallPrimaryText: { color: '#14111d', fontWeight: '700' },
  smallGhost: { padding: 8, marginLeft: 4 },
  smallGhostText: { color: '#888' },
});

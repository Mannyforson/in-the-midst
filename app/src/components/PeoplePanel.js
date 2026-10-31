import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// People + host controls panel, mirroring the web app's people panel.
// Server protocol (server.js, all via 'host:action' { action, target, value }):
//   Waiting room: 'admit' (target), 'admit-all', 'deny' (target).
//   Per person: 'mute', 'ask-unmute', 'stop-video', 'lower-hand',
//   'make-host', 'spotlight' (target; repeat to clear), 'remove'.
//   Room-wide: 'mute-all', 'lower-all-hands', 'lock' (value bool),
//   'waiting-room' (value bool). 'end' already lives on MeetingScreen.
// Non-hosts see the lists but no action buttons (the server enforces
// host-only regardless).
export default function PeoplePanel({ room, selfId, isHost, onHostAction }) {
  const participants = room.participants || [];
  const waiting = room.waiting || [];
  const recording = room.recording || [];

  return (
    <ScrollView style={styles.root}>
      {recording.length > 0 && (
        <Text style={styles.recording}>● Recording — {recording.join(', ')}</Text>
      )}

      {waiting.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waiting room ({waiting.length})</Text>
          {waiting.map((w) => (
            <View key={w.id} style={styles.row}>
              <Text style={styles.name}>{w.name}</Text>
              {isHost && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.admit}
                    onPress={() => onHostAction('admit', w.id)}>
                    <Text style={styles.admitText}>Admit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deny}
                    onPress={() => onHostAction('deny', w.id)}>
                    <Text style={styles.denyText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          {isHost && waiting.length > 1 && (
            <TouchableOpacity style={styles.admitAll} onPress={() => onHostAction('admit-all')}>
              <Text style={styles.admitText}>Admit all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isHost && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host controls</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('mute-all')}>
              <Text style={styles.ctlText}>Mute all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('lower-all-hands')}>
              <Text style={styles.ctlText}>Lower all hands</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctl}
              onPress={() => onHostAction('lock', null, !room.locked)}>
              <Text style={styles.ctlText}>{room.locked ? 'Unlock gathering' : 'Lock gathering'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctl}
              onPress={() => onHostAction('waiting-room', null, !room.waitingRoom)}>
              <Text style={styles.ctlText}>
                Waiting room: {room.waitingRoom ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Here now ({participants.length})</Text>
        {participants.map((p) => (
          <View key={p.id} style={styles.person}>
            <Text style={styles.name}>
              {p.name}
              {p.id === selfId ? ' (You)' : ''}
              {p.host ? ' · Host' : ''}
            </Text>
            <Text style={styles.meta}>
              {p.mic ? 'mic on' : 'muted'} · {p.cam || p.sharing ? 'video on' : 'video off'}
              {p.hand ? ' · ✋' : ''}
              {room.spotlight === p.id ? ' · ⭐ Spotlight' : ''}
            </Text>
            {isHost && p.id !== selfId && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('mute', p.id)}>
                  <Text style={styles.ctlText}>Mute</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('ask-unmute', p.id)}>
                  <Text style={styles.ctlText}>Ask to unmute</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('stop-video', p.id)}>
                  <Text style={styles.ctlText}>Video off</Text>
                </TouchableOpacity>
                {p.hand && (
                  <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('lower-hand', p.id)}>
                    <Text style={styles.ctlText}>Lower hand</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('make-host', p.id)}>
                  <Text style={styles.ctlText}>Make host</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctl} onPress={() => onHostAction('spotlight', p.id)}>
                  <Text style={styles.ctlText}>
                    {room.spotlight === p.id ? 'Unspotlight' : 'Spotlight'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ctl, styles.remove]}
                  onPress={() => onHostAction('remove', p.id)}>
                  <Text style={styles.ctlText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  recording: { color: '#e88', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#e8b14f', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262039',
  },
  name: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  meta: { color: '#888', fontSize: 12, marginTop: 2 },
  person: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#262039' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  admit: { backgroundColor: '#2e5d3a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 6 },
  admitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deny: { backgroundColor: '#7a2020', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  denyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  admitAll: { backgroundColor: '#2e5d3a', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  ctl: { backgroundColor: '#2a2440', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  ctlText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  remove: { backgroundColor: '#7a2020' },
});

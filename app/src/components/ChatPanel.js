import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// Chat panel, mirroring the web app's chat form + message list.
// Server protocol (server.js): emit 'chat' { text, to } where to is a
// participant id or null for everyone. Broadcast message shape:
// { id, from, name, text, at, to, toName }. Private messages (to set) go
// only to the sender and the recipient; group messages go to the room.
export default function ChatPanel({ messages, selfId, participants, onSend }) {
  const [text, setText] = useState('');
  const [to, setTo] = useState(null); // null = everyone

  const others = participants.filter((p) => p.id !== selfId);
  const toName = to ? participants.find((p) => p.id === to)?.name || '' : 'Everyone';

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, to);
    setText('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.targetRow}>
        <TouchableOpacity
          style={[styles.chip, !to && styles.chipActive]}
          onPress={() => setTo(null)}>
          <Text style={[styles.chipText, !to && styles.chipTextActive]}>Everyone</Text>
        </TouchableOpacity>
        {others.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, to === p.id && styles.chipActive]}
            onPress={() => setTo(p.id)}>
            <Text style={[styles.chipText, to === p.id && styles.chipTextActive]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.list}>
        {messages.length === 0 && (
          <Text style={styles.empty}>No messages yet. Say hello to the gathering.</Text>
        )}
        {messages.map((m) => {
          const mine = m.from === selfId;
          return (
            <View key={m.id} style={[styles.msg, mine && styles.msgMine]}>
              <Text style={styles.msgHead}>
                {mine ? 'You' : m.name}
                {m.to ? ` → ${mine ? m.toName : 'you'} (private)` : ''}
                {' · '}
                {new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={styles.msgText}>{m.text}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message ${toName}…`}
          placeholderTextColor="#777"
          multiline
        />
        <TouchableOpacity style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: {
    backgroundColor: '#2a2440',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: { backgroundColor: '#e8b14f' },
  chipText: { color: '#ccc', fontSize: 13 },
  chipTextActive: { color: '#14111d', fontWeight: '700' },
  list: { maxHeight: 320 },
  empty: { color: '#888', fontSize: 13, marginBottom: 8 },
  msg: { marginBottom: 10, backgroundColor: '#1e1930', borderRadius: 10, padding: 10 },
  msgMine: { backgroundColor: '#2a2440' },
  msgHead: { color: '#e8b14f', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  msgText: { color: '#eee', fontSize: 14, lineHeight: 20 },
  form: { flexDirection: 'row', marginTop: 12, alignItems: 'flex-end' },
  input: {
    flex: 1,
    backgroundColor: '#1e1930',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  send: { backgroundColor: '#e8b14f', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginLeft: 8 },
  sendText: { color: '#14111d', fontWeight: '700' },
});

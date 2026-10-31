import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// Prayer wall, mirroring the web app's prayer panel.
// Server protocol (server.js): state.prayers entries are
// { id, text, by, authorId, at, answered, prayed[] }.
// Emits: 'prayer:add' { text, anonymous }, 'prayer:pray' id (toggle),
// 'prayer:answered' id (toggle, host or author only),
// 'prayer:remove' id (host or author only). The wall persists between
// meetings; the list refreshes through 'state' broadcasts.
export default function PrayerPanel({ prayers, selfId, isHost, onAdd, onPray, onAnswered, onRemove, onShow }) {
  const [filter, setFilter] = useState('open');
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const all = prayers || [];
  const openCount = all.filter((p) => !p.answered).length;
  const answeredCount = all.length - openCount;
  const list = all.filter((p) => (filter === 'answered' ? p.answered : !p.answered));

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, anonymous);
    setText('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, filter === 'open' && styles.tabActive]}
          onPress={() => setFilter('open')}>
          <Text style={[styles.tabText, filter === 'open' && styles.tabTextActive]}>
            Open ({openCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'answered' && styles.tabActive]}
          onPress={() => setFilter('answered')}>
          <Text style={[styles.tabText, filter === 'answered' && styles.tabTextActive]}>
            Answered ({answeredCount})
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="What would you like the group to pray for?"
        placeholderTextColor="#777"
        multiline
        maxLength={600}
      />
      <View style={styles.formRow}>
        <TouchableOpacity style={styles.check} onPress={() => setAnonymous(!anonymous)}>
          <Text style={styles.checkText}>{anonymous ? '☑' : '☐'} Post without my name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.add} onPress={submit}>
          <Text style={styles.addText}>Add request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list}>
        {list.length === 0 && (
          <Text style={styles.empty}>
            {filter === 'answered'
              ? 'When a prayer is answered, mark it here and it moves to this list as a praise report.'
              : 'No requests yet. Add the first one above. Requests stay on this wall between meetings.'}
          </Text>
        )}
        {list.map((p) => {
          const prayed = p.prayed.includes(selfId);
          const mine = p.authorId === selfId;
          return (
            <View key={p.id} style={[styles.item, p.answered && styles.itemAnswered]}>
              {p.answered && <Text style={styles.answeredTag}>Answered</Text>}
              <Text style={styles.itemText}>{p.text}</Text>
              <Text style={styles.meta}>
                {p.by || 'Anonymous'}
                {' · '}
                {new Date(p.at).toLocaleDateString()}
                {p.prayed.length ? ` · ${p.prayed.length} praying` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.action} onPress={() => onPray(p.id)}>
                  <Text style={styles.actionText}>🙏 {prayed ? 'Praying' : 'I prayed'}</Text>
                </TouchableOpacity>
                {(isHost || mine) && (
                  <TouchableOpacity style={styles.action} onPress={() => onAnswered(p.id)}>
                    <Text style={styles.actionText}>{p.answered ? 'Move back' : 'Mark answered'}</Text>
                  </TouchableOpacity>
                )}
                {(isHost || mine) && (
                  <TouchableOpacity style={styles.action} onPress={() => onRemove(p.id)}>
                    <Text style={styles.actionText}>Delete</Text>
                  </TouchableOpacity>
                )}
                {isHost && (
                  <TouchableOpacity style={styles.action} onPress={() => onShow(p)}>
                    <Text style={styles.actionText}>Show to everyone</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { backgroundColor: '#2a2440', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  tabActive: { backgroundColor: '#e8b14f' },
  tabText: { color: '#ccc', fontSize: 13 },
  tabTextActive: { color: '#14111d', fontWeight: '700' },
  input: {
    backgroundColor: '#1e1930',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 70,
  },
  formRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 16 },
  check: { flex: 1 },
  checkText: { color: '#ccc', fontSize: 13 },
  add: { backgroundColor: '#e8b14f', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addText: { color: '#14111d', fontWeight: '700' },
  list: { maxHeight: 360 },
  empty: { color: '#888', fontSize: 13, lineHeight: 19 },
  item: { backgroundColor: '#1e1930', borderRadius: 10, padding: 12, marginBottom: 10 },
  itemAnswered: { opacity: 0.85 },
  answeredTag: { color: '#7dd48a', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  itemText: { color: '#eee', fontSize: 15, lineHeight: 21 },
  meta: { color: '#888', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  action: { backgroundColor: '#2a2440', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

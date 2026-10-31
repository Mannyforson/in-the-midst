import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// Worship lyrics panel, mirroring the web app's renderWorship.
// Server protocol (server.js, host-only):
//   'worship:set' { title, lyrics } — the server splits lyrics into
//   slides on blank lines (max 200 slides) and resets index to 0.
//   'worship:go' index — move to a slide (also re-presents).
//   'worship:stop' — hide the shared lyrics (active=false).
// state.worship is { title, slides[], index, active }.
export default function WorshipPanel({ worship, isHost, onSet, onGo, onStop, onPresent }) {
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');

  const w = worship || { title: '', slides: [], index: 0, active: false };

  const submit = () => {
    if (!lyrics.trim()) return;
    onSet(title.trim(), lyrics);
  };

  const go = (delta) => {
    if (!w.slides.length) return;
    onGo(Math.max(0, Math.min(w.slides.length - 1, w.index + delta)));
  };

  return (
    <ScrollView style={styles.root}>
      {isHost && (
        <View>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Song title"
            placeholderTextColor="#777"
          />
          <TextInput
            style={[styles.input, styles.lyrics]}
            value={lyrics}
            onChangeText={setLyrics}
            placeholder="Lyrics — leave a blank line between slides"
            placeholderTextColor="#777"
            multiline
          />
          <TouchableOpacity style={styles.set} onPress={submit}>
            <Text style={styles.setText}>Present these lyrics</Text>
          </TouchableOpacity>
        </View>
      )}

      {w.active && w.slides.length > 0 && (
        <View style={styles.current}>
          <Text style={styles.currentTitle}>{w.title || 'Worship'}</Text>
          <Text style={styles.currentText}>{w.slides[w.index]}</Text>
          <Text style={styles.count}>
            {w.index + 1} / {w.slides.length}
          </Text>
          {isHost && (
            <View style={styles.ctlRow}>
              <TouchableOpacity style={styles.ctl} onPress={() => go(-1)}>
                <Text style={styles.ctlText}>‹ Prev</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctl} onPress={() => go(1)}>
                <Text style={styles.ctlText}>Next ›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctl} onPress={onStop}>
                <Text style={styles.ctlText}>Stop presenting</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {!w.active && w.slides.length > 0 && isHost && (
        <TouchableOpacity style={styles.set} onPress={onPresent}>
          <Text style={styles.setText}>Present again</Text>
        </TouchableOpacity>
      )}

      {w.slides.length > 0 && (
        <View style={styles.slideList}>
          <Text style={styles.sectionTitle}>Slides</Text>
          {w.slides.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.slide, w.active && i === w.index && styles.slideCurrent]}
              onPress={() => isHost && onGo(i)}
              disabled={!isHost}>
              <Text style={styles.slideText} numberOfLines={2}>
                {i + 1}. {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!w.slides.length && !isHost && (
        <Text style={styles.empty}>No song is being presented yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  input: {
    backgroundColor: '#1e1930',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  lyrics: { minHeight: 140 },
  set: { backgroundColor: '#e8b14f', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  setText: { color: '#14111d', fontWeight: '700' },
  current: { backgroundColor: '#1e1930', borderRadius: 12, padding: 16, marginBottom: 16 },
  currentTitle: { color: '#e8b14f', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  currentText: { color: '#fff', fontSize: 20, lineHeight: 30 },
  count: { color: '#aaa', fontSize: 13, marginTop: 10 },
  ctlRow: { flexDirection: 'row', marginTop: 12 },
  ctl: { backgroundColor: '#2a2440', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginRight: 8 },
  ctlText: { color: '#fff', fontWeight: '600' },
  slideList: { marginBottom: 16 },
  sectionTitle: { color: '#e8b14f', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  slide: { backgroundColor: '#1e1930', borderRadius: 8, padding: 10, marginBottom: 6 },
  slideCurrent: { borderWidth: 1, borderColor: '#e8b14f' },
  slideText: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  empty: { color: '#888', fontSize: 13 },
});

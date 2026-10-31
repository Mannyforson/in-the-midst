import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Shared on-screen card, mirroring the web app's overlay render.
// state.overlay is { kind: 'prayer' | 'verse', title, text, by } or null.
// 'overlay:show' with kind 'prayer' is host-only server-side; a verse may
// be shown by anyone. Any participant may clear it ('overlay:clear').
export default function OverlayBanner({ overlay, onClear }) {
  if (!overlay) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.label}>
        {overlay.kind === 'prayer' ? 'Let us pray' : 'Scripture'} · on everyone’s screen
      </Text>
      <Text style={styles.title}>{overlay.title}</Text>
      <Text style={styles.text}>{overlay.text}</Text>
      {!!overlay.by && <Text style={styles.by}>Shared by {overlay.by}</Text>}
      <TouchableOpacity style={styles.clear} onPress={onClear}>
        <Text style={styles.clearText}>Remove from screen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#2a2440', borderRadius: 12, padding: 14, marginTop: 16 },
  label: { color: '#e8b14f', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  text: { color: '#eee', fontSize: 15, lineHeight: 22 },
  by: { color: '#aaa', fontSize: 12, marginTop: 8 },
  clear: { backgroundColor: '#1e1930', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 },
  clearText: { color: '#fff', fontWeight: '600' },
});

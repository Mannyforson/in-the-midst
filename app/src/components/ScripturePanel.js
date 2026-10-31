import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// Scripture panel, mirroring the web app's lookupVerse + overlay wiring.
// Lookup uses bible-api.com exactly like the web app:
//   https://bible-api.com/<ref>?translation=<tr>
// with spaces as '+' and ':' unescaped. Translations offered by the web
// app: kjv, web, bbe, darby.
// Emits: 'overlay:show' { kind: 'verse', title, text } (any participant
// may show a verse; only the prayer kind is host-restricted server-side),
// 'overlay:clear' removes the shared card.
const TRANSLATIONS = ['kjv', 'web', 'bbe', 'darby'];

export default function ScripturePanel({ overlay, onShowVerse, onClearOverlay }) {
  const [ref, setRef] = useState('');
  const [tr, setTr] = useState('kjv');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customText, setCustomText] = useState('');

  const lookup = async () => {
    const r = ref.trim();
    if (!r) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const url = `https://bible-api.com/${encodeURIComponent(r).replace(/%20/g, '+').replace(/%3A/gi, ':')}?translation=${tr}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok || d.error || !d.verses?.length) throw new Error();
      const multi = d.verses.length > 1;
      const text = d.verses
        .map((v) => (multi ? v.verse + ' ' : '') + v.text.replace(/\s+/g, ' ').trim())
        .join(' ')
        .slice(0, 2500);
      setPreview({ title: `${d.reference} (${tr.toUpperCase()})`, text });
    } catch {
      setError(`Couldn’t find “${r}”. Check the book, chapter and verse (e.g. Romans 8:28), or type the passage yourself below.`);
    } finally {
      setLoading(false);
    }
  };

  const showCustom = () => {
    const t = customText.trim();
    if (!t) return;
    onShowVerse({ kind: 'verse', title: customTitle.trim() || 'Scripture', text: t });
    setCustomTitle('');
    setCustomText('');
  };

  return (
    <ScrollView style={styles.root}>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={ref}
          onChangeText={setRef}
          placeholder="e.g. Romans 8:28"
          placeholderTextColor="#777"
          autoCapitalize="none"
        />
        <View style={styles.trRow}>
          {TRANSLATIONS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tr, tr === t && styles.trActive]}
              onPress={() => setTr(t)}>
              <Text style={[styles.trText, tr === t && styles.trTextActive]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={styles.lookup} onPress={lookup}>
        <Text style={styles.lookupText}>{loading ? 'Looking up…' : 'Look up'}</Text>
      </TouchableOpacity>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!preview && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{preview.title}</Text>
          <Text style={styles.cardText}>{preview.text}</Text>
          <TouchableOpacity
            style={styles.show}
            onPress={() => onShowVerse({ kind: 'verse', ...preview })}>
            <Text style={styles.showText}>Show to everyone</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Or type a passage yourself</Text>
      <TextInput
        style={styles.input}
        value={customTitle}
        onChangeText={setCustomTitle}
        placeholder="Title (optional)"
        placeholderTextColor="#777"
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={customText}
        onChangeText={setCustomText}
        placeholder="Paste the passage text"
        placeholderTextColor="#777"
        multiline
      />
      <TouchableOpacity style={styles.lookup} onPress={showCustom}>
        <Text style={styles.lookupText}>Show to everyone</Text>
      </TouchableOpacity>

      {!!overlay && (
        <View style={styles.onScreen}>
          <Text style={styles.onScreenLabel}>On everyone’s screen now</Text>
          <Text style={styles.onScreenTitle}>{overlay.title}</Text>
          <TouchableOpacity style={styles.clear} onPress={onClearOverlay}>
            <Text style={styles.clearText}>Remove from screen</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: '#1e1930',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  flex: { flex: 1, marginRight: 8, marginBottom: 0 },
  trRow: { flexDirection: 'row' },
  tr: { backgroundColor: '#2a2440', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, marginLeft: 4 },
  trActive: { backgroundColor: '#e8b14f' },
  trText: { color: '#ccc', fontSize: 11, fontWeight: '700' },
  trTextActive: { color: '#14111d' },
  lookup: { backgroundColor: '#e8b14f', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  lookupText: { color: '#14111d', fontWeight: '700' },
  error: { color: '#e88', fontSize: 13, marginTop: 10, lineHeight: 19 },
  card: { backgroundColor: '#1e1930', borderRadius: 10, padding: 12, marginTop: 12 },
  cardTitle: { color: '#e8b14f', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardText: { color: '#eee', fontSize: 15, lineHeight: 21 },
  show: { backgroundColor: '#2a2440', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  showText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { color: '#e8b14f', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  textArea: { minHeight: 90 },
  onScreen: { backgroundColor: '#1e1930', borderRadius: 10, padding: 12, marginTop: 16 },
  onScreenLabel: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  onScreenTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clear: { backgroundColor: '#2a2440', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  clearText: { color: '#fff', fontWeight: '600' },
});

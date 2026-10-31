import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Reaction picker + hand-raise, mirroring the web app's react popover.
// Server protocol (server.js): emit 'reaction' emoji (validated against
// ['🙏', '🙌', '❤️', '👏', '🔥', '🕊️']) and the server broadcasts
// 'reaction' { from, emoji } to the room. Emit 'hand' bool; the raised
// state arrives back through state.participants[].hand.
export const REACTIONS = ['🙏', '🙌', '❤️', '👏', '🔥', '🕊️'];

export default function ReactionBar({ onReact, handRaised, onHand }) {
  return (
    <View style={styles.root}>
      {REACTIONS.map((e) => (
        <TouchableOpacity key={e} style={styles.btn} onPress={() => onReact(e)}>
          <Text style={styles.emoji}>{e}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={[styles.hand, handRaised && styles.handRaised]} onPress={onHand}>
        <Text style={styles.handText}>{handRaised ? '✋ Lower hand' : '✋ Raise hand'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, alignItems: 'center' },
  btn: { backgroundColor: '#2a2440', borderRadius: 20, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8 },
  emoji: { fontSize: 22 },
  hand: { backgroundColor: '#2a2440', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8 },
  handRaised: { backgroundColor: '#e8b14f' },
  handText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

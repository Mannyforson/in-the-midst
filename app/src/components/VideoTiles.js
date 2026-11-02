import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RTCView } from '../webrtc-stub';

// Video tile grid, mirroring the web app's stage layout.
// - Self tile first (mirrored preview), then one tile per other participant.
// - A tile shows the live stream when one exists with a video track;
//   otherwise a placeholder (video off, or still connecting when cam is on).
// - Mic/cam/hand indicators and the host spotlight border mirror the web
//   participant meta (mic, cam, hand, spotlight).
export default function VideoTiles({ selfStream, remoteStreams, participants, selfId, spotlight }) {
  const self = participants.find((p) => p.id === selfId);
  const tiles = [];
  if (self) {
    tiles.push({ id: selfId, name: self.name, stream: selfStream, person: self, isSelf: true });
  }
  for (const p of participants) {
    if (p.id === selfId) continue;
    tiles.push({ id: p.id, name: p.name, stream: remoteStreams[p.id] || null, person: p, isSelf: false });
  }

  return (
    <View style={styles.grid}>
      {tiles.map((t) => {
        const videoTracks = t.stream ? t.stream.getVideoTracks() : [];
        const liveVideo = videoTracks.length > 0 && videoTracks[0].enabled;
        const isSpotlight = spotlight && spotlight === t.id;
        return (
          <View key={t.id} style={[styles.tile, isSpotlight && styles.spotlight]}>
            {liveVideo ? (
              <RTCView
                streamURL={t.stream.toURL()}
                style={styles.video}
                mirror={t.isSelf}
                objectFit="cover"
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>
                  {t.person && t.person.cam ? 'Connecting…' : 'Video off'}
                </Text>
              </View>
            )}
            <View style={styles.caption}>
              <Text style={styles.name} numberOfLines={1}>
                {t.name}
                {t.isSelf ? ' (You)' : ''}
                {t.person && t.person.host ? ' · Host' : ''}
              </Text>
              <Text style={styles.meta}>
                {t.person && !t.person.mic ? '🔇 ' : ''}
                {t.person && t.person.hand ? '✋ ' : ''}
                {isSpotlight ? '⭐ Spotlight' : ''}
              </Text>
            </View>
          </View>
        );
      })}
      {tiles.length === 0 && (
        <Text style={styles.empty}>No one else is here yet. Share the code to invite others.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  tile: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e1930',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  spotlight: { borderColor: '#e8b14f' },
  video: { width: '100%', height: 160, backgroundColor: '#000' },
  placeholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#1e1930',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: '#888', fontSize: 13 },
  caption: { paddingHorizontal: 8, paddingVertical: 6 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600' },
  meta: { color: '#aaa', fontSize: 11, marginTop: 2 },
  empty: { color: '#888', fontSize: 13, marginTop: 8 },
});

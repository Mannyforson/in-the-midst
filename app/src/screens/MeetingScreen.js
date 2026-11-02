import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SignalingClient, fetchIce } from '../signaling';
import { PeerManager, acquireMedia } from '../rtc';
import { MediaStream, mediaDevices } from '../webrtc-stub';
import { SERVER_URL, formatCode } from '../constants';
import storage from '../storage';
import VideoTiles from '../components/VideoTiles';
import ChatPanel from '../components/ChatPanel';
import PrayerPanel from '../components/PrayerPanel';
import ScripturePanel from '../components/ScripturePanel';
import WorshipPanel from '../components/WorshipPanel';
import PeoplePanel from '../components/PeoplePanel';
import OverlayBanner from '../components/OverlayBanner';
import ReactionBar from '../components/ReactionBar';

// Meeting screen wired to the REAL signaling protocol (see src/signaling.js).
// Flow mirrors the web app's connectSocket / emitJoin / onJoined:
//  - fetch ICE, connect socket, emit join (hostKey ONLY when asHost — the
//    fixed behavior: guests never present a stored host key).
//  - onJoined: error -> back home; waiting -> waiting notice;
//    ok -> live state, call every existing peer, emit media state.
//  - reconnect: close all peers and re-join (same as web).
//  - server events handled: state, notice, chat, reaction, signal,
//    peer-left, force-mute, ask-unmute, force-video-off, removed, ended,
//    admitted, denied.
//  - panels: video tiles (RTCView), chat, prayer wall, scripture,
//    worship, people + host controls, reactions, hand-raise, recording.
export default function MeetingScreen({ route, navigation }) {
  const { roomId, name, asHost } = route.params;
  const [room, setRoom] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [waitingTitle, setWaitingTitle] = useState('');
  const [error, setError] = useState('');
  const [notices, setNotices] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerStatus, setPeerStatus] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [panel, setPanel] = useState('video');
  const [recentReactions, setRecentReactions] = useState([]);
  const [showReactions, setShowReactions] = useState(false);
  const [recordingOn, setRecordingOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);

  const clientRef = useRef(null);
  const peersRef = useRef(null);
  const inMeetingRef = useRef(false);
  const waitingRef = useRef(false);
  const tracksRef = useRef({ audioTrack: null, videoTrack: null });
  const screenTrackRef = useRef(null);

  const pushNotice = (text) => setNotices((prev) => [text, ...prev].slice(0, 5));

  const emitMedia = () => {
    const t = tracksRef.current;
    clientRef.current &&
      clientRef.current.emit('media', {
        mic: micOn && !!t.audioTrack,
        cam: camOn && !!t.videoTrack,
        // Same event/field as web: peers see p.sharing in state.
        sharing: !!screenTrackRef.current,
      });
  };

  // Self-view stream for the RTCView tile: the screen track while
  // sharing (mirrors web, where the self tile shows the shared screen),
  // otherwise the camera track.
  const updateLocalStream = () => {
    const vt = screenTrackRef.current || tracksRef.current.videoTrack;
    if (!vt) {
      setLocalStream(null);
      return;
    }
    try {
      const s = new MediaStream();
      s.addTrack(vt);
      setLocalStream(s);
    } catch {
      setLocalStream(null);
    }
  };

  const emitJoin = () => {
    // Host key is presented ONLY for host-initiated joins (asHost), exactly
    // like the fixed web app. Guests always send null.
    storage.get(`ur:host:${roomId}`, null).then((storedKey) => {
      clientRef.current.emit(
        'join',
        {
          roomId,
          name,
          hostKey: asHost ? storedKey : null,
          mic: micOn && !!tracksRef.current.audioTrack,
          cam: camOn && !!tracksRef.current.videoTrack,
        },
        onJoined,
      );
    });
  };

  const onJoined = (res) => {
    if (!res || res.error) {
      const msg = (res && res.error) || 'Could not join. Try again.';
      if (inMeetingRef.current) {
        leaveMeeting('Could not reconnect', msg);
        return;
      }
      setError(msg);
      return;
    }
    if (res.waiting) {
      waitingRef.current = true;
      setWaiting(true);
      setWaitingTitle(res.title || '');
      return;
    }
    waitingRef.current = false;
    setWaiting(false);
    setSelfId(res.self);
    setRoom(res.state);
    setChatMessages(res.chat || []);
    inMeetingRef.current = true;
    res.peers.forEach((id) => peersRef.current.callPeer(id));
    emitMedia();
  };

  const leaveMeeting = (title, message) => {
    try {
      clientRef.current && clientRef.current.emit('leave');
    } catch {
      // already gone
    }
    peersRef.current && peersRef.current.closeAllPeers();
    clientRef.current && clientRef.current.close();
    tracksRef.current.audioTrack && tracksRef.current.audioTrack.stop();
    tracksRef.current.videoTrack && tracksRef.current.videoTrack.stop();
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
      } catch {
        // already stopped
      }
      screenTrackRef.current = null;
    }
    inMeetingRef.current = false;
    if (title) Alert.alert(title, message || '');
    navigation.goBack();
  };

  const endForEveryone = () => {
    clientRef.current &&
      clientRef.current.emit('host:action', { action: 'end' });
    leaveMeeting();
  };

  const hostAction = (action, target, value) => {
    clientRef.current &&
      clientRef.current.emit('host:action', { action, target, value });
  };

  const toggleHand = () => {
    const s = room && room.participants.find((p) => p.id === selfId);
    clientRef.current && clientRef.current.emit('hand', !(s && s.hand));
  };

  const toggleRecording = () => {
    const on = !recordingOn;
    setRecordingOn(on);
    clientRef.current && clientRef.current.emit('recording', on);
  };

  const sendChat = (text, to) => {
    clientRef.current && clientRef.current.emit('chat', { text, to: to || null });
  };

  // Invite sharing: system share sheet with the join link + 9-digit code.
  // If the share sheet itself is unavailable, fall back to an on-screen
  // invite box (link + code visible to read or type) instead of failing
  // silently. No clipboard dependency is installed, so there is no
  // programmatic copy here — the code is shown, not silently copied.
  const inviteLink = `${SERVER_URL}/?room=${roomId}`;
  const inviteMessage =
    `Join "${room && room.title ? room.title : 'a gathering'}" on In the Midst: ${inviteLink}\n` +
    `Code: ${formatCode(roomId)}`;

  const shareInvite = async () => {
    try {
      await Share.share({ message: inviteMessage, title: 'Join on In the Midst' });
    } catch {
      setInviteVisible(true);
      Alert.alert('Sharing is not available on this device', inviteMessage);
    }
  };

  // Screen sharing, mirroring web toggleShare/stopShare (public/app.js):
  // one sharer at a time, screen track replaces the camera as outgoing
  // video via PeerManager.setScreenTrack, 'media' re-emitted with
  // sharing true/false, and the track's onended stops the share.
  // Android only: react-native-webrtc getDisplayMedia is backed by the
  // system MediaProjection dialog on Android. iOS has no equivalent in
  // this JS-only project (it needs a native Broadcast Upload Extension),
  // so on iPhone this honestly says so instead of faking a control.
  const stopShare = () => {
    const t = screenTrackRef.current;
    if (!t) return;
    try {
      t.onended = null;
    } catch {
      // already detached
    }
    try {
      t.stop();
    } catch {
      // already stopped
    }
    screenTrackRef.current = null;
    peersRef.current && peersRef.current.setScreenTrack(null);
    setSharing(false);
    updateLocalStream();
    emitMedia();
  };

  const toggleShare = async () => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Screen sharing is not available on iPhone yet',
        'Screen sharing on iPhone needs a native broadcast extension that is not in this build yet. Android screen sharing works today.',
      );
      return;
    }
    if (screenTrackRef.current) {
      stopShare();
      return;
    }
    const other =
      room && room.participants.find((p) => p.sharing && p.id !== selfId);
    if (other) {
      Alert.alert(
        'Someone is already sharing',
        `${other.name} is sharing their screen. Ask them to stop first.`,
      );
      return;
    }
    try {
      const ds = await mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      const track = ds.getVideoTracks()[0];
      if (!track) return;
      track.onended = () => stopShare();
      screenTrackRef.current = track;
      peersRef.current && peersRef.current.setScreenTrack(track);
      setSharing(true);
      updateLocalStream();
      emitMedia();
    } catch {
      Alert.alert(
        'Could not start screen sharing',
        'Screen sharing was cancelled or is not available on this device.',
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ice = await fetchIce();
      if (cancelled) return;
      // Media first (best effort: no camera/mic still joins, like web).
      try {
        const { audioTrack, videoTrack } = await acquireMedia({ audio: true, video: true });
        tracksRef.current = { audioTrack, videoTrack };
        updateLocalStream();
        if (!audioTrack) setMicOn(false);
        if (!videoTrack) setCamOn(false);
      } catch {
        // joining without media is fine; toggles re-acquire later
      }
      const client = new SignalingClient();
      clientRef.current = client;
      const peers = new PeerManager({
        socket: client,
        iceServers: ice,
        onRemoteStream: (id, stream) =>
          setRemoteStreams((prev) => ({ ...prev, [id]: stream })),
        onStatus: (id, state) => setPeerStatus((prev) => ({ ...prev, [id]: state })),
      });
      peers.setLocalTracks(tracksRef.current);
      peersRef.current = peers;

      client.on('state', (st) => {
        if (inMeetingRef.current) setRoom(st);
      });
      client.on('signal', (m) => peers.onSignal(m));
      client.on('peer-left', (id) => {
        peers.closePeer(id);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setPeerStatus((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      });
      client.on('notice', (n) => {
        if (inMeetingRef.current) pushNotice(n.text);
      });
      client.on('chat', (msg) => {
        if (inMeetingRef.current) setChatMessages((prev) => [...prev, msg].slice(-300));
      });
      client.on('reaction', ({ from, emoji }) => {
        if (!inMeetingRef.current) return;
        const rid = `${Date.now()}-${Math.random()}`;
        setRecentReactions((prev) => [...prev, { id: rid, from, emoji }].slice(-6));
        setTimeout(
          () => setRecentReactions((prev) => prev.filter((r) => r.id !== rid)),
          3100,
        );
      });
      client.on('force-mute', () => {
        setMicOn(false);
        if (tracksRef.current.audioTrack) tracksRef.current.audioTrack.enabled = false;
        pushNotice('The host muted your microphone.');
      });
      client.on('ask-unmute', ({ by }) => {
        Alert.alert('Unmute?', `${by} is asking you to unmute.`, [
          { text: 'Stay muted', style: 'cancel' },
          {
            text: 'Unmute',
            onPress: () => {
              setMicOn(true);
              if (tracksRef.current.audioTrack) tracksRef.current.audioTrack.enabled = true;
              emitMedia();
            },
          },
        ]);
      });
      client.on('force-video-off', () => {
        setCamOn(false);
        if (tracksRef.current.videoTrack) {
          tracksRef.current.videoTrack.stop();
          tracksRef.current.videoTrack = null;
        }
        peers.replaceVideo();
        pushNotice('The host turned off your video.');
      });
      client.on('removed', () => leaveMeeting('You were removed', 'The host removed you from this gathering.'));
      client.on('ended', () => {
        if (inMeetingRef.current || waitingRef.current) {
          leaveMeeting('The gathering has ended', 'The host ended this gathering for everyone. Thank you for joining.');
        }
      });
      client.on('admitted', () => {
        if (waitingRef.current) emitJoin();
      });
      client.on('denied', () => {
        waitingRef.current = false;
        setWaiting(false);
        setError('You were not let in. The host did not admit you to this gathering.');
      });
      client.on('disconnect', () => {
        if (inMeetingRef.current) pushNotice('Connection lost. Reconnecting…');
      });
      client.on('connect', () => {
        if (inMeetingRef.current || waitingRef.current) {
          peers.closeAllPeers();
          emitJoin();
        }
      });

      client.connect();
      if (client.connected) emitJoin();
      else client.once('connect', () => {
        if (!inMeetingRef.current && !waitingRef.current) emitJoin();
      });
    })();
    return () => {
      cancelled = true;
      peersRef.current && peersRef.current.closeAllPeers();
      clientRef.current && clientRef.current.close();
    };
  }, []);

  const toggleMic = async () => {
    const on = !micOn;
    if (on && (!tracksRef.current.audioTrack || tracksRef.current.audioTrack.readyState === 'ended')) {
      try {
        const { audioTrack } = await acquireMedia({ audio: true, video: false });
        if (!audioTrack) return;
        tracksRef.current.audioTrack = audioTrack;
        peersRef.current.setLocalTracks(tracksRef.current);
      } catch {
        return;
      }
    }
    setMicOn(on);
    if (tracksRef.current.audioTrack) tracksRef.current.audioTrack.enabled = on;
    peersRef.current.replaceAudio();
    emitMedia();
  };

  const toggleCam = async () => {
    const on = !camOn;
    if (on && (!tracksRef.current.videoTrack || tracksRef.current.videoTrack.readyState === 'ended')) {
      try {
        const { videoTrack } = await acquireMedia({ audio: false, video: true });
        if (!videoTrack) return;
        tracksRef.current.videoTrack = videoTrack;
        peersRef.current.setLocalTracks(tracksRef.current);
      } catch {
        return;
      }
    }
    if (!on && tracksRef.current.videoTrack) {
      tracksRef.current.videoTrack.stop();
      tracksRef.current.videoTrack = null;
      peersRef.current.setLocalTracks(tracksRef.current);
    }
    setCamOn(on);
    peersRef.current.replaceVideo();
    updateLocalStream();
    emitMedia();
  };

  const self = room && room.participants.find((p) => p.id === selfId);
  const isHost = !!self && !!self.host;

  if (waiting) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Waiting for the host</Text>
        <Text style={styles.sub}>
          You are in the waiting room{waitingTitle ? ` for “${waitingTitle}”` : ''}. The host will let you in shortly.
        </Text>
        <TouchableOpacity style={styles.leave} onPress={() => leaveMeeting()}>
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && !room) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Could not join</Text>
        <Text style={styles.sub}>{error}</Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryText}>Back to start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{room ? room.title : 'Joining…'}</Text>
      {!!room && (
        <Text style={styles.sub}>
          {room.typeLabel} · {room.participants.length} here
          {room.waiting.length ? ` · ${room.waiting.length} waiting` : ''}
        </Text>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.control, !micOn && styles.controlOff]} onPress={toggleMic}>
          <Text style={styles.controlText}>{micOn ? 'Mute' : 'Unmute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.control, !camOn && styles.controlOff]} onPress={toggleCam}>
          <Text style={styles.controlText}>{camOn ? 'Camera off' : 'Camera on'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, self && self.hand && styles.controlActive]}
          onPress={toggleHand}>
          <Text style={[styles.controlText, self && self.hand && styles.controlTextActive]}>
            {self && self.hand ? 'Lower hand' : 'Raise hand'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, showReactions && styles.controlActive]}
          onPress={() => setShowReactions(!showReactions)}>
          <Text style={[styles.controlText, showReactions && styles.controlTextActive]}>React</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, recordingOn && styles.controlActive]}
          onPress={toggleRecording}>
          <Text style={[styles.controlText, recordingOn && styles.controlTextActive]}>
            {recordingOn ? 'Stop rec' : 'Record'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.control} onPress={shareInvite}>
          <Text style={styles.controlText}>Invite</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, sharing && styles.controlActive]}
          onPress={toggleShare}>
          <Text style={[styles.controlText, sharing && styles.controlTextActive]}>
            {sharing ? 'Stop share' : 'Share screen'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.leave} onPress={() => leaveMeeting()}>
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
        {isHost && (
          <TouchableOpacity style={styles.end} onPress={endForEveryone}>
            <Text style={styles.leaveText}>End for everyone</Text>
          </TouchableOpacity>
        )}
      </View>

      {Platform.OS === 'ios' && (
        <Text style={styles.hint}>
          Screen sharing is not available on iPhone yet — it needs a native
          broadcast extension that is not in this build.
        </Text>
      )}

      {inviteVisible && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite someone</Text>
          <Text style={styles.notice}>Link: {inviteLink}</Text>
          <Text style={styles.notice}>Code: {formatCode(roomId)}</Text>
          <TouchableOpacity style={styles.control} onPress={() => setInviteVisible(false)}>
            <Text style={styles.controlText}>Hide</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabs}>
        {[
          ['video', 'Video'],
          ['chat', 'Chat'],
          ['prayer', 'Prayer'],
          ['scripture', 'Scripture'],
          ['worship', 'Worship'],
          ['people', 'People'],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, panel === key && styles.tabActive]}
            onPress={() => setPanel(key)}>
            <Text style={[styles.tabText, panel === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!room && room.overlay && (
        <OverlayBanner
          overlay={room.overlay}
          onClear={() => clientRef.current && clientRef.current.emit('overlay:clear')}
        />
      )}

      {!!room && panel === 'video' && (
        <VideoTiles
          selfStream={localStream}
          remoteStreams={remoteStreams}
          participants={room.participants}
          selfId={selfId}
          spotlight={room.spotlight}
        />
      )}

      {recentReactions.length > 0 && (
        <View style={styles.reactions}>
          {recentReactions.map((r) => (
            <Text key={r.id} style={styles.reactionChip}>
              {r.emoji}{' '}
              {(room && room.participants.find((p) => p.id === r.from)?.name) ||
                (r.from === selfId ? 'You' : '')}
            </Text>
          ))}
        </View>
      )}

      {showReactions && (
        <ReactionBar
          onReact={(e) => {
            clientRef.current && clientRef.current.emit('reaction', e);
            setShowReactions(false);
          }}
          handRaised={!!(self && self.hand)}
          onHand={toggleHand}
        />
      )}

      {!!room && panel === 'chat' && (
        <ChatPanel
          messages={chatMessages}
          selfId={selfId}
          participants={room.participants}
          onSend={sendChat}
        />
      )}

      {!!room && panel === 'prayer' && (
        <PrayerPanel
          prayers={room.prayers}
          selfId={selfId}
          isHost={isHost}
          onAdd={(text, anonymous) =>
            clientRef.current && clientRef.current.emit('prayer:add', { text, anonymous })
          }
          onPray={(id) => clientRef.current && clientRef.current.emit('prayer:pray', id)}
          onAnswered={(id) => clientRef.current && clientRef.current.emit('prayer:answered', id)}
          onRemove={(id) => clientRef.current && clientRef.current.emit('prayer:remove', id)}
          onShow={(p) =>
            clientRef.current &&
            clientRef.current.emit('overlay:show', {
              kind: 'prayer',
              title: p.by ? `For ${p.by}'s request` : 'A request from our church',
              text: p.text,
            })
          }
        />
      )}

      {!!room && panel === 'scripture' && (
        <ScripturePanel
          overlay={room.overlay}
          onShowVerse={(o) => clientRef.current && clientRef.current.emit('overlay:show', o)}
          onClearOverlay={() => clientRef.current && clientRef.current.emit('overlay:clear')}
        />
      )}

      {!!room && panel === 'worship' && (
        <WorshipPanel
          worship={room.worship}
          isHost={isHost}
          onSet={(title, lyrics) =>
            clientRef.current && clientRef.current.emit('worship:set', { title, lyrics })
          }
          onGo={(i) => clientRef.current && clientRef.current.emit('worship:go', i)}
          onStop={() => clientRef.current && clientRef.current.emit('worship:stop')}
          onPresent={() =>
            clientRef.current && clientRef.current.emit('worship:go', room.worship.index)
          }
        />
      )}

      {!!room && panel === 'people' && (
        <PeoplePanel room={room} selfId={selfId} isHost={isHost} onHostAction={hostAction} />
      )}

      {notices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notices</Text>
          {notices.map((n, i) => (
            <Text key={i} style={styles.notice}>
              {n}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14111d' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 12 },
  sub: { color: '#aaa', fontSize: 14, marginTop: 6 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  control: { backgroundColor: '#2a2440', borderRadius: 10, padding: 12, marginRight: 8, marginBottom: 8 },
  controlOff: { backgroundColor: '#4a2430' },
  controlActive: { backgroundColor: '#e8b14f' },
  controlText: { color: '#fff', fontWeight: '600' },
  controlTextActive: { color: '#14111d' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  tab: { backgroundColor: '#2a2440', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  tabActive: { backgroundColor: '#e8b14f' },
  tabText: { color: '#ccc', fontSize: 13 },
  tabTextActive: { color: '#14111d', fontWeight: '700' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  reactionChip: { color: '#fff', fontSize: 15, backgroundColor: '#2a2440', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, overflow: 'hidden' },
  leave: { backgroundColor: '#7a2020', borderRadius: 10, padding: 12, marginRight: 8, marginBottom: 8 },
  leaveText: { color: '#fff', fontWeight: '700' },
  end: { backgroundColor: '#7a2020', borderRadius: 10, padding: 12, marginBottom: 8 },
  primary: { backgroundColor: '#e8b14f', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  primaryText: { color: '#14111d', fontSize: 16, fontWeight: '700' },
  section: { marginTop: 24 },
  sectionTitle: { color: '#e8b14f', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  person: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#262039' },
  personName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  personMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  notice: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  hint: { color: '#666', fontSize: 12, marginTop: 32, lineHeight: 18 },
});

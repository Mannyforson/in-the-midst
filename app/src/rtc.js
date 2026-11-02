// WebRTC mesh manager mirroring the web app's createPeer / callPeer /
// onSignal (public/app.js), adapted to react-native-webrtc:
// - The JOINER calls every existing peer (createOffer over sendrecv
//   audio+video transceivers, kind-string transceivers when no local track).
// - The ANSWERER sets the remote offer, forces every transceiver to
//   sendrecv, replaces sender tracks with local tracks, then answers.
// - ICE candidates are queued until the remote description is set.
// - On 'failed', the initiator restarts ICE (same as web).
// - Remote tracks arrive via ontrack into one MediaStream per peer; the
//   caller renders it with <RTCView> (video tiles are the next build step).
// - Local tracks come from mediaDevices.getUserMedia (audio/video).
//   Toggle paths replace sender tracks, mirroring web replaceAudio/replaceVideo.
const {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} = require('./webrtc-stub');

const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

class PeerManager {
  constructor({ socket, iceServers, onRemoteStream, onStatus }) {
    this.socket = socket;
    this.iceServers = iceServers && iceServers.length ? iceServers : DEFAULT_ICE;
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onStatus = onStatus || (() => {});
    this.peers = new Map(); // id -> { id, pc, stream, pending, initiator }
    this.audioTrack = null;
    this.videoTrack = null;
    // Screen-share track, when sharing. Mirrors web outVideo():
    // screenTrack wins over the camera track while it is live.
    this.screenTrack = null;
  }

  setLocalTracks({ audioTrack, videoTrack }) {
    this.audioTrack = audioTrack || null;
    this.videoTrack = videoTrack || null;
  }

  // Screen sharing (Android via mediaDevices.getDisplayMedia; iOS has no
  // equivalent in this JS-only project and never reaches here). Sets the
  // outgoing video to the screen track (or back to the camera on null)
  // and pushes it to every peer, mirroring web replaceVideo().
  setScreenTrack(track) {
    this.screenTrack = track || null;
    this.replaceVideo();
  }

  outVideo() {
    return this.screenTrack || this.videoTrack || null;
  }

  // Mirrors web tx(peer, kind): find the transceiver whose receiver track
  // matches kind. Guarded: RN receiver.track may be null before arrival.
  _tx(peer, kind) {
    return peer.pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === kind);
  }

  replaceAudio() {
    for (const p of this.peers.values()) {
      const t = this._tx(p, 'audio');
      if (t && t.sender) t.sender.replaceTrack(this.audioTrack).catch(() => {});
    }
  }

  replaceVideo() {
    const v = this.outVideo();
    for (const p of this.peers.values()) {
      const t = this._tx(p, 'video');
      if (t && t.sender) t.sender.replaceTrack(v).catch(() => {});
    }
  }

  createPeer(id) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = { id, pc, stream: null, pending: [], initiator: false };
    // react-native-webrtc MediaStream: create via the module's MediaStream.
    // Kept lazy (created on first track) to avoid importing it at module top
    // in environments where the native module is absent.
      const { MediaStream } = require('./webrtc-stub');
    peer.stream = new MediaStream();
    this.peers.set(id, peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.socket.emit('signal', { to: id, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      const stream = peer.stream;
      const incoming = e.streams && e.streams[0];
      const tracks = incoming ? incoming.getTracks() : e.track ? [e.track] : [];
      for (const t of tracks) {
        const existing = stream.getTracks().find((x) => x.kind === t.kind && x !== t);
        if (existing) stream.removeTrack(existing);
        if (!stream.getTracks().includes(t)) stream.addTrack(t);
      }
      this.onRemoteStream(id, stream);
    };
    pc.onconnectionstatechange = async () => {
      this.onStatus(id, pc.connectionState);
      if (pc.connectionState === 'failed' && peer.initiator) {
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          this.socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
        } catch {
          // will retry on next state change, same as web
        }
      }
    };
    return peer;
  }

  async callPeer(id) {
    const peer = this.createPeer(id);
    peer.initiator = true;
    const pc = peer.pc;
    pc.addTransceiver(this.audioTrack || 'audio', { direction: 'sendrecv' });
    pc.addTransceiver(this.outVideo() || 'video', { direction: 'sendrecv' });
    try {
      await pc.setLocalDescription(await pc.createOffer());
      this.socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
    } catch (e) {
      console.warn('offer failed', e);
    }
  }

  async onSignal({ from, data }) {
    let peer = this.peers.get(from);
    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          if (!peer) peer = createPeerSafe(this, from);
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          for (const t of peer.pc.getTransceivers()) {
            // After setRemoteDescription(offer), receiver.track is set, same
            // as web. Skip any transceiver whose kind is not yet known.
            const kind = t.receiver && t.receiver.track ? t.receiver.track.kind : null;
            if (!kind) continue;
            t.direction = 'sendrecv';
            const track = kind === 'audio' ? this.audioTrack : this.outVideo();
            if (t.sender) await t.sender.replaceTrack(track).catch(() => {});
          }
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          this.socket.emit('signal', { to: from, data: { sdp: peer.pc.localDescription } });
        } else if (peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
        if (peer) {
          const pending = peer.pending.splice(0);
          for (const c of pending) {
            await peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        }
      } else if (data.candidate) {
        if (!peer) peer = createPeerSafe(this, from);
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          peer.pending.push(data.candidate);
        }
      }
    } catch (e) {
      console.warn('signal error', e);
    }
  }

  closePeer(id) {
    const p = this.peers.get(id);
    if (p) {
      try {
        p.pc.close();
      } catch {
        // already closed
      }
      this.peers.delete(id);
    }
  }

  closeAllPeers() {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }
}

function createPeerSafe(manager, id) {
  return manager.createPeer(id);
}

async function acquireMedia({ audio, video }) {
  if (!audio && !video) return { audioTrack: null, videoTrack: null };
  const stream = await mediaDevices.getUserMedia({
    audio: audio
      ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : false,
    video: video
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }
      : false,
  });
  return {
    audioTrack: stream.getAudioTracks()[0] || null,
    videoTrack: stream.getVideoTracks()[0] || null,
  };
}

module.exports = { PeerManager, acquireMedia };

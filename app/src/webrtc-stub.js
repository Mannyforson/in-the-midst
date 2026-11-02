// Diagnostic stub for react-native-webrtc (build 6).
// Pure JavaScript only: it imports nothing native, so the linked native
// WebRTC module is never loaded. Every placeholder throws if it is
// actually used. The diagnostic launch test only reaches the Home
// screen and never opens the Meeting screen, so these stubs never run.

function throwStub(name) {
  throw new Error(
    'WebRTC is disabled in this diagnostic build: ' + name + ' is unavailable.',
  );
}

class RTCPeerConnection {
  constructor() {
    throwStub('RTCPeerConnection');
  }
}

class RTCSessionDescription {
  constructor() {
    throwStub('RTCSessionDescription');
  }
}

class RTCIceCandidate {
  constructor() {
    throwStub('RTCIceCandidate');
  }
}

class MediaStream {
  constructor() {
    throwStub('MediaStream');
  }
}

const mediaDevices = {
  getUserMedia() {
    throwStub('mediaDevices.getUserMedia');
  },
  getDisplayMedia() {
    throwStub('mediaDevices.getDisplayMedia');
  },
  enumerateDevices() {
    throwStub('mediaDevices.enumerateDevices');
  },
};

function RTCView() {
  throwStub('RTCView');
}

export {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
  RTCView,
};

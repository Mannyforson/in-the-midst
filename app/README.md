# In the Midst — React Native (Expo) app

A real native app, built like Pheels (React Native + Expo) — **not** a website
wrapper. The screens are React Native components; the Node server at
`https://in-the-midst.onrender.com` is only the backend: room state, the
prayer wall, and WebRTC signaling. Video and audio travel peer-to-peer over
WebRTC, exactly like the web app.

## Protocol mirror (web app -> this app)

The signaling client (`src/signaling.js`) mirrors the web client
(`public/app.js`) and the server (`server.js`) exactly:

- Raw WebSocket (NOT socket.io) at `wss://in-the-midst.onrender.com/ws`.
- Every message is JSON `{ e, d }`; emitting with a callback adds an ack id
  `a`, and the server answers `{ e: '__ack', a, d }`.
- Auto-reconnect with the web backoff: `min(8000, 400 * 2^retry)` ms.
- `join` payload: `{ roomId, name, hostKey, mic, cam }`. The host key is
  sent ONLY for host-initiated joins (`asHost`); guests always send `null`
  — the fixed web behavior, so a guest can never silently become host.
- Join reply: `{ error }` | `{ waiting: true, title }` |
  `{ ok, self, peers, state, chat }`. On `admitted`, the client re-joins.
- Server events handled: `state`, `signal`, `peer-left`, `notice`,
  `force-mute`, `ask-unmute`, `force-video-off`, `removed`, `ended`,
  `admitted`, `denied`.
- Client emits: `signal { to, data }`, `media { mic, cam, sharing }`,
  `host:action { action, target, value }`, `leave`.
- REST: `POST /api/rooms { title, type, waitingRoom }` ->
  `{ id, hostKey, title, type }`; `GET /api/rooms/:id` ->
  `{ id, title, type, typeLabel, count }`; `GET /api/ice` -> ICE servers
  (Google STUN, plus TURN when the server sets `TURN_URL`).
- Room codes are 9 digits, formatted `XXX-XXX-XXX`. Types: `prayer`,
  `bible`, `worship`, `fellowship`.
- WebRTC mesh (`src/rtc.js`): the joiner calls every existing peer with
  sendrecv audio+video transceivers (kind-string when no local track); the
  answerer sets the remote offer, forces transceivers to sendrecv, replaces
  sender tracks, and answers. ICE candidates queue until the remote
  description is set. On `failed`, the initiator restarts ICE.

## Build route — EAS Build, dev builds required

**Expo Go will NOT work**: `react-native-webrtc` needs native code, so this
app runs only in dev builds (and store builds), never in Expo Go.

The EAS project already exists: "In the Midst" (slug `in-the-midst`,
account `mannyforson`), project id `e39e640e-1716-4dad-881f-cb5f013d1643`,
wired into `eas.json` and `app.json` (`expo.extra.eas.projectId`). No
`eas init` is needed anymore. The `EXPO_TOKEN` GitHub repository secret is
already stored, so the cloud build needs no credential from anyone at
build time.

### First cloud build (the normal route)

```sh
# One-time repo layout: the project lives under app/ in the repo, and the
# workflow file goes to .github/workflows/eas-build.yml.
cp eas-build.yml .github/workflows/eas-build.yml   # from the project root
git add app .github/workflows/eas-build.yml && git commit && git push
```

Then, in GitHub: Actions → EAS Build → Run workflow → pick platform
(`all`, `android`, or `ios`) and profile (`development` for the first
build) → Run. The workflow installs dependencies, installs the EAS CLI,
and runs `eas build --platform <platform> --profile <profile>
--non-interactive` from `app/`, authenticated with `EXPO_TOKEN`. The
build itself runs on EAS cloud servers; when it finishes, download the
artifact from the EAS build page, install the dev client on the phone,
and start the dev server from `app/`:

```sh
cd app
npx expo start --dev-client
```

### Local alternative (same build, from a terminal)

```sh
cd app
npm install
npx expo install        # aligns dependency versions with the Expo SDK
npx eas build --profile development --platform android   # dev build (APK/AAB)
npx eas build --profile development --platform ios       # dev build (needs Apple signing)
npx expo start --dev-client
```

Store builds use `--profile production` (`distribution: store`). The iOS
bundle id and Android package are both `com.inthemidst.app`, matching the
existing Play Console app and App Store Connect record. Camera and
microphone permission strings are in `app.json`.

Build numbers: the first store upload is 1.0 build 1 (`android.versionCode`
1, `ios.buildNumber` "1"). Every later upload MUST bump them — raise
`versionCode` by at least 1 for each new Android upload, and raise
`buildNumber` for each new iOS upload — or the store will reject the
binary as already uploaded. The `version` ("1.0.0") only changes when the
release version itself changes.

No credentials live in this repo. The server URL is a plain constant in
`src/constants.js`; signing credentials belong in EAS credentials / GitHub
secrets, never in the code. The project id above is not a credential.

### iOS submission to TestFlight (after the first build)

Submitting an iOS build to TestFlight additionally needs the App Store
Connect API secrets (already stored as GitHub secrets:
`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`,
`APP_STORE_CONNECT_PRIVATE_KEY`) plus the updated Apple Developer Program
License Agreement accepted by the Account Holder in App Store Connect.
The license acceptance is still pending and blocks submission until the
Account Holder accepts it. The first iOS build may also need Apple
signing credentials configured in EAS; the App Store Connect API key
above is the credential for that.

## What is built so far

- Navigation (Home -> Meeting) with a real signaling client: connect,
  create room, join by code (with lookup + recent gatherings + stored host
  keys), waiting-room notice, live participant list from `state` events,
  mic/cam toggles that emit `media` and replace sender tracks, leave, and
  host end-for-everyone. Peer connections are created for every peer and
  signaling is fully wired; remote streams are received by `PeerManager`.
- Video tiles (`src/components/VideoTiles.js`): `<RTCView>` grid with a
  mirrored self-view, mic/cam/hand indicators, spotlight border, and
  video-off / connecting placeholders.
- Chat (`ChatPanel.js`): group + private messages via `chat` events,
  seeded from the join reply's last 100 messages.
- Prayer wall (`PrayerPanel.js`): open/answered filters, add (with
  anonymous option), `prayer:pray` toggle, `prayer:answered` toggle,
  `prayer:remove`, and host show-on-screen (`overlay:show` kind prayer).
- Scripture (`ScripturePanel.js`): bible-api.com lookup (kjv/web/bbe/
  darby, same URL construction as web), show-to-everyone overlay, custom
  passage, overlay clear.
- Worship (`WorshipPanel.js`): host lyrics form (blank line = new slide),
  slide list, prev/next, stop/present, guest slide view.
- People + host controls (`PeoplePanel.js`): waiting list with Admit /
  Deny / Admit all, per-person mute / ask-unmute / video-off / lower-hand /
  make-host / spotlight / remove, room-wide mute-all, lower-all-hands,
  lock, waiting-room toggle, recording names.
- Reactions + hand-raise (`ReactionBar.js`): the six server reactions
  (🙏 🙌 ❤️ 👏 🔥 🕊️) shown as expiring chips, hand toggle via `hand`
  events, recording toggle via `recording` events.
- Shared on-screen card (`OverlayBanner.js`): renders `state.overlay`
  (prayer or verse) with a clear button.
- Invite sharing: an Invite button in the meeting opens the system share
  sheet with the join link `https://in-the-midst.onrender.com/?room=<code>`
  plus the 9-digit code (formatted `XXX-XXX-XXX`); if the share sheet is
  unavailable, an on-screen invite box shows the link and code instead.
- Screen sharing (Android): a Share screen button starts
  `mediaDevices.getDisplayMedia` (system MediaProjection dialog); the
  screen track replaces the camera as outgoing video via
  `PeerManager.setScreenTrack`, `media` is re-emitted with `sharing: true`
  (same event/field as web), one sharer at a time, and the track's
  `onended` stops the share. On iPhone the button honestly says screen
  sharing is not available yet — it needs a native Broadcast Upload
  Extension this JS-only project cannot provide, so no fake control.
- Build numbers: first store upload is 1.0 build 1 —
  `android.versionCode` 1 and `ios.buildNumber` "1" in `app.json`.

## What remains to build

- Store assets: screenshots and store listings (the app icon, splash, and
  adaptive icon are already wired in `app.json`; the Play and App Store
  records already exist for `com.inthemidst.app`).
- First build: the EAS project exists and the cloud-build workflow
  (`eas-build.yml`) is ready, but no dev or store build has run yet, and
  native module linking plus a real two-device call are still unverified.
  TestFlight submission additionally waits on the Apple Developer Program
  License Agreement (Account Holder acceptance).

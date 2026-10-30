# In the Midst

Video gatherings for church: prayer meetings, Bible study, and praise & worship. Works in any modern browser on phones, tablets and computers. No accounts, no app store.

## What it does

**Meeting basics (like Zoom)**
- Start a gathering and get a 9-digit code and invite link
- Mute / unmute, camera on / off, choose microphone, camera and speaker
- Screen share (computers), gallery view and speaker view, pin a video (double-click)
- Chat to everyone or privately to one person
- Raise hand, reactions (Amen, Praise, Love, Clap, Fire, Peace)
- Record the gathering to your computer (everyone sees a "Recording" badge)
- Waiting room, lock the gathering, mute all, ask to unmute, stop someone's video, spotlight, make host, remove, end for everyone
- Host passes automatically if the host leaves
- Keyboard: Alt+A mute, Alt+V video, Alt+S share, Alt+Y raise hand, hold Space to talk while muted
- "You are muted" reminder when you talk while muted; keeps phone screens awake

**Made for church**
- **Prayer wall**: anyone adds requests (with or without their name), others tap "I prayed", the host or author marks it answered. The wall is saved with the gathering, so it carries over week to week.
- **Scripture**: look up any passage (KJV, WEB, BBE, Darby) and show it on everyone's screen, or type in your own translation.
- **Worship lyrics**: the leader pastes lyrics, each verse becomes a slide, and moves through them for everyone (arrow keys work). Songs are saved on the leader's device for next time.
- **Original sound for music**: turns off echo cancelling and noise reduction so singing and instruments sound natural.
- The host can put a prayer request on everyone's screen to pray over it together.
- Each gathering type opens the right panel: Prayer Meeting → prayer wall, Bible Study → scripture, Praise & Worship → lyrics.

## Run it on your computer

Needs Node.js 18 or newer. There is nothing to install.

```
node server.js
```

Open http://localhost:3000. To test with two people, open it in two browser windows.

## Put it online for your church

Cameras and microphones only work on **https** sites, so deploy it to a host that gives you https. Any Node.js host works. On Render (free tier available):

1. Put this folder in a GitHub repository.
2. On render.com choose **New → Web Service**, pick the repository.
3. Build command: leave empty. Start command: `node server.js`.
4. Add a persistent disk mounted at `/data` and set the environment variable `DATA_DIR=/data` so gathering codes and prayer walls survive restarts.

Railway, Fly.io, a VPS, or `docker run -p 3000:3000 -v urdata:/app/data $(docker build -q .)` all work the same way.

### Make it connect on every network (TURN server)

Most people connect directly. People on strict church, school or office Wi-Fi, or some mobile networks, need a relay (TURN) server. Get one from a service such as Metered, Twilio or Cloudflare Calls, or run coturn, then set:

```
TURN_URL=turn:your.turn.host:3478,turns:your.turn.host:443
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

## How big can a gathering be?

Video goes directly between people (peer-to-peer), so there is no video server to pay for. That works well for **up to about 8 people with cameras on**, more if most cameras are off. For a whole congregation (25+ on video, or a livestream-style service), swap the peer-to-peer part for a media server such as LiveKit or mediasoup; the prayer wall, scripture, worship, chat and host controls all stay the same.

## Files

- `server.js`: web server, WebSocket messaging and meeting state (no dependencies)
- `public/index.html`, `public/style.css`, `public/app.js`: the app
- `data/rooms.json`: created automatically; gathering codes, host keys and prayer walls

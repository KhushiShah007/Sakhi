# Prompt for Claude Code: fix Vent recording, build a real Rehearsal chatbot, and fix the repeating or silent voice

Copy everything below the line into Claude Code (VS Code or terminal), opened in the `sakhi` project folder.

---

You are working in the **Sakhi** repository: a voice-first menopause companion for Indian women aged 40–55. The UI is in Hindi, Marathi, Gujarati and English, and Hindi is the default. The stack is React + Vite + TypeScript + Tailwind on the front end, and a Fastify API in `server/` backed by PGlite or Postgres. It is deployed as a static site on GitHub Pages and can also run as a full server (`npm start`).

Testers report three bugs. Fix all three end to end, with tests. Work through the steps **in order**. Do not skip the reproduce step: find the real cause before you change any code.

## Ground rules

1. Before touching code, read `README.md`, `SETUP.md`, `DECISIONS.md`, `SAFETY.md`, `PRIVACY.md` and `PROGRESS.md`.
2. Keep every existing safety behaviour:
   - Crisis detection runs first, and helplines are shown.
   - Rules run before the LLM, and LLM output is validated with Zod plus the blocklist.
   - No diagnosis and no medication advice.
   - Sensitive fields are encrypted with `SAKHI_DATA_KEY`.
   - Retention purge rules still apply.

   Anything new you add must go through the same pipeline.
3. Everything must still work with **zero keys**, so every feature needs a working fallback. `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY` only upgrade quality.
4. Every user-visible string goes in `src/i18n/strings.ts` in all four languages (`npm run check:i18n` must pass). Body text ≥16px, buttons ≥48px, WCAG AA contrast.
5. Make small commits with clear messages, one per fix. Never commit `*.pptx`, `.env` or `design-reference/`.
6. Before you finish, all of these must pass: `npm run build`, `npm run typecheck:server`, `npm test`, `npm run test:safety`, and (with the server running) the relevant `npm run e2e:live` suites.
7. Do not stop to ask questions. Make sensible decisions and write them down in `DECISIONS.md`.

## Step 0: Set up and reproduce exactly what testers see

The app behaves very differently depending on where it runs. Check both:

- **A. GitHub Pages (static, no API).** `src/api/session.tsx` sets `status = 'offline'`, and `/vent` renders `VentMock` from `src/screens/Vent.tsx`. That is a **scripted animation with no microphone at all**. `src/screens/Rehearsal.tsx` hides the free-text and mic box unless `live` is true. Testers who open the Pages link will see "Vent does not record" and "I cannot chat", because those screens are mock-only there.
- **B. Local full server.** Run `npm install && npm run build:web`, then `DEMO_AUTH=true npm start` and open http://localhost:8787. Sign in with any 10-digit number and code `123456`. Optionally run `npm run seed` first, with the server stopped. In this mode `/vent` renders `VentLive` and uses the real `useListen` in `src/voice/speech.ts`.

For each bug below, write down for A and B, in Chrome desktop and Chrome on Android if you can (Edge too, and note that Firefox and Brave have no Web Speech recognition):
- what happens
- the console errors
- the network calls (`/api/...`)
- the value of `status` from `useSession()`

Put the findings at the top of `PROGRESS.md` under "Bug triage <date>".

## Bug 1: Vent Mode does not record anything

### Debug (check each of these and record the result)
1. **Which component renders?** Log `status` and confirm whether `VentLive` or `VentMock` is on screen. If testers are on Pages, recording cannot happen at all; that is the main cause there (see Fix 1a).
2. **Is speech recognition supported?** Check `sttSupported()`. Without `SpeechRecognition` or `webkitSpeechRecognition` (Firefox, Brave, iOS in-app browsers, some WebViews), `VentLive` must fall back to typing **and say so visibly**. Confirm that it does.
3. **Microphone permission and secure context.** Recognition needs HTTPS or `localhost`. Testing over a LAN IP (`http://192.168.x.x:8787`) fails silently. Log `window.isSecureContext`, and check `navigator.permissions.query({name:'microphone'})`.
4. **Errors that are swallowed.** In `useListen`, `onerror` stores `e.error` (`not-allowed`, `no-speech`, `audio-capture`, `network`, `language-not-supported`, `aborted`). Check whether `VentLive` actually **shows** these to the user. If it does not, that is a bug.
5. **Language.** `SPEECH_LANG` maps `mr` to `mr-IN` and `gu` to `gu-IN`. Chrome's cloud recogniser supports these, but some devices and Edge do not and return `language-not-supported`. Fall back in this order: requested language → `hi-IN` → `en-IN`. Tell her which language is being used.
6. **The restart loop.** `onend` calls `r.start()` again while `want` is true. Check that this does not throw `InvalidStateError`, does not loop forever on `no-speech`, and does not lose the final transcript. Make sure `stop()` returns the text **after** the last final result arrives (wait for `onend`, or a short timeout, before reading `textRef`).
7. **Starting from a tap.** `start()` must run synchronously inside the click handler, not after an `await`, or mobile Chrome blocks it.
8. **Interference from speech output.** If `speak()` is talking when recognition starts, some Android devices give the mic to TTS. Call `stopSpeaking()` before `start()`.
9. **After recording.** Confirm that the request to the vent API is sent, then trace the response through confirm → saved → reflection, and check the row exists in the DB.

### Fix
- **1a. Pages / offline mode.** Choose one approach, implement it, and record which in `DECISIONS.md`:
  - **Preferred:** in offline mode, `/vent` uses the real microphone (`useListen`) with a **client-side rule-based extractor**. Port or share the keyword rules from the server so that her actual words become symptom chips, and store entries in `localStorage` under a "saved on this device" label.
  - **Minimum:** if you do not build the above, show a clear banner on the Pages build: "Demo only. Recording works in the full app", with a link to setup instructions.
- **1b. Error states.** Show a friendly, translated message and a next step for each error code: `not-allowed` → how to allow the mic; `no-speech` → "I didn't hear anything, tap to try again"; `unsupported` → the typing box opens automatically. Never leave a dead button.
- **1c. Feedback while recording.** Show a live level meter or waveform driven by real audio (`getUserMedia` + `AnalyserNode`), plus a running timer and interim words, so she can see it is listening.
- **1d.** Apply the language fallback (debug item 5), the `stopSpeaking()` call (item 8) and the reliable final transcript (item 6).

### Done when
- In local full mode on Chrome: she taps the orb and speaks Hindi for 20 seconds. Words appear live, symptom chips appear, she taps Done, the confirm list shows what she said, she saves, and a reflection is shown **and spoken**. The entry appears in History and survives a reload.
- If mic permission is denied, she sees a clear message and the typing box.
- Extend `scripts/e2e-vent.mjs` / `e2e-mic.mjs`. Inject a fake `webkitSpeechRecognition` with `page.addInitScript` that emits interim and final results, then assert chips → confirm → saved row. Add a test for the `not-allowed` path.

## Bug 2: The Rehearsal Room does not work: no chat, nothing saved

### Current behaviour (confirm it)
`src/screens/Rehearsal.tsx` plays a **fixed script** (`scenarios` in `src/mock/content.ts`). Whatever she says, the "other person" just replies with the next scripted line. The free-text and mic box only appears when `live` is true. The only server call is `POST /api/rehearsal/feedback` in `server/src/api/night.ts`, at the end of the scene, and that call stores nothing by design. So it is not a chatbot, and nothing is saved.

### Goal: a real, talking role-play chatbot
She picks a scenario (talking to her husband or family, to HR or her manager, or to her doctor) and has a **free conversation**. Sakhi plays the other person, replies to **what she actually said**, speaks the reply aloud, and coaches her at the end. Each session is saved and can be reopened.

### Build
1. **API.** Add a `server/src/api/rehearsal.ts` module (register it in `app.ts`, and move the feedback route there):
   - `POST /api/rehearsal/sessions`, body `{scenario, lang}`. Returns `{id, opening}`, where `opening` is the other person's first line.
   - `POST /api/rehearsal/sessions/:id/turn`, body `{text}`. Returns `{reply, done?, crisis?}`.
   - `POST /api/rehearsal/sessions/:id/end`. Returns `{checks, tip, summary}` and reuses the existing rule-based feedback.
   - `GET /api/rehearsal/sessions` lists her sessions; `GET /api/rehearsal/sessions/:id` returns a transcript; `DELETE /api/rehearsal/sessions/:id` deletes one.
   - Every route uses the same `guarded` + CSRF + rate-limit setup as the others, and is scoped to the signed-in user.
2. **Storage.** Add a `rehearsal_sessions` table (id, user_id, scenario, lang, created_at, ended_at, feedback json) and a `rehearsal_turns` table (session_id, idx, who, text_encrypted, created_at). Encrypt turn text with `SAKHI_DATA_KEY` the same way as other sensitive fields. Add both tables to the retention purge and to her "delete my data" flow. Write a migration.
3. **Safety first on every turn.** Run her text through the **same crisis detector used by Vent** (find it in `server/src/safety/` and the vent route) before anything else. On a crisis, return the crisis message and helplines, and pause the role-play.
4. **Replies with a key (`ANTHROPIC_API_KEY` set).** Use `server/src/llm/provider.ts` with model `SAKHI_MODEL_CHAT`. Write a per-scenario system prompt:
   - The character is realistic but kind (husband: a bit dismissive at first, then comes round; HR: polite and procedural; doctor: rushed but listening).
   - Replies are 1–3 short sentences in her language.
   - No medical advice, no diagnosis, never cruel.
   - The character never stops playing the role unless she asks to stop.

   Send the last ~12 turns as context. Validate the output with Zod (non-empty, ≤300 characters, correct script for the language) and the blocklist. If it fails, use the fallback below.
5. **Replies without a key (rule-based, but it must actually respond).** For each scenario, build a small state machine with intents: greeting, states_feeling, explains_symptom, makes_request, asks_question, blames, gives_up/apologises, thanks, off_topic. Detect intents with multilingual keyword lists (hi/mr/gu/en, including Hinglish written in Latin letters; reuse `src/voice/match.ts` if it fits). Give each intent **several** reply variants per language, and never use the same line twice in a session. Move the scene forward: resistance → understanding → agreement. End after she makes a clear request, or after about 8 turns.
6. **Front end.** Rewrite `Rehearsal.tsx` as a chat:
   - Message bubbles, a "typing…" indicator while waiting.
   - A mic button (using the Bug 1 fixes) **and** a text box, both always available when live.
   - The other person's reply is spoken with `speak()`, with a mute toggle.
   - Buttons for "Suggest a line" (the old scripted line, as a hint), "End & get feedback" and "Start again".
   - A "Past rehearsals" list (resume, review, delete).
   - Offline (Pages) mode runs the rule-based engine in the browser (share the code), saves to `localStorage`, and labels it "saved on this device".
   - Keep `?s=` / `?all=1` working for the demo and screenshots (`embedded` / mock path).
7. **Tests.** Add `server/test/rehearsal.test.ts`, covering:
   - creating a session, two turns, ending it, listing, deleting
   - a crisis phrase in each language returning helplines
   - no repeated fallback replies over 8 turns
   - the encrypted column not containing plain text
   - user A cannot read user B's session

   Add rehearsal prompts to the safety suite. Add `scripts/e2e-rehearsal.mjs`: type → reply appears → reload → session still listed. Add it to `e2e-all.sh`.

### Done when
In Hindi, she types or says "मुझे रात को नींद नहीं आती, मैं थक जाती हूँ" to the "husband" and gets a relevant reply (not a fixed script line), which is shown and spoken. After 4–5 turns she ends it and sees feedback. The session appears under Past rehearsals after a reload. The same works in mr, gu and en, with and without `ANTHROPIC_API_KEY`.

## Bug 3: The voice repeats the same thing ("Let your shoulders drop…"), or says nothing

### Where to look (reproduce each one and note what you hear)
- `src/screens/Home.tsx` → `PlanRelax`: a 6-line relax track starting with `rx_1` ("Let your shoulders drop…"). It moves to the next line from inside the `speak()` `onEnd` callback.
- `src/screens/ThreeAMLive.tsx` → `guide()`: the wind-down lines `rx_1, rx_2, rx_3, rx_6`.
- `src/screens/RightNow.tsx`: speaks "breathe in / hold / breathe out" at **every** phase change, about 22 times in 90 s. That is the "same thing again and again".
- `server/src/api/ivr.ts` + `src/screens/MissedCallLive.tsx`: the script is intro → shoulders → breath ×3.
- `src/voice/speech.ts`: `speakBrowser` / `speakServer`.

### Likely causes (confirm each one with logging before fixing it)
1. **`onerror` treated as `onend`.** `u.onerror = done`. When there is no voice for `hi-IN` / `mr-IN` / `gu-IN` (common on Windows and many Android phones), or Chrome blocks speech without a user gesture (`not-allowed`), every utterance errors instantly. The player then skips through every line silently, or loops, and she hears nothing. Log `event.error` for every utterance.
2. **No voice for the language.** `pickVoice` returns nothing, so the browser either uses an English voice reading Devanagari (gibberish) or stays silent. Add a fallback, in order: exact language → `hi-IN` voice for mr (Devanagari) → server TTS (`/api/tts`) if available → **show the text on screen with a "voice not available on this device" note** and a Settings link. Never fail silently.
3. **`voiceschanged` timing.** On the first call `getVoices()` is often empty. Wait for `voiceschanged` (with a ~1 s timeout) before choosing a voice.
4. **Chrome's long-utterance and `onend` bugs.** Chrome sometimes never fires `onend`, or stops after ~15 s, or after the tab is hidden. Add a watchdog: if neither `onend` nor `onerror` fires within `text.length * 120ms + 3s`, cancel and continue. Keep a reference to the utterance so it is not garbage-collected.
5. **Restarting when state changes.** Check that no `useEffect` re-runs `speak()` when `lang`, `t` or the playing state change (React StrictMode runs effects twice in dev). Check that `run.current` / `token` guards stop old callbacks from starting the track again from line 1.
6. **Right Now repetition is a design problem.** Speak the full cue only for the first 2 breath cycles. After that, play a soft chime or nothing, and every ~30 s say one varied encouraging line from a pool ("You're doing well", "Halfway there", "Keep the out-breath long"). Never say the same line twice in a row.
7. **The relax track ends and starts over.** When the last line finishes, stop and show "Done", rather than resetting to line 0 and auto-playing.

### Fix
Put the fixes in `src/voice/speech.ts` so every screen benefits:
- Distinguish `onend` from `onerror`, and expose an `onError(reason)` callback.
- Add the watchdog, the voice fallback chain and the `voiceschanged` wait.
- Add an exported `useVoiceStatus()` that returns `{available, voiceName, reason}`. Screens use it to show "Voice: <name>" or "Voice not available, showing text".
- On the first user tap anywhere, call `speechSynthesis.speak(new SpeechSynthesisUtterance(''))` once to unlock audio on mobile.

Then fix Right Now, PlanRelax, ThreeAMLive and MissedCallLive as described above, so each spoken line is **different** and the player **stops at the end**.

### Done when
- On a device with no Hindi voice, she sees the text and a clear note instead of silence or a fast skip.
- On Chrome with a Hindi voice, every relax line is spoken exactly once, in order, then it stops.
- Right Now speaks the cue twice, then varied encouragement, and never the same line back to back.
- The 3 AM wind-down and the missed-call line each play once and stop.
- Add unit tests for `speech.ts`: mock `speechSynthesis`, simulate an error on every utterance, and assert no fast loop plus `onError` called; simulate `onend` never firing and assert the watchdog moves on. Extend `scripts/e2e-voice.mjs` to count `speak` calls during 90 s of Right Now.

## Step 4: Final checks and report

1. Run every command in Ground rule 6 and fix any failures. Paste the summary output into `PROGRESS.md`.
2. Manual pass in Hindi, then English, on local full mode in Chrome. Record a ≤60 s screen capture of the flows if you can:
   - Vent: speak → confirm → saved → reflection spoken.
   - Rehearsal: a 5-turn chat, end, feedback, reload, resume.
   - Right Now, the relax track and 3 AM.
3. Check the GitHub Pages build (`npm run build` then `npm run preview`) to confirm offline mode records (or clearly says it can't) and Rehearsal chats on-device.
4. Update `README.md` and `SETUP.md`: how to run the full app, and which browsers support voice (Chrome/Edge yes; Firefox/Brave typing only; iOS Safari partial).
5. Commit, then reply with:
   - the root cause of each bug, as found in Step 0
   - what you changed (with file paths)
   - which tests were added and their results
   - anything you could not verify, such as real Android or iOS devices

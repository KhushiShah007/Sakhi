# Demo day checklist

## The night before (10 minutes)
1. Plug in the laptop. Turn off sleep (Settings > System > Power).
2. Open the Sakhi folder and double-click **`start-demo.bat`** (or run `npm run demo`). Wait for "Sakhi is running at http://localhost:8787". Chrome opens by itself.
3. Sign in: phone `9999900001`, code `123456`.
4. In **Chrome** (not Edge/Firefox), open **Vent**, tap the circle, allow the microphone, say one sentence, tap *Done speaking*. This also downloads the offline speech tool once (about 80 MB, only if Chrome's own speech service is unreachable), so it works without internet on the day.
5. Click through everything in the order below once. Then close the window (Ctrl+C), and start it again to confirm a clean start works.
6. Want the demo data back to the starting point? `npm run demo:fresh` (wipes only the demo database).

## On the day
- Start `start-demo.bat` **before** the jury arrives. Keep that black window open and do not close it.
- Bring a phone hotspot. Chrome's voice recognition needs internet; without it Vent records and writes the words out on the laptop (needs step 4 above done once).
- Backup 1: the Vercel link (static version). Backup 2: a short screen recording on your phone.

## Suggested order (about 4 minutes)
1. **Welcome / language** - switch Hindi, Marathi, Gujarati, English.
2. **Vent** - tap, speak a symptom in Hindi/English. Words appear; chips appear; *Done speaking*; confirm list (nothing is saved until she confirms); *Yes, save it*; spoken reflection.
3. **Home** - her week, Symptom Weather (an estimate, labelled), "Tell my family".
4. **Family link** - Me/Privacy > family; the card the family sees (no words of hers).
5. **Right Now** - 90-second breathing with the calm voice.
6. **Rehearsal Room** - pick "Ask family", say "I feel tired at night and cannot sleep"; the husband answers; end and read the feedback.
7. **Doctor-Ready Brief** (PDF) and **Letter to Myself**.
8. **Privacy centre** - what is shared, consents, export, delete; the audit trail.
9. **HR dashboard** (`/#/hr`, code `NAVRANG-HR-DEMO`) - only aggregates, nothing under 10 people shown.
10. **Admin** (`/#/admin`, key `admin-demo-key`) - the clinician-review register. **Say plainly that no clinician has reviewed the wording yet**: the register shows every item as pending, which is the honest state.

## Honest answers for the Q&A
- It is a prototype, not a medical device. It never diagnoses or advises on medicines; a crisis phrase shows helplines instead.
- Targets in the deck are hypotheses to test in a pilot, not results.
- Demo data is fictional. Voice is a synthetic calm voice, never a clone.
- Hindi/Marathi/Gujarati speech-to-text accuracy has not been measured; she always confirms the words before anything is saved.

## If something goes wrong
| Problem | Do this |
|---|---|
| Page does not open | Check the black window says "Sakhi is running". If not, close it and double-click `start-demo.bat` again. |
| "Address already in use" | Another copy is running. Close all black windows, start once. |
| Vent shows "speech service could not be reached" | Wait: it switches to recording by itself. Or type the sentence. |
| Mic blocked | Click the lock icon in the address bar > Microphone > Allow, then refresh. |
| Everything looks odd | Refresh with Ctrl+Shift+R. Still odd: `npm run demo:fresh`. |

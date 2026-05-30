# User Manual: Learning German with Lina

Lina is your personal German voice tutor. She drives the conversation,
asks concrete questions, gently corrects your grammar, and helps you when
you're stuck — in German, English, or Arabic.

---

## 1. Starting a Session

1. Open **http://localhost:3000** in your browser
2. A **scenario picker** appears automatically — choose a lesson topic:
   - **Daily Life** — introduce yourself, talk about routines (A1)
   - **At the Restaurant** — order food and drinks (A1–A2)
   - **At the Doctor** — describe symptoms (A2)
   - **Traveling** — buy tickets, ask directions (A2)
3. Click the card. The session starts immediately.
4. The status dot in the top bar turns **green** — you're connected.
5. Lina greets you and begins the first lesson point.

> **Can't see the picker?** Click the **gear icon** (top right) → **Change Scenario**.

---

## 2. Speaking with Lina

### Push-to-Talk Controls

| Method | Start recording | Stop recording |
|--------|----------------|----------------|
| **Keyboard** | Hold **Space** | Release **Space** |
| **Mouse** | Click and hold the mic button | Release |
| **Touch** | Tap and hold the mic button | Lift finger |

The mic button pulses **red** and shows animated waveform bars while recording.

**Minimum recording time:** Hold for at least **1.5 seconds**. If you release
too early, recording continues briefly to ensure enough audio is captured.

### What happens after you speak

1. **Transcript** — your words appear in a **blue bubble** on the right
2. **Lina thinks** — a typing indicator shows while she generates her reply
3. **Lina speaks** — her text streams into a **green bubble** on the left
4. **Audio plays** — Lina's voice starts as soon as the first sentence is ready
5. **Correction badge** — a yellow **"Sag besser: …"** chip appears if you made an error

---

## 3. Language Rules

Lina **always leads in German** at your current level (A1–A2).

| You say | Lina's response |
|---------|----------------|
| German (correct) | Reacts naturally, asks the next question |
| German (with errors) | Reacts naturally, shows the correction badge, continues |
| English | Briefly acknowledges, gives German equivalent, continues in German |
| Arabic | Says "Auf Deutsch sagt man: …", gives the phrase, continues in German |

**If you are completely stuck**, Lina gives you the exact German phrase to repeat,
then asks the question again. You never need to stay silent.

---

## 4. Understanding Corrections

The yellow **"Sag besser"** badge is the most important teaching tool.

**What it shows:** The corrected version of what you said — not just that you
made an error, but exactly what to say instead.

**Example:**
- You say: *"Ich bin gehen zum Supermarkt"*
- Badge shows: **Sag besser: Ich gehe zum Supermarkt.**
- Lina continues speaking naturally

**When it appears:** The correction runs in parallel with Lina's reply. It
typically appears after her first sentence — never interrupting her speech.

**Your original words** still appear in your transcript bubble so you can
compare the two versions.

---

## 5. Lesson Structure

Each scenario has 7–9 lesson points that Lina works through in order.
She never asks "what do you want to practise?" — she always drives forward.

**If you say only "okay", "thank you", or something off-topic**, Lina continues
to the next lesson point automatically. The conversation never stalls.

**Example flow for Daily Life:**
> *Lina:* "Hallo! Wie heißen Sie?"  
> *You:* "Ich heiße Ahmad."  
> *Lina:* "Schön, Ahmad! Wo wohnen Sie?"  
> *You:* "Ich wohne in Berlin."  
> *Lina:* "Super! Um wie viel Uhr stehen Sie morgens auf?"

---

## 6. During Playback

While Lina is speaking:
- The status bar shows **"Speaking"**
- **Start recording at any time** — Lina's audio stops immediately and recording begins
- You don't need to wait for her to finish

---

## 7. Changing the Lesson Topic

1. Click the **gear icon** (⚙) in the top right
2. Select **Change Scenario**
3. Choose a new topic from the cards

> **Note:** Changing the scenario starts a fresh conversation. The previous
> session's history is saved to the database but the conversation resets.

---

## 8. Reconnecting

If the connection drops (the dot turns red):
- The app automatically reconnects with exponential backoff
- Or click the **↺ refresh icon** to reconnect immediately

---

## 9. Tips for Better Learning

**For accurate speech recognition:**
- Speak at a **natural pace** — not too fast, not too slow
- Hold the mic button for at least **2 seconds** before releasing
- Speak **close to your microphone** (30–50 cm)
- **Avoid background noise** — close windows, turn off music

**For faster improvement:**
- **Repeat corrections aloud** — when you see "Sag besser", say it out loud
- **Don't switch to English** — even if it's easier, push through in German
- **Sessions of 15–20 minutes** are more effective than longer ones
- **Do the same scenario twice** — the second time you'll make fewer mistakes

**For vocabulary:**
- Lina introduces vocabulary naturally in context — no word lists
- If a word is new, try to use it in your next response
- Lina will correct wrong usage gently

---

## 10. Troubleshooting

| Problem | Solution |
|---------|----------|
| Mic button is greyed out | Wait for the green "Connected" dot or click ↺ to reconnect |
| Browser asks for mic permission | Click **Allow** — without mic access, Lina cannot hear you |
| Lina mishears you | Speak more clearly, closer to the mic, at a slower pace |
| Lina takes a long time to respond | Ollama may be loading the model — wait 15 s on first turn |
| No audio / silent | Check system volume, ensure tab is not muted, click the page once |
| Sound is fast or garbled | Hard refresh the page (Cmd+Shift+R) to reload the latest frontend |
| Stuck at "Disconnected" | See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |

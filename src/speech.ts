/* Read aloud (Settings → Read aloud): the guide's lines and the game's messages, spoken by the phone's own voice.
   Many farmers read slowly or not at all in English; hearing the line helps. Nothing is downloaded. */

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

export const canSpeak = () => !!synth();

let chosen: SpeechSynthesisVoice | null | undefined;
function voice() {
  const s = synth();
  if (!s) return null;
  if (chosen) return chosen;
  const all = s.getVoices();
  if (!all.length) return null;
  // a Kenyan English voice if the phone has one, then any African or British English, then any English
  chosen = all.find(v => /en[-_]KE/i.test(v.lang)) ?? all.find(v => /en[-_](NG|ZA|TZ|UG|GH)/i.test(v.lang)) ?? all.find(v => /en[-_]GB/i.test(v.lang)) ?? all.find(v => /^en/i.test(v.lang)) ?? null;
  return chosen;
}

/** Speak one line, cutting off whatever was being said. */
export function speak(text: string) {
  const s = synth();
  if (!s || !text.trim()) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[·•]/g, ',').replace(/\s+/g, ' ').trim());
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-KE';
    u.rate = 0.95;
    s.speak(u);
  } catch {
    /* no voice on this device: the line stays on screen */
  }
}

export function stopSpeaking() {
  try {
    synth()?.cancel();
  } catch {
    /* nothing to stop */
  }
}

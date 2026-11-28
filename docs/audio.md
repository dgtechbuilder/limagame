# TemoLima's audio world

How the game sounds, why, and where each sound lives. Every sound is made on the phone with the Web Audio API:
nothing is downloaded, so there are no sound files to license and the game stays small.

## What we learned from Clash of Clans

Supercell has published very little about how Clash of Clans' in-game audio was made. Most public material is about
the promotional films (for example [BUTTER Music and Sound's "This Is the Sound of Clash!"](https://www.adsoftheworld.com/campaigns/this-is-the-sound-of-clash)
and [Soundtrack Creation's "Village News" film](https://www.soundtrack-creation.com/news/60)). What follows is drawn
from playing and listening to the game itself, not from Supercell's own notes. We borrow the ideas, never the assets.

| What Clash of Clans does | What it gives the player | How TemoLima does it |
| --- | --- | --- |
| **Layers, each with its own job.** A home-village music loop, a village ambience bed under it, building and unit sounds on top, and UI clicks and reward stingers above everything. | You can read what is happening by ear, even with the music on. | Six buses, each with its own level in Settings → Sound: *Music*, *Footsteps*, *Farm animals*, *Farm work*, *Ambience* and *Effects* (`src/audio/volume.ts`). |
| **An ambience bed so the village never goes dead.** Birds and air sit under the music and keep the world alive when the music rests. | The world feels inhabited, not silent between actions. | A soft breeze that swells and falls, birds every 6 to 14 seconds by day and crickets at night (`src/audio/farm.ts`, the air). |
| **Builder sounds tied to the work.** Construction is heard as hammering that keeps time with the builder's animation. | Work feels physical, and you hear what is still being built. | A stroke for every swing of the farmer's tool, in time with the arm (about three a second): the hoe in soil, the sickle through grass and weeds, the hammer, the wrench, wiring. |
| **A short, bright "done".** A building finishing is a punchy stinger in a major key, not a long tune. | Progress is rewarded instantly. | *Built*: three knocks, the frame settling and a two-note rise; *Power on*: a breaker clack, the inverter spinning up and a chime as the lights come on. Plus the existing action ding and flow fanfare (`src/sfx.ts`). |
| **Rewards sit on top of the music.** Big moments are heard clearly over the score. | The important sound is never lost. | The score is ducked: it dips under the flow fanfare (to 40% for 1.3 s), a finished building (45%), the power coming on (35%) and lightly under an action ding (70%), then comes back slowly. |
| **Separate music and sound switches.** Players can keep effects and drop the music, or the other way round. | Players choose their own mix (many play muted in public). | A **mute** button on the farm beside Settings, a *Mute* switch in Settings → Sound, and a level for each layer. Muting keeps every level, so unmuting brings the same mix back. |
| **Short loops that do not tire.** The village music is calm, melodic and loops well. | It can play for hours. | The score never quite repeats: a four-chord loop with a kalimba picking new notes each time, thinning out every 16 bars to breathe. |
| **Variation on repeated sounds.** Taps and hits vary a little in pitch and timing. | Repetition does not grate. | Every stroke, footstep and chirp is jittered a few percent in pitch, filter and timing (`jit()`). |

## The layers

| Layer | What it is | File |
| --- | --- | --- |
| Music | The calm background score, always playing once the first tap starts sound (browsers need one). Rests while the game is in the background. | `src/audio/ambience.ts` |
| Footsteps | One per footfall, different on grass and on soil. | `src/audio/ambience.ts` |
| Farm animals | Hens every 20 seconds, a cow every minute. | `src/audio/ambience.ts` |
| Farm work | Strokes while working: dig, cut grass, cut weeds, sow, fertilise, water, spray, harvest, hammer, wrench, wiring, diesel, hay, milk. A bigger stroke when a spot is finished. *Built* when the coop, the cow shed or a part of the power system goes up, and *Power on* when the main switch is thrown. | `src/audio/farm.ts` |
| Ambience | The breeze, the birds and the crickets. The **fridge** (in the restaurant kiosk) and the **freezer** (the storage annex) hum as the farmer walks up: full beside them, fading smoothly to silence about 5 m (fridge) and 6.5 m (freezer) away, and panned to the side they are on. The fridge is a lighter, higher hum (100 and 200 Hz); the freezer a deeper, fuller drone (60 to 240 Hz) with its condenser fan. Both breathe slowly like a real compressor. | `src/audio/farm.ts` |
| Effects | The action ding, the flow fanfare and the tractor's drive. | `src/sfx.ts`, `src/business/driveAudio.ts` |

## Mixing

- The overall volume starts at 2%, so the game is only lightly heard until the player turns it up.
- Each bus has a trim under its Settings level: music 0.42 (it sits under everything), steps 1, animals 0.8, work 0.75,
  ambience 0.6.
- Everything goes through one gentle compressor, so stacked sounds never clip.
- The music bus alone runs through the duck (`duck()` in `src/audio/ambience.ts`).
- A hum is only made while the farmer is in reach of it, and stopped a second after they leave, so the farm does not
  pay for machines nobody can hear.

## Testing

`tests/audio.spec.ts` plays each layer: the levels and mute, footsteps on grass and soil, the animals' timing, the
fridge and freezer getting louder closer up and silent far away, each work stroke, a part built and the power coming
on. The tests read what played through `window.__lima.audio()` and the hum levels through `window.__lima.hums()`.

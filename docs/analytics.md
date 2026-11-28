# Mixpanel analytics

The game sends its product analytics to Mixpanel (project token in `src/analytics/mixpanel.ts`, overridable with
`VITE_MIXPANEL_TOKEN`; `VITE_MIXPANEL=off` turns it off). Code:

- `src/analytics/mixpanel.ts`: the only place that touches the SDK. Init on boot (`src/main.tsx`), the SDK
  (`mixpanel-browser`, core build, ~43 KB gzip) fetched on its own so the first screen is not slower. Batched sends,
  kept on the phone and retried over a weak signal. Empty values are dropped, never sent as null or "".
- `src/analytics/context.ts`: browser, device type, referrer, UTMs, times kept on the phone (`lima-mp`).
- `src/analytics/useAnalytics.ts`: the events, read by comparing game state before and after each change. App calls
  it once; no screen changes. The first session's own log (`src/first/track.ts`) also tells it when the story is skipped.

Off in design review (`?review`, `?screen`) and in Playwright play-tests. A test turns on the test sink with
localStorage `lima-mp-test = 1`: events are kept in `window.__limaMixpanel` and nothing is sent (`tests/mixpanel.spec.ts`).

Every event carries the super properties `platform`, `game_version` (package version + commit), `browser`,
`device_type`, `session_id` and `country` (when known).

Identity: once the farmer exists and cloud save is on, events are tied to a SHA-256 hash of the player code (the code
itself unlocks the farm on any phone, so it is never sent). Player profile: country, currency, onboarding variant.

## Plan → game mapping

| Event | When it fires in TemoLima | Notes on properties |
|---|---|---|
| `first_visit` | First opening on a phone with no saved farm | `referrer`: direct, search, social or the referring host. Players with a save from before analytics get no first visit. |
| `onboarding_started` | The first session opens on Create your farmer | `onboarding_variant`: `first_session_v1` (one version so far; `ONBOARDING_VARIANT`). `entry_point`: `post_first_visit`, `deep_link` (a #/screen or ?cohort link), or `returning_visit` (first visit more than 30 min earlier). |
| `tutorial_step_completed` | Each first-session moment left: 1 create_farmer, 2 farm_story, 3 walk_to_maize, 4 farm_update, 5 first_crop_check, 6 walk_to_back_maize, 7 retry_crop_check, 8 walk_to_sukuma, 9 second_crop_check | `success` false for a wrong first crop check (sent to retry) or a skipped story. Steps 6–7 happen only after a wrong call. |
| `onboarding_completed` | The first session ends (the farm opens) | `currency_selected` from the country picked. `country_selected` is the ISO code, or `other` (US dollars). |
| `first_victory_completed` | The first activity completed after the first session (a farm job by hand, a field job finished on every tile, a harvest, a tractor job, a climate-smart lesson, a field round with a right call) | `progress_path`: `solo_3d_farm` or `solo_classic_farm` (no co-op). `energy_spent`: money spent by the winning action, in USD (the game has no energy meter). |
| `level_started` / `level_completed_or_exited` | Levels are the game's bounded missions: a job on the farm (`job:<key>`), Field rounds (`field_rounds`), a climate-smart lesson (`csa:<practice>`), a six-farm season (`six_farms_season`) | `difficulty_tier`: the certification level reached (Farm Starter … Master Farmer, or Newcomer). `campaign_cohort`: the player's programme tags (?cohort links), or `none`. `outcome`: completed, exited, or energy_blocked (a job refused because six are already waiting); failed and timed_out are not used yet. `attempt_count`: attempts at that level today. |
| `session_ended` | The game is hidden or closed (each stretch in the foreground is a session) | Sent by sendBeacon. `click_count` counts taps and clicks anywhere in the game. |
| `activity_completed` | plant_completed, harvest_completed, field_job_completed, onsite_job_completed, tractor_job_completed, lesson_completed, round_check_completed, sale_completed, meal_served (a plate served in the restaurant game: `dish`, `asked` (the dish or the kind of food asked for: energy, body, protect) and `right_food`) | Extra `where`/`job`/`lesson` say which. `activity_value`: score, bags, points, or money in USD. |
| `forest_sale_decision` | In the mini forest, after the "Before you sell" card that sets the money against the CO₂, credits and land lost: `decision` is `harvested` (a crop taken: nuts, fruit, pods, cut grass), `felled` (a stand sold for wood) or `kept_standing` (the player saw what felling would do and kept it) | `plant` (croton, baobab, napier…), `plant_kind` (tree, bush, grass); for a sale `money_usd`, `co2_kg` back in the air and `credits_cancelled`. Harvests and fellings also send `activity_completed` (harvest_completed / sale_completed, `where: mini_forest`). |
| `learn_page_viewed` | A Farm words section or Farm basics (`glossary/<section>`), a climate-smart lesson page (`csa/<practice>`), or a mini forest plant's card (`forest/<plant>`) | `partner_id`: the brand in that section's partner category (Fertilizer → feed, Seed → seed, Water → water, Tractors → machines, Solar → power, Training → basics). |

### The daily produce market (added 2026-11-28)

Beyond the 10-event plan, for the stall sold by grade and the store's storage (`src/produce/quality.ts`):

| Event | When it fires | Properties |
|---|---|---|
| `produce_sold` | The farmer sells at the stall grade by grade (Market stall › Sell today) | `kg`, `earned_usd`, `foods` (comma-separated ids), `grade1_kg`, `grade2_kg`, `grade3_kg`, `farm_day`. Also counted as `activity_completed` / `sale_completed` (`where: market_stall`). |
| `storage_changed` | A crop is stored another way (Storehouse › Store) | `food`, `method` (floor, pallets, hermetic, crates, cooler, cold), `from_method` (missing: the default), `cost_usd` (hermetic bags and the charcoal cooler are bought the first time). |
| `produce_spoiled` | A night in the store took some food below Grade 3 | `kg` spoiled that night (or nights, after a gap). |
| `sell_reminder_set` | The daily sell reminder is turned on or off | `enabled`. |
| `notification_permission` | The browser answers the notification prompt (asked when the reminder is first turned on) | `result`: granted, denied or default; `asked_from: sell_reminder`. |
| `sell_reminder_shown` | The day's reminder notification is shown (once a day, from 7 am, while the game is open or in the background) | `reminder_kind`: `drop` (something drops a grade tonight) or `sell` (kg left to sell), `kg`. |
| `sell_reminder_opened` | The game is opened from a reminder notification | (none) |
| `info_viewed` | Any ⓘ word card is opened, the storage and grade words included | `term_id`, `section` (the Farm words section), `screen` (the page it was opened on). |

## Consent

After the player has seen 7 pages (screens, counted by the game's address changing; `CONSENT_AFTER` in
`src/analytics/mixpanel.ts`), a card at the foot of the screen asks "Help improve TemoLima?" (`src/analytics/Consent.tsx`).
It does not stop play. Until they answer, analytics runs. **No thanks** opts the phone out through the SDK's own
opt-out, and nothing more is sent on any later visit. **Allow** keeps it on. The card is not shown again either way.
Kept in localStorage `lima-mp-consent` (pages counted in `lima-mp-pages`).

Not set up: autocapture, session replay.

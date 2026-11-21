import { LIFE, issueOf, type Group, type IssueId } from './config';

/* Examining a sick animal: the signs of a problem (config.ts ISSUES) seen on the animal itself, part by part, as a vet
   checks one. Each group has one standard set of PARTS in the order they are checked (head to tail, then what is round
   the animal: its feed, its water, its dung). Each part has a place on the drawing (ExamScene.tsx: a 480 × 270 scene)
   where the camera looks, how close it comes, and what a healthy animal shows there. A problem's FINDINGS say which
   parts show something, what it is, and how it is drawn. The examination visits the parts with a finding in the
   standard order; the player can also tap any part to look at it. */

export type CowPart = 'eyes' | 'nose' | 'mouth' | 'ears' | 'breath' | 'belly' | 'udder' | 'milk' | 'hooves' | 'temp' | 'dung' | 'stance' | 'feed' | 'water' | 'tank';
export type HenPart = 'comb' | 'eye' | 'beak' | 'neck' | 'feathers' | 'vent' | 'feet' | 'droppings' | 'perch' | 'nest' | 'eggs';
export type PartId = CowPart | HenPart;

export interface Part {
  id: PartId;
  label: string;
  /** where the camera looks on the 480 × 270 scene, and how close (1: the whole scene) */
  at: { x: number; y: number; z: number };
  /** what a healthy animal shows here */
  normal: string;
}

export const PARTS: Record<Group, Part[]> = {
  cows: [
    { id: 'eyes', label: 'Eyes', at: { x: 111, y: 106, z: 2.3 }, normal: 'Bright and clear, no tears. A dull, sunken or weeping eye is the first thing to see.' },
    { id: 'nose', label: 'Nose', at: { x: 84, y: 143, z: 2.2 }, normal: 'A cool, moist muzzle with clean nostrils: no drips, no crust.' },
    { id: 'mouth', label: 'Mouth', at: { x: 90, y: 156, z: 2.1 }, normal: 'Closed, chewing the cud. No drool, no sores on the tongue or gums.' },
    { id: 'ears', label: 'Ears & neck', at: { x: 140, y: 120, z: 2.0 }, normal: 'Feel under the ear and in front of the shoulder: the lymph nodes are small and hard to find.' },
    { id: 'breath', label: 'Breathing', at: { x: 214, y: 132, z: 1.6 }, normal: 'Watch the flank rise and fall: 10 to 30 breaths a minute at rest, quiet and even.' },
    { id: 'belly', label: 'Belly & left flank', at: { x: 296, y: 120, z: 1.7 }, normal: 'The hollow high on her left side dips in a little; the belly is round but soft.' },
    { id: 'udder', label: 'Udder', at: { x: 300, y: 186, z: 2.0 }, normal: 'Four even quarters, soft after milking, the same warmth as the skin round them.' },
    { id: 'milk', label: 'Milk', at: { x: 252, y: 224, z: 2.1 }, normal: 'About 10 L a day, smooth and white. Squirt the first milk into a cup to check it.' },
    { id: 'hooves', label: 'Legs & hooves', at: { x: 184, y: 228, z: 2.0 }, normal: 'She stands square on four feet and walks without a limp; the skin between the claws is clean.' },
    { id: 'temp', label: 'Temperature', at: { x: 368, y: 112, z: 1.9 }, normal: 'A thermometer under the tail reads 38 to 39.5 °C.' },
    { id: 'dung', label: 'Dung', at: { x: 392, y: 246, z: 2.2 }, normal: 'Soft pats that stack a little. Very runny, very hard or bloody dung is a sign.' },
    { id: 'stance', label: 'How she stands', at: { x: 250, y: 140, z: 1.15 }, normal: 'Alert, head up, weight on all four feet, in the sun or the shade as she likes.' },
    { id: 'feed', label: 'Feed trough', at: { x: 62, y: 214, z: 1.8 }, normal: 'Licked clean by the next feed: a cow eats every day.' },
    { id: 'water', label: 'Water trough', at: { x: 440, y: 212, z: 1.9 }, normal: 'Full and clean, dry ground round it, the float valve quiet.' },
    { id: 'tank', label: 'Water tank', at: { x: 446, y: 142, z: 1.7 }, normal: 'The level drops by what the farm uses: about 50 L a cow a day.' },
  ],
  hens: [
    { id: 'comb', label: 'Comb', at: { x: 180, y: 74, z: 2.4 }, normal: 'Bright red and plump on a laying hen. A pale comb means sick or not laying.' },
    { id: 'eye', label: 'Eyes', at: { x: 178, y: 90, z: 2.6 }, normal: 'Round, bright and open, watching you.' },
    { id: 'beak', label: 'Beak & breathing', at: { x: 162, y: 98, z: 2.3 }, normal: 'Beak closed, breathing quiet: no gasping, coughing or rattle.' },
    { id: 'neck', label: 'Neck & head', at: { x: 194, y: 116, z: 1.9 }, normal: 'Head held up and straight, the neck moving freely.' },
    { id: 'feathers', label: 'Feathers', at: { x: 258, y: 152, z: 1.5 }, normal: 'Smooth and glossy, lying flat. A hen fluffs up only to sleep or sit.' },
    { id: 'vent', label: 'Vent', at: { x: 312, y: 176, z: 2.1 }, normal: 'Clean, moist feathers round it. Lift the feathers to look for mites.' },
    { id: 'feet', label: 'Legs & feet', at: { x: 252, y: 226, z: 2.0 }, normal: 'Smooth scales, straight toes, no swelling. She walks and scratches.' },
    { id: 'droppings', label: 'Droppings', at: { x: 352, y: 246, z: 2.2 }, normal: 'Firm and brown with a white cap. Green, watery or bloody ones are a sign.' },
    { id: 'perch', label: 'Perch', at: { x: 402, y: 96, z: 1.7 }, normal: 'Every hen up on it at night, the wood clean. Check it with a torch after dark.' },
    { id: 'nest', label: 'Nest boxes', at: { x: 66, y: 206, z: 1.9 }, normal: 'Dry straw and whole, clean eggs.' },
    { id: 'eggs', label: 'Egg tray', at: { x: 66, y: 78, z: 2.1 }, normal: 'About 4 eggs a day from 5 hens, every day the same.' },
  ],
};

export const partOf = (g: Group, id: PartId) => PARTS[g].find(p => p.id === id)!;

/** How a finding is drawn on the animal (ExamScene.tsx). */
export type Mark =
  // cows
  | 'lump' | 'fever' | 'fastBreath' | 'tears' | 'runny' | 'noFeed' | 'tongueBlisters' | 'hoofBlisters' | 'milkLow' | 'quarter' | 'clots'
  | 'bloat' | 'kick' | 'pant' | 'shade' | 'drinkMore' | 'mud' | 'tankDrop'
  // hens
  | 'gasp' | 'greenDrop' | 'twist' | 'dead' | 'bloodDrop' | 'ruffled' | 'halfShut' | 'pale' | 'pecking' | 'bareVent' | 'specks' | 'brokenEggs' | 'eggBeak' | 'fewerEggs';

/** A measure the examination shows beside the finding: the reading, and what is normal. */
export type Reading =
  | { kind: 'temp'; value: number; normal: [number, number] }
  | { kind: 'rate'; value: number; normal: [number, number]; unit: string }
  | { kind: 'days'; what: string }
  | { kind: 'amount'; value: number; usual: number; unit: string };

export interface Finding {
  part: PartId;
  mark: Mark;
  /** what you see, in a few words (never the disease's name) */
  title: string;
  /** a line more: what it looks like, felt or measured */
  see: string;
  reading?: Reading;
  /** where it shows, when the animal's pose moves it from the part's usual place (a hen's head turned or twisted) */
  at?: { x: number; y: number };
}

const milkLeft = (id: IssueId) => Math.round(LIFE.milk.perCow * issueOf(id).output);

export const FINDINGS: Record<IssueId, Finding[]> = {
  ecf: [
    { part: 'eyes', mark: 'tears', title: 'Tears down her face', see: 'Both eyes weep; the tears leave wet streaks down her cheeks.' },
    { part: 'nose', mark: 'runny', title: 'A runny nose', see: 'Clear drips from both nostrils, and her muzzle is hot and dry above them.' },
    { part: 'ears', mark: 'lump', title: 'A swollen lump under the ear', see: 'The lymph node below the ear is the size of an egg: firm, and warm to the hand.' },
    { part: 'breath', mark: 'fastBreath', title: 'Fast breathing', see: 'Her flank heaves quickly even lying still.', reading: { kind: 'rate', value: 64, normal: [10, 30], unit: 'breaths a minute' } },
    { part: 'temp', mark: 'fever', title: 'A high fever', see: 'The thermometer under her tail climbs well past normal.', reading: { kind: 'temp', value: 41.2, normal: [38, 39.5] } },
    { part: 'feed', mark: 'noFeed', title: 'She will not eat', see: 'Her feed lies untouched in the trough.', reading: { kind: 'days', what: 'feed left' } },
  ],
  mastitis: [
    { part: 'udder', mark: 'quarter', title: 'One quarter hot, hard and swollen', see: 'The back left quarter is red and bigger than the others, and she flinches when you touch it.' },
    { part: 'milk', mark: 'clots', title: 'Clots and flakes in the milk', see: 'The first squirts from that teat into a dark cup show yellow flakes and clots.' },
  ],
  fmd: [
    { part: 'mouth', mark: 'tongueBlisters', title: 'Blisters on the tongue, and drool', see: 'White blisters on her tongue and gums; strings of drool, and she smacks her lips.' },
    { part: 'milk', mark: 'milkLow', title: 'The milk dropped at once', see: 'From one day to the next, most of her milk is gone.', reading: { kind: 'amount', value: milkLeft('fmd'), usual: LIFE.milk.perCow, unit: 'L of milk' } },
    { part: 'hooves', mark: 'hoofBlisters', title: 'Blisters between the claws; she limps', see: 'Raw blisters between the claws of a front foot. She holds it up and will not walk on it.' },
  ],
  bloat: [
    { part: 'breath', mark: 'fastBreath', title: 'Breathing hard', see: 'Short, hard breaths: the swollen belly presses on her lungs.', reading: { kind: 'rate', value: 58, normal: [10, 30], unit: 'breaths a minute' } },
    { part: 'belly', mark: 'bloat', title: 'Her left side swollen like a drum', see: 'High on the left, the belly is round and tight. Tap it: it sounds hollow, like a drum.' },
    { part: 'hooves', mark: 'kick', title: 'She kicks at her belly', see: 'She lifts a back leg and kicks up at her side, and cannot settle.' },
  ],
  heat: [
    { part: 'mouth', mark: 'pant', title: 'Panting with her mouth open', see: 'Mouth open, tongue out, drool: she breathes fast to lose heat.' },
    { part: 'milk', mark: 'milkLow', title: 'Less milk', see: 'A hot cow eats less, so she makes less milk.', reading: { kind: 'amount', value: milkLeft('heat'), usual: LIFE.milk.perCow, unit: 'L of milk' } },
    { part: 'stance', mark: 'shade', title: 'Standing in the only shade', see: 'The sun beats on the pen; she will not leave the one patch of shade.' },
    { part: 'water', mark: 'drinkMore', title: 'Drinking more', see: 'She keeps going back to the trough.', reading: { kind: 'amount', value: 80, usual: 50, unit: 'L of water a day' } },
  ],
  leak: [
    { part: 'water', mark: 'mud', title: 'Mud all round the trough', see: 'The ground is wet all round, and the float valve hisses and drips day and night.' },
    { part: 'tank', mark: 'tankDrop', title: 'The tank drops too fast', see: 'It falls faster than the cows drink: water is running to waste.', reading: { kind: 'amount', value: 400, usual: 100, unit: 'L gone from the tank a day' } },
  ],
  newcastle: [
    { part: 'beak', mark: 'gasp', at: { x: 208, y: 94 }, title: 'Gasping and coughing', see: 'Beaks open, necks stretched, a cough and a rattle from the flock.' },
    { part: 'neck', mark: 'twist', title: 'A twisted neck', see: 'One hen holds her head upside down and walks in circles.' },
    { part: 'droppings', mark: 'greenDrop', title: 'Green, watery droppings', see: 'Bright green and runny, all over the floor.' },
    { part: 'perch', mark: 'dead', title: 'Dead on the perch in the morning', see: 'One did not come down at dawn; she is cold and stiff on the perch.' },
  ],
  cocci: [
    { part: 'comb', mark: 'pale', at: { x: 192, y: 84 }, title: 'A pale comb', see: 'Pink, not red: she has lost blood.' },
    { part: 'eye', mark: 'halfShut', at: { x: 190, y: 103 }, title: 'Eyes half shut', see: 'Dull and drowsy, she hardly looks up.' },
    { part: 'feathers', mark: 'ruffled', title: 'Huddled, feathers ruffled', see: 'Hunched in a corner, puffed up, standing still in the day.' },
    { part: 'droppings', mark: 'bloodDrop', title: 'Bloody droppings', see: 'Red streaks and blood in the droppings on the wet litter.' },
  ],
  mites: [
    { part: 'comb', mark: 'pale', at: { x: 232, y: 114 }, title: 'A pale comb', see: 'Pink, not red: something is feeding on her blood.' },
    { part: 'feathers', mark: 'pecking', title: 'Pecking at her feathers', see: 'She keeps picking and pulling at her own feathers.' },
    { part: 'vent', mark: 'bareVent', title: 'Bare patches round the vent', see: 'Lift the tail feathers: the skin is bare, red and scabby.' },
    { part: 'perch', mark: 'specks', title: 'Red specks on the perch at night', see: 'With a torch after dark: tiny red dots moving on the perch.' },
  ],
  eggEating: [
    { part: 'beak', mark: 'eggBeak', title: 'Egg on her beak', see: 'Yolk dried on her beak and face.' },
    { part: 'nest', mark: 'brokenEggs', title: 'Broken shells and yolk in the nest', see: 'Pecked shells and yolk smeared on the straw.' },
    { part: 'eggs', mark: 'fewerEggs', title: 'Fewer eggs every day', see: 'Fewer reach the tray each day.', reading: { kind: 'days', what: 'eggs' } },
  ],
};

/** One stop of the examination: a part, and what it shows. */
export interface Step {
  part: Part;
  findings: Finding[];
}

/** The examination of a problem: the parts with a finding, in the standard order. */
export function stepsOf(id: IssueId): Step[] {
  const g = issueOf(id).group;
  const f = FINDINGS[id];
  return PARTS[g]
    .filter(p => f.some(x => x.part === p.id))
    .map(p => {
      const findings = f.filter(x => x.part === p.id);
      const moved = findings.find(x => x.at)?.at;
      return { part: moved ? { ...p, at: { ...p.at, ...moved } } : p, findings };
    });
}

/** Where each part shows on this problem's animal (its usual place, or where the pose moved it). */
export function spotsOf(id: IssueId | null): Partial<Record<PartId, { x: number; y: number }>> {
  const out: Partial<Record<PartId, { x: number; y: number }>> = {};
  for (const f of id ? FINDINGS[id] : []) if (f.at) out[f.part] = f.at;
  return out;
}

/** The marks to draw for a problem. */
export const marksOf = (id: IssueId | null) => new Set<Mark>(id ? FINDINGS[id].map(f => f.mark) : []);

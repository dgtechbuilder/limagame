import { PARTS } from '../livestock/exam';
import { COW_EARLY, HEN_EARLY } from './early';
import type { SubjectDef, SubjectId } from './types';

/* Everything a full check covers: its parts (where the camera looks, what healthy looks like), the sections they are
   checked in, and its early signs. The animals' parts are in src/livestock/exam.ts PARTS. */

export const SUBJECTS: Partial<Record<SubjectId, SubjectDef>> = {
  cow: {
    id: 'cow',
    name: 'cow',
    title: 'Examine the cow',
    rail: 'Check the cow',
    whole: 'Whole cow',
    ground: '#f6dcae',
    group: 'cows',
    parts: PARTS.cows,
    sections: [
      { label: 'Head', parts: ['eyes', 'nose', 'mouth', 'ears'] },
      { label: 'Body', parts: ['breath', 'belly', 'temp', 'stance'] },
      { label: 'Udder, legs & dung', parts: ['udder', 'milk', 'hooves', 'dung'] },
      { label: 'Feed & water', parts: ['feed', 'water', 'tank'] },
    ],
    early: COW_EARLY,
  },
  hen: {
    id: 'hen',
    name: 'hens',
    title: 'Examine the hens',
    rail: 'Check the hens',
    whole: 'Whole coop',
    ground: '#d8b07a',
    group: 'hens',
    parts: PARTS.hens,
    sections: [
      { label: 'Head', parts: ['comb', 'eye', 'beak', 'neck'] },
      { label: 'Body & legs', parts: ['feathers', 'vent', 'feet'] },
      { label: 'The coop', parts: ['droppings', 'perch', 'nest', 'eggs'] },
    ],
    early: HEN_EARLY,
  },
};

export const subjectOf = (id: SubjectId) => SUBJECTS[id]!;
export const subjectFor = (group: 'cows' | 'hens'): SubjectId => (group === 'cows' ? 'cow' : 'hen');

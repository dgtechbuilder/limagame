import type { Group, IssueId } from '../livestock/config';

/* The things a farmer checks all over, part by part: the animals, and (src/inspect/subjects.ts) whatever else on the
   farm a routine check keeps from going wrong. Each has its parts on a 480 × 270 drawing, grouped in sections in the
   order they are checked, and a pool of early signs: small things a full check finds before they grow into a
   problem, each with a quick fix that can be done now or planned for a later day. */

export type SubjectId = 'cow' | 'hen' | 'plant' | 'tractor' | 'farm' | 'water' | 'power';

export interface Spot {
  x: number;
  y: number;
  /** how close the camera comes (1: the whole scene) */
  z: number;
}

export interface Part {
  id: string;
  label: string;
  /** where the camera looks on the 480 × 270 scene */
  at: Spot;
  /** what a healthy part shows */
  normal: string;
}

/** A group of parts checked together (the head, the body…), in the order they are checked. */
export interface Section {
  label: string;
  parts: string[];
}

/** A small thing a full check finds early, before it becomes a problem. */
export interface Early {
  id: string;
  part: string;
  /** what you see, in a few words */
  title: string;
  /** a line more */
  see: string;
  /** what happens if it is left */
  risk: string;
  /** the animal problem it grows into: dealt with, that problem keeps away for a few days */
  leads?: IssueId;
  fix: {
    /** the button: what you do */
    label: string;
    /** over the timer while it is done */
    doing: string;
    /** stored money */
    cost: number;
    /** seconds it takes */
    secs: number;
  };
}

export interface SubjectDef {
  id: SubjectId;
  /** the cow, the hens, the maize plant… */
  name: string;
  /** Examine the cow */
  title: string;
  /** the list's heading: Check the cow */
  rail: string;
  /** the button back to the whole view: Whole cow */
  whole: string;
  /** the colour behind the drawing, before it loads */
  ground: string;
  parts: Part[];
  sections: Section[];
  early: Early[];
  /** the animals checked (their problems are the red signs) */
  group?: Group;
}

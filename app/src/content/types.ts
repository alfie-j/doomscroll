export type Subject =
  | 'maths' | 'physics' | 'philo' | 'lit' | 'history' | 'psych' | 'stats' | 'cs' | 'econ' | 'bio';

export type Format =
  | 'hook' | 'explain' | 'story' | 'reallife' | 'quiz' | 'predict' | 'myth' | 'meme' | 'interactive';

/** 0 = general interest, 1–3 = undergraduate year, 4 = masters */
export type Level = 0 | 1 | 2 | 3 | 4;

export type Widget = 'secant' | 'riemann' | 'taylor' | 'compound' | 'birthday';

export interface Card {
  id: string;
  subject: Subject;
  format: Format;
  /** The hook. Shown huge. */
  title: string;
  /** Body lines. `*word*` = highlight. A line starting with `$ ` renders as an equation. */
  lines?: string[];
  /** Open loop at the bottom of every card. */
  cliff: string;
  /** Hand-rated hook strength, 1–5. 4–5 are "bangers" used for pacing. */
  hook: 1 | 2 | 3 | 4 | 5;
  /** Chain (unit) this card belongs to, and its position. */
  chain?: string;
  order?: number;
  /** Cards reached by swiping right on this one. */
  deeper?: string[];
  /** Only reachable through `deeper`, never served on its own. */
  depthOnly?: boolean;
  legendary?: boolean;
  /** Spaced-repetition prompt: [question, answer]. */
  recall?: [string, string];
  /** quiz / predict */
  options?: string[];
  answer?: number;
  reveal?: string[];
  /** myth: is the statement in `title` true? */
  truth?: boolean;
  /** meme: [who, says] pairs */
  panels?: [string, string][];
  widget?: Widget;
  scene?: 'moon';
}

export interface Chain {
  id: string;
  name: string;
  subject: Subject;
  level: Level;
  course?: CourseId;
  /** Chain that should be started before this one unlocks. */
  after?: string;
}

export type CourseId = 'calc1' | 'calc2' | 'calc3' | 'phys1' | 'phys2' | 'phys3';

export interface Course {
  id: CourseId;
  name: string;
  short: string;
  subject: Subject;
}

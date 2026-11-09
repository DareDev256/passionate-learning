// Today's three quests and the chest. Pure: the save in, the save out.
import { type Save, rollQuest } from "./save";

/** Tokens in the daily chest. */
export const CHEST_TOKENS = 5;

export interface QuestState {
  /** Finish 1 round. Also the floor: this alone counts as a whole day. */
  round: boolean;
  /** Clear a review. Waived on a day when nothing was due. */
  review: boolean;
  /** Play a second round. */
  second: boolean;
  /** How many of the three are done. */
  done: number;
  allDone: boolean;
  chestOpened: boolean;
}

/** Quests for `now`: a stored day that is not today counts as nothing done. */
export function questsOf(save: Save, now = new Date()): QuestState {
  const q = rollQuest(save, now).quests;
  const round = q.rounds >= 1, review = q.reviewed, second = q.rounds >= 2;
  const done = [round, review, second].filter(Boolean).length;
  return { round, review, second, done, allDone: done === 3, chestOpened: q.chest };
}

/** Opens the chest: +CHEST_TOKENS, once a day, only when all three quests are done. Anything else returns the save unchanged. */
export function openChest(save: Save, now = new Date()): Save {
  const rolled = rollQuest(save, now);
  const st = questsOf(rolled, now);
  if (!st.allDone || st.chestOpened) return save;
  return { ...rolled, tokens: rolled.tokens + CHEST_TOKENS, quests: { ...rolled.quests, chest: true } };
}

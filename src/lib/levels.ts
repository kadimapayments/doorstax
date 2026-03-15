/**
 * DoorStax PM Level System
 *
 * Levels are based on total "doors" (units) across all properties.
 * Purely cosmetic — used to gamify portfolio growth.
 */

export interface Level {
  min: number;
  max: number;
  title: string;
  emoji: string;
}

export const LEVELS: Level[] = [
  { min: 0, max: 24, title: "Starter", emoji: "🌱" },
  { min: 25, max: 99, title: "Rising", emoji: "📈" },
  { min: 100, max: 249, title: "Hustler", emoji: "💪" },
  { min: 250, max: 499, title: "Stacker", emoji: "🏗️" },
  { min: 500, max: 999, title: "Boss", emoji: "🔥" },
  { min: 1000, max: 2499, title: "Mogul", emoji: "👑" },
  { min: 2500, max: Infinity, title: "Empire", emoji: "🏰" },
];

export function getLevel(doors: number) {
  const level = LEVELS.find((l) => doors >= l.min && doors <= l.max) || LEVELS[0];
  const levelIndex = LEVELS.indexOf(level);
  const nextLevel = LEVELS[levelIndex + 1];

  let pct = 100;
  if (nextLevel) {
    const range = level.max - level.min + 1;
    const progress = doors - level.min;
    pct = Math.min(Math.round((progress / range) * 100), 100);
  }

  return { ...level, index: levelIndex + 1, pct, nextLevel };
}

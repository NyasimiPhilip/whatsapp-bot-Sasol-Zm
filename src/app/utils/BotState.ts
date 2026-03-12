/**
 * Shared bot state — tracks whether the bot is paused.
 * Kept in its own module to avoid circular imports between
 * commands/index.ts and the individual command files.
 */
export const botState = {
  isPaused: false,
};

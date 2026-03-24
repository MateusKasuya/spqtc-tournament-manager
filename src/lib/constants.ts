export const APP_NAME = "SPQTC Tournament Manager";

export const TOURNAMENT_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  FINISHED: "finished",
  CANCELLED: "cancelled",
} as const;

export const PARTICIPANT_STATUS = {
  REGISTERED: "registered",
  PLAYING: "playing",
  ELIMINATED: "eliminated",
  FINISHED: "finished",
} as const;

export const TRANSACTION_TYPE = {
  BUY_IN: "buy_in",
  REBUY: "rebuy",
  ADDON: "addon",
  PRIZE: "prize",
} as const;

export const USER_ROLE = {
  ADMIN: "admin",
  PLAYER: "player",
} as const;

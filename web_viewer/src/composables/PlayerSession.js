import { inject } from 'vue'
export const PLAYER_SESSION_KEY = Symbol('player-session')
export function usePlayerSession() { return inject(PLAYER_SESSION_KEY) }

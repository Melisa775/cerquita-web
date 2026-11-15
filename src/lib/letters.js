// Must match app/games/toolate.py in the backend
export const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')
export const DEFAULT_OFF = ['K', 'Ñ', 'Q', 'W', 'X', 'Y', 'Z']
export const DEFAULT_LETTERS = ALPHABET.filter((l) => !DEFAULT_OFF.includes(l))
export const MIN_LETTERS = 5
export const TURN_CHOICES = [5, 10, 15, 20]

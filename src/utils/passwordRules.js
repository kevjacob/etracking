/**
 * Password rules: at least 8 characters, at least 1 uppercase, 1 symbol, 1 number.
 */
const MIN_LENGTH = 8
const MAX_LENGTH = 64
const HAS_UPPER = /[A-Z]/
const HAS_SYMBOL = /[^A-Za-z0-9]/
const HAS_NUMBER = /[0-9]/

export function validatePassword(password) {
  if (!password || password.length < MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_LENGTH} characters.` }
  }
  if (password.length > MAX_LENGTH) {
    return { ok: false, message: `Password must be no more than ${MAX_LENGTH} characters.` }
  }
  if (!HAS_UPPER.test(password)) {
    return { ok: false, message: 'Password must contain at least one uppercase letter.' }
  }
  if (!HAS_SYMBOL.test(password)) {
    return { ok: false, message: 'Password must contain at least one symbol.' }
  }
  if (!HAS_NUMBER.test(password)) {
    return { ok: false, message: 'Password must contain at least one number.' }
  }
  return { ok: true }
}

export function getPasswordHint() {
  return `At least ${MIN_LENGTH} characters, with at least 1 uppercase letter, 1 symbol, and 1 number.`
}

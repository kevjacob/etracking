export function isUniqueViolation(error) {
  return error?.code === '23505'
}

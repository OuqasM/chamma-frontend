/**
 * Moroccan phone numbers, in one form.
 *
 * The API has the same rules in PHP (`App\Support\PhoneNumber`), and this is
 * the browser's copy of them: the panel normalises a number *before* it is
 * used for anything — before it is looked up, before it is sent — so the
 * number the owner typed, the customer the panel finds and the order that
 * lands in the database are all the same handset.
 *
 * "0612345678", "06 12 34 56 78", "+212 6 12 34 56 78", "00212612345678" and
 * "612345678" are one number.
 *
 * **The canonical form is ten characters: "0612345678".** It is how a Moroccan
 * number is written, and how it fits in a column without being cut short. The
 * country code is not part of it.
 */

/**
 * The national digits of what was typed: "612" for "0612", "612345678" for
 * "+212 6 12 34 56 78".
 *
 * A partial number is allowed — this is not a validity check, it is the shape
 * a number has while somebody is still typing it. `normalisePhone()` is what
 * decides whether the number is complete.
 *
 * The leading zero is optional: a number read off a card or copied out of a
 * message often arrives without it.
 */
export function nationalDigits(value) {
  const digits = String(value ?? '').replace(/\D+/g, '')
  if (!digits) return null

  let national = digits
  if (national.startsWith('00212')) national = national.slice(5)
  else if (national.startsWith('212')) national = national.slice(3)
  else if (national.startsWith('0')) national = national.slice(1)

  // 5-7 prefix, then up to eight more digits.
  if (!/^[5-7]\d{0,8}$/.test(national)) return null

  return national
}

/**
 * `0612345678`, or null when the number is not a complete Moroccan one.
 */
export function normalisePhone(value) {
  const national = nationalDigits(value)
  if (!national || national.length !== 9) return null
  return `0${national}`
}

/**
 * Whether the number is a complete Moroccan one: 06, 07 or 05, with or
 * without the country code.
 */
export function isMoroccanPhone(value) {
  return normalisePhone(value) !== null
}

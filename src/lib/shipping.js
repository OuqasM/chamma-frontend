/**
 * Delivery fees, defensively.
 *
 * The API sends a numeric `fee` per city and a numeric `shipping_cost` per
 * quote. Both are read with a bare `> 0` comparison everywhere else in the app,
 * and that comparison has a failure mode worth naming: `undefined > 0` is
 * `false`, so a payload that is *missing* the fee — an older API, a partial
 * response, a proxy that rewrites the body — falls through to the "free
 * delivery" branch and tells every shopper in the country their order ships for
 * nothing.
 *
 * A missing fee is not a zero fee. Zero is a fact the store asserts; a missing
 * field is the absence of one, and the only honest response to it is to say
 * nothing rather than to promise something. Everything that renders a fee goes
 * through here so that decision is made once.
 */

/** A fee the server actually sent as a number. */
export const knownFee = (fee) => typeof fee === 'number' && Number.isFinite(fee)

/**
 * Delivery the shopper will pay nothing for — only ever a real zero.
 *
 * Distinct from "no idea yet", which is what an absent fee means.
 */
export const isFreeDelivery = (fee) => knownFee(fee) && fee === 0

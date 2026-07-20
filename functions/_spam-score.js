// Spam scoring for the public enquiry form.
//
// Why this exists: the form already had a honeypot, and a bot walked straight
// past it on 20 Jul 2026. That submission created a Brevo contact, filed itself
// into the Wedding list, and triggered a confirmation email that HARD BOUNCED.
// Hard bounces cost sending reputation, and junk in the enquiry lists makes the
// whole category structure useless.
//
// The design rule here matters more than the rules below: a false positive
// costs a real booking, so this NEVER discards anything. A high score only
// stops the two actions that hurt (writing to the CRM, and auto-replying to an
// address that may not exist). The team notification always goes out either
// way, tagged, so a real enquiry can never be lost to a scoring mistake.

// Contact-swap solicitation. This is the exact shape of the 20 Jul submission:
// the sender wants the conversation moved to a chat app it controls.
const CHAT_SOLICITATION = /\b(t\.me|wa\.me|telegram|whatsapp|viber|skype:)\b/i;

// Cold-outreach boilerplate. These phrases are near-universal in form spam and
// vanishingly rare in someone booking a performer for their own event.
const OUTREACH_PHRASES = [
  /while\s+(looking|browsing|searching)\s+through/i,
  /\b(i|we)\s+(discovered|came\s+across|stumbled\s+upon)\s+your\s+(site|website)/i,
  /we\s+(provide|offer)\s+a\s+(solution|service|system)/i,
  /\b(businesses|companies)\s+often\s+use\b/i,
  /contact\s+(pages|forms)\s+to\s+find\b/i,
  /\bfeel\s+free\s+to\s+contact\s+us\b/i,
  /\b(seo|backlink|link.building|web\s*design|crypto|forex|casino)\b/i,
  /\bwe\s+only\s+use\s+chat\b/i,
];

function urlCount(text) {
  return (text.match(/https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}/gi) || []).length;
}

// A non-Latin script rule used to live here and was REMOVED on 21 Jul 2026.
// It scored zero against the real spam, which trips six other rules without it,
// and it pushed a plausible enquiry (a Chinese-speaking couple booking a
// wedding, with a link to their venue) to exactly the spam threshold. A rule
// that catches nothing real and penalises customers for the language they
// write in is all cost. Australia is multilingual; the form is not English-only.

/**
 * Score a submission. Higher means more likely to be junk.
 * Returns { score, reasons, isSpam }.
 *
 * The threshold is deliberately high. Every rule below had to fire on the real
 * 20 Jul spam and stay silent on the sample legitimate enquiries in
 * scripts/test-spam-score.mjs.
 */
export function scoreSubmission(fields) {
  const { name = "", email = "", phone = "", eventType = "", message = "" } = fields;
  const text = `${name} ${message}`;
  const reasons = [];
  let score = 0;

  if (CHAT_SOLICITATION.test(text)) {
    score += 5;
    reasons.push("links to a chat app (telegram/whatsapp/viber/skype)");
  }

  const matchedPhrases = OUTREACH_PHRASES.filter((re) => re.test(text)).length;
  if (matchedPhrases > 0) {
    score += Math.min(matchedPhrases * 2, 6);
    reasons.push(`${matchedPhrases} cold-outreach phrase(s)`);
  }

  const urls = urlCount(message);
  if (urls >= 1) {
    score += Math.min(urls * 2, 4);
    reasons.push(`${urls} link(s) in the message`);
  }

  // A real enquirer picks their event from the dropdown and usually leaves a
  // phone number. Spam posts the form without either. On its own this is weak,
  // so it scores low and only matters alongside something else.
  if (!eventType && !phone) {
    score += 1;
    reasons.push("no event type and no phone");
  }

  // Someone greeting the site by its own domain is writing to a list, not to a
  // person who might play at their wedding.
  if (/\bslayentertainment\.(co|com)\b/i.test(message)) {
    score += 3;
    reasons.push("addresses the site by its own domain");
  }

  return { score, reasons, isSpam: score >= 6 };
}

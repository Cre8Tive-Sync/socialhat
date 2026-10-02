/**
 * What the built-in answers should recognise — `node scripts/test-fallback.mjs`.
 *
 * The fallback only runs when every model is down, so a gap in it is invisible
 * until the worst moment. Each row is something a visitor would plausibly type
 * and the topic it has to land on. The plural and word-ending rows are here
 * because the table once matched "website" but not "websites", and listed
 * "enquir" in a way that could never match "enquiry".
 *
 * No network, no keys. Exits non-zero on any miss.
 */

import { TOPICS, builtinReply } from '../api/fallback.js'

const topicOf = (text) => TOPICS.find((t) => t.match.test(text.toLowerCase()))?.name ?? null

const cases = [
  // [what they typed, topic it should land on]
  ['Do you build websites?', 'website'],
  ['I need a website', 'website'],
  ['can you make landing pages', 'website'],
  ['we sell through online stores', 'website'],
  ["I'd like to make an enquiry", 'form'],
  ['I want to enquire about something', 'form'],
  ['can I get some quotes', 'form'],
  ['I want to make a booking', 'form'],
  ['Can screens in my cafe earn money?', 'host'],
  ['can I earn from a screen in my shop', 'host'],
  ['do you run campaigns on your screens', 'advertise'],
  ['I want to advertise on screens', 'advertise'],
  ['how do the displays work', 'signage'],
  ['tv screens', 'signage'],
  ['I have complaints about my invoices', 'human'],
  ['I want refunds', 'human'],
  ['what are your prices', 'price'],
  ['do you do photo shoots', 'content'],
  ['we need more followers', 'social'],
  ['can you help us with rankings', 'seo'],
  ['what services do you offer', 'services'],
  ['do you do drones', 'drone'],
  ['hello', 'greeting'],
  // Things that must NOT be caught by a broader pattern.
  ['I use facebook a lot', 'social'], // not "book" -> form
  ['blorp zzz', null],
]

let failed = 0
for (const [text, want] of cases) {
  const got = topicOf(text)
  if (got !== want) {
    failed += 1
    console.log(`  FAIL  "${text}"  wanted ${want}, got ${got}`)
  }
}

// The form-opening path: "yes" to the offer opens the form on the right path.
const opened = builtinReply([
  { role: 'user', content: 'Do you build websites?' },
  { role: 'assistant', content: 'Yes. Want me to open the enquiry form for you?' },
  { role: 'user', content: 'yes please' },
])
if (opened.action?.path !== 'website') {
  failed += 1
  console.log(`  FAIL  "yes" after a websites question should open the website path, got ${opened.action?.path}`)
}

console.log(failed ? `${failed} of ${cases.length + 1} failed` : `All ${cases.length + 1} passed`)
process.exit(failed ? 1 : 0)

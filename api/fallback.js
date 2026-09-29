/**
 * HatBot's last resort: answers with no model at all.
 *
 * Every provider in api/chat.js is a free tier, and free tiers run out — a
 * daily cap, an overloaded model, a key that has been revoked. When all of them
 * fail, the visitor still gets a real answer from here instead of an apology.
 *
 * It is keyword matching over the same facts as api/knowledge.js, so it cannot
 * be rate-limited and cannot make anything up. It is deliberately plain: it
 * answers the common questions, and for everything else it hands over to the
 * form, the phone and the inbox — which is what a person would do anyway.
 */

import { PATHS } from './knowledge.js'

const CONTACT = 'You can reach the team on 08 9285 0811 or info@socialhat.com.au (Monday to Friday, 8am to 4pm).'
const OFFER_FORM = 'Want me to open the enquiry form for you?'

/**
 * Checked in order; the first match wins. More specific topics sit above the
 * general ones they overlap with — "screen in my shop" is a host question
 * before it is a signage question.
 */
const TOPICS = [
  {
    name: 'human',
    match: /\b(complain|complaint|invoice|refund|bill(ing)?|existing (job|project)|my (job|project|account)|speak to (a|someone)|real person|human)\b/,
    reply: () => `That's one for the team directly. ${CONTACT}`,
  },
  {
    name: 'form',
    match: /\b(form|quote|enquir|inquir|get in touch|call me|contact me|book|start a project)\b/,
    path: (text) => guessPath(text) ?? 'marketing',
    reply: () => "I've opened the enquiry form for you — pick what you're after and the team will come back to you.",
    action: true,
  },
  {
    name: 'host',
    match: /\b(earn|income|revenue|make money|host|my (shop|cafe|café|venue|clinic|gym|salon|store|business))\b.*\b(screen|sign|display|tv)|\b(screen|sign|display|tv)\b.*\b(earn|income|revenue|make money|my (shop|cafe|café|venue|clinic|gym|salon|store))\b/,
    path: () => 'host',
    reply: () =>
      "Yes — that's SocialHat's screen host program. They install a screen in your venue, manage the content remotely, and you earn from the advertising on it while also promoting your own deals. You don't have to update anything yourself. " +
      OFFER_FORM,
  },
  {
    name: 'advertise',
    match: /\b(advertis\w*|campaign|promote)\b.*\b(screen|sign\w*|display)|\b(screen|sign\w*|display)\b.*\b(advertis\w*|campaign|promote)\b/,
    path: () => 'advertise',
    reply: () =>
      'SocialHat runs digital screens in venues across Perth, and you can put your campaign on them — choosing the suburbs and audience you want to reach and how long it runs. If your artwork is not ready, they can make it too. ' +
      OFFER_FORM,
  },
  {
    name: 'signage',
    match: /\b(screen|screens|signage|digital sign|display|tv)\b/,
    reply: () =>
      "SocialHat's digital signage works two ways. If you own a venue, they install a screen and you earn from the ads on it. If you want to advertise, your campaign plays on their screens across Perth. Which one are you after?",
  },
  {
    name: 'price',
    match: /\b(price|prices|pricing|cost|costs|how much|budget|rate|rates|cheap|expensive|fee|fees)\b/,
    reply: () =>
      "SocialHat quotes per job rather than having set prices, because every project is a different size. The quickest way to a real number is the enquiry form — it takes a minute. " +
      OFFER_FORM,
  },
  {
    name: 'website',
    match: /\b(website|web site|site|web design|web dev\w*|landing page|redesign|wordpress|shopify|online store)\b/,
    path: () => 'website',
    reply: () =>
      'Yes, SocialHat builds websites — new builds, redesigns, and rescues of sites that have stopped working. Everything is mobile-first and built to rank on Google. ' +
      OFFER_FORM,
  },
  {
    name: 'ads',
    match: /\b(google ads|ads|adwords|ppc|advertising|advertise|paid)\b/,
    path: () => 'marketing',
    reply: () =>
      "Yes — SocialHat runs Google Ads and other advertising campaigns, and they keep a close eye on the numbers daily rather than monthly. " +
      OFFER_FORM,
  },
  {
    name: 'drone',
    match: /\b(drone|drones|aerial)\b/,
    path: () => 'marketing',
    reply: () =>
      "Yes — SocialHat's drone operators are CASA-licensed and insured, shooting 4K aerial video and stills. They handle the permissions too. " +
      OFFER_FORM,
  },
  {
    name: 'content',
    match: /\b(video|videos|photo|photos|photography|photographer|shoot|filming|film|content|reels?|tiktok)\b/,
    path: () => 'marketing',
    reply: () =>
      'Yes — SocialHat makes video and photography built for social media, from the shoot through to the final edit. ' + OFFER_FORM,
  },
  {
    name: 'social',
    match: /\b(social media|social|instagram|facebook|linkedin|followers|posting|posts)\b/,
    path: () => 'marketing',
    reply: () =>
      'Yes — SocialHat manages social media: strategy, setting up accounts, and the day-to-day running across platforms. ' + OFFER_FORM,
  },
  {
    name: 'seo',
    match: /\b(seo|search engine|rank|ranking|copywriting|copy)\b/,
    path: () => 'marketing',
    reply: () => 'Yes — SocialHat does SEO and copywriting, usually alongside a website or a campaign. ' + OFFER_FORM,
  },
  {
    name: 'contact',
    match: /\b(phone|call|email|address|where are you|located|location|hours|open|office|number)\b/,
    reply: () => `SocialHat is at 41A Kirwan Street, Floreat, WA. ${CONTACT}`,
  },
  {
    name: 'services',
    match: /\b(what do you do|services|what can you|help me with|offer)\b/,
    reply: () =>
      'SocialHat is a Perth marketing agency: websites, advertising campaigns, video and photo content, social media management, digital signage, drone filming, and SEO. What are you working on?',
  },
  {
    name: 'who',
    match: /\b(who are you|are you (a )?(bot|robot|human|real|person|ai))\b/,
    reply: () => "I'm HatBot, SocialHat's site assistant. A person from the team picks things up in business hours.",
  },
  {
    name: 'greeting',
    match: /^\s*(hi|hello|hey|g'?day|good (morning|afternoon|evening)|yo|howdy)\b/,
    reply: () =>
      "Hi! I'm HatBot. SocialHat does websites, ads, video and photo, social media, and digital screens across Perth. What can I help you with?",
  },
  {
    name: 'thanks',
    match: /^\s*(thanks|thank you|cheers|ta|great|perfect|awesome)\b/,
    reply: () => `No worries! ${CONTACT}`,
  },
]

const YES = /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|go on|go ahead|do it|sounds good)\b/

function guessPath(text) {
  for (const topic of TOPICS) {
    if (topic.path && topic.name !== 'form' && topic.match.test(text)) return topic.path(text)
  }
  return null
}

/**
 * @param {{role: string, content: string}[]} messages  the sanitised history
 * @returns {{ text: string, action?: { name: 'open_enquiry_form', path: string } }}
 */
export function builtinReply(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const text = (lastUser?.content ?? '').toLowerCase()
  const lastBot = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''

  // "Yes" to the form offer: open it on the path the conversation was about.
  if (YES.test(text) && lastBot.includes('open the enquiry form')) {
    const earlier = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase()).join(' ')
    const path = guessPath(earlier) ?? 'marketing'
    return {
      text: "Done — I've opened the enquiry form with that already selected. Fill it in and the team will come back to you.",
      action: { name: 'open_enquiry_form', path },
    }
  }

  for (const topic of TOPICS) {
    if (!topic.match.test(text)) continue
    const reply = { text: topic.reply(text) }
    if (topic.action) {
      const path = topic.path(text)
      if (PATHS.includes(path)) reply.action = { name: 'open_enquiry_form', path }
    }
    return reply
  }

  return {
    text:
      "I might not have understood that one. SocialHat does websites, advertising, video and photo, social media, and digital screens — tell me which you're after, or " +
      CONTACT.charAt(0).toLowerCase() +
      CONTACT.slice(1),
  }
}

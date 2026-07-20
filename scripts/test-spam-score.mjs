// Binary pass/fail check for functions/spam-score.js.
// Run: node scripts/test-spam-score.mjs
//
// The first case is the REAL submission that got through the honeypot on
// 20 Jul 2026, copied verbatim out of the Brevo contact record. Every other
// case is a plausible legitimate enquiry. A legitimate enquiry scoring as spam
// is the expensive failure here, so those are weighted as hard failures too.

import { scoreSubmission } from "../functions/_spam-score.js";

const cases = [
  {
    label: "REAL spam, 20 Jul 2026, verbatim from Brevo",
    expectSpam: true,
    fields: {
      name: "Davidfam",
      email: "no.reply.stephanbrown@gmail.com",
      phone: "",
      eventType: "Wedding",
      message: `Greetings! slayentertainment.co,
While looking through websites I discovered your site.
We provide a solution that simplifies communication with website owners.
Businesses often use contact pages to find new partners.


Feel free to contact us if you want more information.

Have a wonderful day.
Contact us.
Telegram - https://t.me/FeedbackFormEU
WhatsApp - +375259112693
WhatsApp  https://wa.me/+375259112693
We only use chat for communication.`,
    },
  },
  {
    label: "SEO cold outreach",
    expectSpam: true,
    fields: {
      name: "Marketing Team",
      email: "seo@example-agency.net",
      phone: "",
      eventType: "",
      message:
        "Hi, while browsing through websites I came across your site. We provide a solution for backlink building and SEO that ranks you first. Feel free to contact us.",
    },
  },
  {
    label: "Legit wedding enquiry, full detail",
    expectSpam: false,
    fields: {
      name: "Sarah Mitchell",
      email: "sarah.mitchell@gmail.com",
      phone: "0412 555 902",
      eventType: "Wedding",
      message:
        "Hi! We're getting married in March next year at a vineyard just outside Noosa and would love dancers for the reception. About 90 guests. Could you send through your packages and pricing?",
    },
  },
  {
    label: "Legit, terse, no phone and no event type",
    expectSpam: false,
    fields: {
      name: "Jen",
      email: "jen.roberts@outlook.com",
      phone: "",
      eventType: "",
      message: "Hi, do you do hens parties on the Gold Coast? What does it cost?",
    },
  },
  {
    label: "Legit corporate, mentions their own company website",
    expectSpam: false,
    fields: {
      name: "Daniel Okafor",
      email: "d.okafor@brightpath.com.au",
      phone: "0466 200 118",
      eventType: "Corporate event or gala",
      message:
        "We're planning our end of year gala for around 200 staff. Our company site is https://brightpath.com.au if you want context on the brand. Are you available 12 December?",
    },
  },
  {
    label: "Legit brand activation, mentions finding the site online",
    expectSpam: false,
    fields: {
      name: "Priya Raman",
      email: "priya@thelabelco.com.au",
      phone: "0401 887 342",
      eventType: "Brand activation",
      message:
        "Found your site through Instagram and love the look. We're launching a new range in Brisbane in September and want performers for the launch night.",
    },
  },
];

let failures = 0;
for (const c of cases) {
  const { score, reasons, isSpam } = scoreSubmission(c.fields);
  const ok = isSpam === c.expectSpam;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  score=${String(score).padStart(2)}  expect=${
      c.expectSpam ? "spam " : "legit"
    }  got=${isSpam ? "spam " : "legit"}  ${c.label}`
  );
  if (reasons.length) console.log(`        reasons: ${reasons.join("; ")}`);
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exit(failures === 0 ? 0 : 1);

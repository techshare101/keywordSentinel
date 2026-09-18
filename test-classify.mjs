import { readFileSync } from 'fs';

function getDomain(url) {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, '');
  } catch { return url; }
}

function isHedged(answer) {
  const lower = answer.toLowerCase();
  return [
    "i don't have", "i don't see", "not available", "cannot find",
    "i'm not sure", "it appears", "may be", "might be", "could be",
    "limited information", "no specific", "unclear"
  ].some(p => lower.includes(p));
}

function classifyClaim(aiAnswer, siteFact, question, citations, clinicDomain, targetService) {
  const qLower = question.toLowerCase();
  const aiLower = aiAnswer.toLowerCase();
  const officialCitations = citations.filter(c => {
    const domain = getDomain(c);
    return domain === clinicDomain || domain.includes(clinicDomain);
  });
  const foreignCitations = citations.filter(c => {
    const domain = getDomain(c);
    return domain && domain !== clinicDomain && !domain.includes(clinicDomain);
  });
  const hasOfficialCitation = officialCitations.length > 0;
  const hasForeignCitation = foreignCitations.length > 0 && citations.length > 0;
  const foreignSourceOnly = hasForeignCitation && !hasOfficialCitation;

  if (isHedged(aiAnswer)) return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  if (!siteFact) return foreignSourceOnly ? 'foreign_source' : 'unsupported';
  const siteLower = siteFact.toLowerCase();

  if (qLower.includes('hour')) {
    const aiHours = aiLower.match(/\d{1,2}[:.]\d{2}\s*[ap]m?/g) || [];
    const siteHours = siteLower.match(/\d{1,2}[:.]\d{2}\s*[ap]m?/g) || [];
    if (aiHours.length > 0 && siteHours.length > 0) {
      const aiSet = new Set(aiHours.map(h => h.replace(/\s+/g, '')));
      const siteSet = new Set(siteHours.map(h => h.replace(/\s+/g, '')));
      const hasMismatch = Array.from(aiSet).some(h => !siteSet.has(h));
      if (hasMismatch) return foreignSourceOnly ? 'foreign_source' : 'contradiction';
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  }

  if (qLower.includes('phone') || qLower.includes('address') || qLower.includes('book')) {
    const aiPhones = (aiAnswer.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).map(p => p.replace(/\D/g, ''));
    const sitePhones = (siteFact.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).map(p => p.replace(/\D/g, ''));
    if (aiPhones.length > 0 && sitePhones.length > 0) {
      const hasMatch = aiPhones.some(p => sitePhones.includes(p));
      if (!hasMatch) return foreignSourceOnly ? 'foreign_source' : 'contradiction';
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  }

  if (qLower.includes('service') || qLower.includes('treatment') || (targetService && qLower.includes(targetService))) {
    if (targetService) {
      const aiMentions = aiLower.includes(targetService.toLowerCase());
      const siteMentions = siteLower.includes(targetService.toLowerCase());
      if (aiMentions && !siteMentions) return foreignSourceOnly ? 'foreign_source' : 'unsupported';
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  }

  return foreignSourceOnly ? 'foreign_source' : 'unsupported';
}

const clinicDomain = 'aesthetiqmedspa.com';
const targetService = 'microneedling';

const testCases = [
  {
    question: 'What are AesthetIQ Med Spa hours in Oakdale MN?',
    ai: 'AesthetIQ Med Spa in Oakdale, MN is listed as Monday-Friday, 9:00 AM-5:00 PM on its official location page. A few third-party listings show slightly different Friday hours, including Friday 9:00 AM-3:00 PM or Monday-Friday 9:00 AM-7:00 PM, so the most reliable source is the spa\'s own website.',
    site: 'Monday to Friday : 9:00am-5:00pm',
    citations: ['https://www.aesthetiqmedspa.com/oakdalemedspa/', 'https://glowupfinder.com/listing/aesthetiq-med-spa-st-paul']
  },
  {
    question: 'Does AesthetIQ Med Spa offer microneedling, and what does it cost?',
    ai: 'Yes. AesthetIQ Med Spa offers microneedling in Oakdale, MN, and its service page lists three microneedling options with these prices: Face Only $399, Face & Neck $499, and Microneedling with Exosomes $699. It also lists PRP Microneedling at $599 on its services page.',
    site: 'microneedling',
    citations: ['https://www.aesthetiqmedspa.com/services/', 'https://www.aesthetiqmedspa.com/microneedling/', 'https://theaesthetiq.ai/services/']
  },
  {
    question: 'How do I book a first appointment at AesthetIQ Med Spa in Oakdale MN?',
    ai: 'You can book a first appointment at AesthetIQ Med Spa in Oakdale by using their online booking system or by calling the office at (651) 340-4318. For a new client, they also say you can call to schedule a consultation.',
    site: '(651) 340-4318',
    citations: ['https://www.aesthetiqmedspa.com/oakdalemedspa/', 'https://www.aesthetiqmedspa.com/contact/']
  },
  {
    question: 'What is AesthetIQ Med Spa phone number and address in Oakdale MN?',
    ai: 'AesthetIQ Med Spa\'s phone number is (651) 340-4318, and its address is 900 Inwood Ave N, Oakdale, MN 55128.',
    site: '(651) 340-4318; 900 Inwood Ave N Oakdale, MN 55128',
    citations: ['https://www.aesthetiqmedspa.com/contact/', 'https://www.aesthetiqmedspa.com/oakdalemedspa/']
  },
  {
    question: 'What treatments or services does AesthetIQ Med Spa offer in Oakdale MN?',
    ai: 'AesthetIQ Med Spa in Oakdale, MN offers a broad menu of injectables, facials, laser treatments, microneedling, chemical peels, body contouring, and CoolSculpting/CoolTone services.',
    site: 'botox, laser hair removal, hydrafacial, chemical peel, microneedling, body contouring, coolsculpting, cooltone',
    citations: ['https://www.aesthetiqmedspa.com/oakdalemedspa/', 'https://www.aesthetiqmedspa.com/services/']
  }
];

const summary = { contradiction: 0, unsupported: 0, cant_confirm: 0, foreign_source: 0 };

for (const tc of testCases) {
  const status = classifyClaim(tc.ai, tc.site, tc.question, tc.citations, clinicDomain, targetService);
  summary[status]++;
  console.log('\n' + '='.repeat(60));
  console.log('Q:', tc.question);
  console.log('STATUS:', status.toUpperCase());
  const foreign = tc.citations.filter(c => getDomain(c) !== clinicDomain);
  if (foreign.length > 0) console.log('FOREIGN CITATIONS:', foreign.map(getDomain));
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY:', JSON.stringify(summary, null, 2));

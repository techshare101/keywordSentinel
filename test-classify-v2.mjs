function getDomain(url) {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, '');
  } catch { return url; }
}

const DIRECTORY_DOMAINS = [
  'yelp.com', 'google.com', 'healthgrades.com', 'realself.com', 'glowupfinder.com',
  'webmd.com', 'zocdoc.com', 'vitals.com', 'wellness.com', 'mapquest.com',
  'yellowpages.com', 'bbb.org', 'facebook.com', 'instagram.com', 'tiktok.com'
];

const HIGH_TICKET_SERVICES = [
  'morpheus8', 'morpheus 8', 'laser hair removal', 'coolsculpting', 'cooltone',
  'botox', 'dermal fillers', 'kybella', 'thread lift', 'prp', 'microneedling',
  'chemical peel', 'hydrafacial', 'ultherapy', 'emsculpt', 'sculptra'
];

function isOfficialCitation(citation, clinicDomain) {
  const domain = getDomain(citation);
  return domain === clinicDomain || domain.includes(clinicDomain);
}
function isDirectoryCitation(citation) {
  const domain = getDomain(citation);
  return DIRECTORY_DOMAINS.some(d => domain.includes(d));
}
function isHedged(answer) {
  const lower = answer.toLowerCase();
  return ["i don't have", "i don't see", "not available", "cannot find", "i'm not sure", "it appears", "may be", "might be", "could be", "limited information", "no specific", "unclear", "i don't know"].some(p => lower.includes(p));
}
function extractHours(text) {
  return (text.toLowerCase().match(/\d{1,2}[:.]\d{2}\s*[ap]m?/g) || []).map(h => h.replace(/\s+/g, ''));
}
function extractPhones(text) {
  return (text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).map(p => p.replace(/\D/g, ''));
}

function classifyClaim(aiAnswer, siteFact, question, citations, clinicDomain, targetService, categoryService) {
  const qLower = question.toLowerCase();
  const aiLower = aiAnswer.toLowerCase();
  const hasDirectoryCitation = citations.some(isDirectoryCitation);
  const hasOfficialCitation = citations.some(c => isOfficialCitation(c, clinicDomain));
  const hasForeignCitation = citations.some(c => !isOfficialCitation(c, clinicDomain) && !isDirectoryCitation(c));
  const foreignSourceOnly = hasForeignCitation && !hasOfficialCitation && !hasDirectoryCitation;

  if (isHedged(aiAnswer)) return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  if (!siteFact) return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  const siteLower = siteFact.toLowerCase();

  if (qLower.includes('hour')) {
    const aiHours = extractHours(aiAnswer);
    const siteHours = extractHours(siteFact);
    if (aiHours.length > 0 && siteHours.length > 0) {
      const aiSet = new Set(aiHours);
      const siteSet = new Set(siteHours);
      const hasMismatch = Array.from(aiSet).some(h => !siteSet.has(h));
      if (hasMismatch) {
        if (hasDirectoryCitation) return 'source_conflict';
        return 'contradiction';
      }
      return 'confirmed';
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  }

  if (qLower.includes('phone') || qLower.includes('address') || qLower.includes('book')) {
    const aiPhones = extractPhones(aiAnswer);
    const sitePhones = extractPhones(siteFact);
    if (aiPhones.length > 0 && sitePhones.length > 0) {
      const hasMatch = aiPhones.some(p => sitePhones.includes(p));
      if (!hasMatch) {
        if (hasDirectoryCitation) return 'source_conflict';
        return 'contradiction';
      }
      return 'confirmed';
    }
    return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
  }

  if (qLower.includes('service') || qLower.includes('treatment') || qLower.includes('offer') ||
      (targetService && qLower.includes(targetService)) ||
      (categoryService && qLower.includes(categoryService))) {
    const serviceToCheck = targetService && qLower.includes(targetService) ? targetService :
                           categoryService && qLower.includes(categoryService) ? categoryService : null;
    if (serviceToCheck) {
      const aiMentions = aiLower.includes(serviceToCheck.toLowerCase());
      const siteMentions = siteLower.includes(serviceToCheck.toLowerCase());
      if (aiMentions && siteMentions) return 'confirmed';
      if (aiMentions && !siteMentions) return foreignSourceOnly ? 'foreign_source' : 'unsupported';
      if (!aiMentions && siteMentions) return 'cant_confirm';
      return 'cant_confirm';
    }
    const siteServices = HIGH_TICKET_SERVICES.filter(s => siteLower.includes(s));
    const aiMentionsAny = siteServices.some(s => aiLower.includes(s));
    if (siteServices.length > 0 && aiMentionsAny) return 'confirmed';
    return 'cant_confirm';
  }

  return foreignSourceOnly ? 'foreign_source' : 'cant_confirm';
}

const clinicDomain = 'aesthetiqmedspa.com';
const targetService = 'microneedling';
const categoryService = 'Morpheus8';

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
    question: 'Does AesthetIQ Med Spa offer Morpheus8, and what does it cost?',
    ai: 'Yes, AesthetIQ Med Spa offers Morpheus8 in Oakdale, MN. The pricing is typically around $900 to $1,500 per session, according to information from a plastic surgery practice in New Jersey.',
    site: 'microneedling',
    citations: ['https://njplasticsurgery.com/morpheus8/']
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

const summary = { confirmed: 0, contradiction: 0, unsupported: 0, cant_confirm: 0, source_conflict: 0, foreign_source: 0 };

for (const tc of testCases) {
  const status = classifyClaim(tc.ai, tc.site, tc.question, tc.citations, clinicDomain, targetService, categoryService);
  summary[status]++;
  console.log('\n' + '='.repeat(70));
  console.log('Q:', tc.question);
  console.log('STATUS:', status.toUpperCase());
  const dirs = tc.citations.filter(isDirectoryCitation).map(getDomain);
  if (dirs.length > 0) console.log('DIRECTORY CITATIONS:', dirs);
}

console.log('\n' + '='.repeat(70));
console.log('CORRECTED SUMMARY:', JSON.stringify(summary, null, 2));

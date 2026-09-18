const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const OpenAI = require('openai');

const queries = [
  "What are AesthetIQ Med Spa's hours in Oakdale MN?",
  "Does AesthetIQ Med Spa offer Morpheus8, and what does it cost?",
  "How do I book a first appointment at AesthetIQ Med Spa?"
];

async function callPerplexity(query) {
  const client = new OpenAI({
    apiKey: env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  });
  const r = await client.chat.completions.create({
    model: 'sonar',
    messages: [{role: 'user', content: query}],
    max_tokens: 800,
  });
  return {
    text: r.choices[0].message.content,
    citations: r.citations || [],
  };
}

(async () => {
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`QUERY ${i+1}: ${q}`);
    console.log('='.repeat(70));
    try {
      const result = await callPerplexity(q);
      console.log('\nANSWER:');
      console.log(result.text);
      console.log('\nCITATIONS:');
      result.citations.forEach((c, idx) => console.log(`  [${idx+1}] ${c}`));
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    // Small delay between calls
    if (i < queries.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
})();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query() {
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Service key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20));
  
  // Check reports
  const { data: reports, error: reportsError } = await supabase
    .from('signal_reports')
    .select('id, status, icp_description, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n=== SIGNAL REPORTS ===');
  console.log(JSON.stringify(reports, null, 2));
  if (reportsError) console.log('Error:', reportsError);
  
  if (reports && reports.length > 0) {
    // Check sections for the first report
    const { data: sections, error: sectionsError } = await supabase
      .from('signal_sections')
      .select('section_type, status, error_message, sources')
      .eq('report_id', reports[0].id);
    
    console.log('\n=== SECTIONS FOR LATEST REPORT ===');
    console.log(JSON.stringify(sections, null, 2));
    if (sectionsError) console.log('Error:', sectionsError);
    
    // Check raw fetches
    const { data: fetches, error: fetchesError } = await supabase
      .from('signal_raw_fetches')
      .select('source, request_url, response_status, latency_ms')
      .eq('report_id', reports[0].id)
      .limit(10);
    
    console.log('\n=== RAW FETCHES FOR LATEST REPORT ===');
    console.log(JSON.stringify(fetches, null, 2));
    if (fetchesError) console.log('Error:', fetchesError);
  }
}

query().catch(console.error);

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://dsumnnwgoropgmnjlyph.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzdW1ubndnb3JvcGdtbmpseXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjczNDM4MiwiZXhwIjoyMDgyMzEwMzgyfQ.yADP6moerUDWK4snAw47ojUVfW_gyleUJ066YOooqME'
)

async function applyMigration() {
  console.log('🔧 Applying lead_bucket migration...\n')
  
  try {
    // Add lead_bucket column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lead_bucket TEXT DEFAULT 'neutral';
        COMMENT ON COLUMN public.matches.lead_bucket IS 'Bucket for lead prioritization: hot, warm, cold, neutral';
      `
    })
    
    if (error) {
      console.error('❌ Migration failed via RPC, trying direct query...')
      
      // Try using raw SQL query
      const { error: sqlError } = await supabase
        .from('matches')
        .select('lead_bucket')
        .limit(1)
      
      if (sqlError && sqlError.message.includes('lead_bucket')) {
        console.error('❌ Column does not exist. Need to run SQL manually.')
        console.log('\n📋 Run this SQL in your Supabase SQL Editor:')
        console.log('-------------------------------------------')
        console.log('ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lead_bucket TEXT DEFAULT \'neutral\';')
        console.log('-------------------------------------------\n')
      } else {
        console.log('✅ Column already exists or was just created!')
      }
    } else {
      console.log('✅ Migration applied successfully!')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n📋 Run this SQL in your Supabase SQL Editor:')
    console.log('-------------------------------------------')
    console.log('ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS lead_bucket TEXT DEFAULT \'neutral\';')
    console.log('-------------------------------------------\n')
  }
}

applyMigration().then(() => process.exit(0))

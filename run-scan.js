const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://dsumnnwgoropgmnjlyph.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzdW1ubndnb3JvcGdtbmpseXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjczNDM4MiwiZXhwIjoyMDgyMzEwMzgyfQ.yADP6moerUDWK4snAw47ojUVfW_gyleUJ066YOooqME'
)

async function triggerScan() {
  console.log('🚀 Triggering manual scan via API...\n')
  
  try {
    const response = await fetch('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'ks_cron_f83a92b1e7c4490d'
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Scan completed successfully!')
      console.log(`   Users scanned: ${data.usersScanned}`)
      console.log(`   Keywords scanned: ${data.keywordsScanned}`)
      console.log(`   Matches found: ${data.totalMatches}`)
    } else {
      console.error('❌ Scan failed:', data)
    }
  } catch (error) {
    console.error('❌ Error triggering scan:', error.message)
  }
}

triggerScan().then(() => process.exit(0))

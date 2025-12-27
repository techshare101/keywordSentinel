/**
 * Manual scan trigger script
 * Usage: node run-scan.js [userId]
 * 
 * If userId is provided, scans only that user's keywords
 * Otherwise, runs a full scan for all users
 */

const CRON_SECRET = process.env.CRON_SECRET_KEY || 'ks_cron_f83a92b1e7c4490d'
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function triggerScan() {
  const userId = process.argv[2]
  
  console.log('🚀 Triggering scan via API...')
  console.log(`   Mode: ${userId ? `Single user (${userId})` : 'Full scan (all users)'}`)
  console.log('')
  
  try {
    const response = await fetch(`${API_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      },
      body: JSON.stringify(userId ? { userId } : {})
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Scan completed successfully!')
      console.log(`   Users scanned: ${data.usersScanned || 1}`)
      console.log(`   Keywords scanned: ${data.keywordsScanned}`)
      console.log(`   Matches found: ${data.totalMatches || data.matchesFound || 0}`)
      if (data.duration) {
        console.log(`   Duration: ${data.duration}`)
      }
      if (data.errors?.length > 0) {
        console.log(`   ⚠️ Errors: ${data.errors.length}`)
        data.errors.forEach(e => console.log(`      - ${e}`))
      }
    } else {
      console.error('❌ Scan failed:', data.error || data.message || 'Unknown error')
    }
  } catch (error) {
    console.error('❌ Error triggering scan:', error.message)
  }
}

triggerScan().then(() => process.exit(0))

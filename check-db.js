const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://dsumnnwgoropgmnjlyph.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzdW1ubndnb3JvcGdtbmpseXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjczNDM4MiwiZXhwIjoyMDgyMzEwMzgyfQ.yADP6moerUDWK4snAw47ojUVfW_gyleUJ066YOooqME'
)

async function checkDatabase() {
  console.log('🔍 Checking database state...\n')

  // Check users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, plan, created_at')
    .limit(5)

  console.log('👤 USERS:')
  if (usersError) {
    console.error('Error:', usersError)
  } else {
    console.log(`Found ${users?.length || 0} users`)
    users?.forEach(u => console.log(`  - ${u.email} (${u.plan}) [${u.id}]`))
  }

  // Check keywords
  const { data: keywords, error: keywordsError } = await supabase
    .from('keywords')
    .select('id, keyword, user_id, is_active, created_at')
    .limit(10)

  console.log('\n🔑 KEYWORDS:')
  if (keywordsError) {
    console.error('Error:', keywordsError)
  } else {
    console.log(`Found ${keywords?.length || 0} keywords`)
    keywords?.forEach(k => console.log(`  - "${k.keyword}" (active: ${k.is_active}) [user: ${k.user_id.slice(0, 8)}...]`))
  }

  // Check matches
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, title, user_id, source, created_at')
    .limit(10)

  console.log('\n🎯 MATCHES:')
  if (matchesError) {
    console.error('Error:', matchesError)
  } else {
    console.log(`Found ${matches?.length || 0} matches`)
    matches?.forEach(m => console.log(`  - ${m.title.slice(0, 50)}... (${m.source}) [user: ${m.user_id.slice(0, 8)}...]`))
  }

  // Check if there are any auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  console.log('\n🔐 AUTH USERS:')
  if (authError) {
    console.error('Error:', authError)
  } else {
    console.log(`Found ${authUsers?.users?.length || 0} auth users`)
    authUsers?.users?.slice(0, 5).forEach(u => console.log(`  - ${u.email} [${u.id}]`))
  }
}

checkDatabase().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

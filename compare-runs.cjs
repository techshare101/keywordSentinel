const fs = require('fs')

const run1 = require('./ks-run1.json')
console.log('Run 1 captured. Waiting 30 minutes before run 2...')
console.log('Run 1 summary:', JSON.stringify(run1.summary, null, 2))
console.log('Engines:', JSON.stringify(run1.engine_status.map((e) => `${e.engine} ${e.answered}/${e.of}`)))

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:3002/api/clinic-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: 'AesthetIQ Med Spa',
        location: 'Oakdale MN',
        website: 'aesthetiqmedspa.com',
      }),
    })
    const run2 = await res.json()
    fs.writeFileSync('./ks-run2.json', JSON.stringify(run2, null, 2))

    console.log('\n=== Run 1 summary ===')
    console.log(JSON.stringify(run1.summary, null, 2))
    console.log('Engines:', JSON.stringify(run1.engine_status.map((e) => `${e.engine} ${e.answered}/${e.of}`)))

    console.log('\n=== Run 2 summary ===')
    console.log(JSON.stringify(run2.summary, null, 2))
    console.log('Engines:', JSON.stringify(run2.engine_status.map((e) => `${e.engine} ${e.answered}/${e.of}`)))

    console.log('\n=== Per-claim comparison ===')
    let drift = false
    for (const c1 of run1.claims) {
      const c2 = run2.claims.find((c) => c.question === c1.question)
      const match = c1.status === c2?.status && c1.evidence === c2?.evidence
      if (!match) drift = true
      console.log(`${match ? '==' : '->'} [${c1.check}] ${c1.status}${c1.evidence === 'thin' ? '/thin' : ''} :> ${c2?.status || 'MISSING'}${c2?.evidence === 'thin' ? '/thin' : ''}`)
      console.log(`   Q: ${c1.question}`)
      if (!match) {
        console.log(`   R1: ${c1.reason}`)
        console.log(`   R2: ${c2?.reason}`)
      }
    }

    const findingStatuses = ['contradiction', 'foreign_source', 'source_conflict', 'unsupported']
    let crossing = false
    for (const c1 of run1.claims) {
      const c2 = run2.claims.find((c) => c.question === c1.question)
      const s1Finding = findingStatuses.includes(c1.status)
      const s2Finding = findingStatuses.includes(c2?.status)
      if (s1Finding !== s2Finding) crossing = true
    }

    console.log('\n=== Result ===')
    if (!drift) {
      console.log('PASS: identical tile counts and claim statuses')
    } else if (!crossing) {
      console.log('PARTIAL: drift within context tiles only')
    } else {
      console.log('FAIL: at least one claim crossed into or out of findings tiles')
    }
  } catch (err) {
    console.error('Run 2 failed:', err.message)
  }
}, 30 * 60 * 1000)

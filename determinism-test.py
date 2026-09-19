import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error

PROJECT = r'C:\Users\valen\keywordSentinel'
URL = 'http://localhost:3002/api/clinic-check'
PAYLOAD = json.dumps({
    'business_name': 'AesthetIQ Med Spa',
    'location': 'Oakdale MN',
    'website': 'aesthetiqmedspa.com'
}).encode('utf-8')

def log(msg):
    print(msg, flush=True)

def kill_server():
    try:
        out = subprocess.check_output(['netstat', '-ano'], text=True)
        for line in out.splitlines():
            if ':3002' in line and 'LISTENING' in line:
                pid = line.split()[-1].strip()
                subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
                time.sleep(2)
    except Exception as e:
        log(f'kill warning: {e}')

def start_server():
    log('Starting Next.js server on port 3002...')
    proc = subprocess.Popen(
        'npx next start -p 3002',
        cwd=PROJECT,
        stdout=open(os.path.join(PROJECT, 'server.log'), 'w'),
        stderr=subprocess.STDOUT,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
    )
    log(f'Server PID: {proc.pid}')
    # Wait for readiness
    for i in range(30):
        try:
            req = urllib.request.Request('http://localhost:3002/login', method='GET')
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    log('Server ready')
                    return proc
        except Exception:
            pass
        time.sleep(1)
    log('Server did not become ready')
    sys.exit(1)

def run_check(label):
    log(f'\n--- {label} ---')
    req = urllib.request.Request(URL, data=PAYLOAD, headers={
        'Content-Type': 'application/json'
    }, method='POST')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                path = os.path.join(PROJECT, f'ks-{label.lower().replace(" ", "-")}.json')
                with open(path, 'w') as f:
                    json.dump(data, f, indent=2)
                log(f"{label} saved to {path}")
                summary_str = json.dumps(data['summary'])
                engines_str = ', '.join([f"{e['engine']} {e['answered']}/{e['of']}" for e in data['engine_status']])
                log(f"Summary: {summary_str}")
                log(f"Engines: {engines_str}")
                log(f"Grade: {data['report_grade']}, sellable: {data['sellable_findings']}, thin: {data.get('thin_claims', 0)}")
                return data
        except Exception as e:
            log(f'{label} attempt {attempt+1} failed: {e}')
            time.sleep(5)
    log(f'{label} failed after retries')
    sys.exit(1)

def compare(run1, run2):
    log('\n=== Comparison ===')
    finding_statuses = ['contradiction', 'foreign_source', 'source_conflict', 'unsupported']
    drift = False
    crossing = False
    for c1 in run1['claims']:
        c2 = next((c for c in run2['claims'] if c['question'] == c1['question']), None)
        if not c2:
            log(f"MISSING in run 2: {c1['question']}")
            drift = True
            continue
        match = c1['status'] == c2['status'] and c1.get('evidence') == c2.get('evidence')
        s1f = c1['status'] in finding_statuses
        s2f = c2['status'] in finding_statuses
        if s1f != s2f:
            crossing = True
        if not match:
            drift = True
            log(f"DRIFT [{c1['check']}] {c1['status']}{'/thin' if c1.get('evidence')=='thin' else ''} -> {c2['status']}{'/thin' if c2.get('evidence')=='thin' else ''}")
            log(f"   Q: {c1['question']}")
            log(f"   R1: {c1['reason']}")
            log(f"   R2: {c2['reason']}")
        else:
            log(f"OK    [{c1['check']}] {c1['status']}{'/thin' if c1.get('evidence')=='thin' else ''}")

    log('\n=== Result ===')
    if not drift:
        log('PASS: identical tile counts and claim statuses')
    elif not crossing:
        log('PARTIAL: drift within context tiles only')
    else:
        log('FAIL: at least one claim crossed into or out of findings tiles')

def main():
    os.chdir(PROJECT)
    kill_server()
    server = start_server()
    try:
        run1 = run_check('Run 1')
        log('\nWaiting 30 minutes before run 2...')
        time.sleep(30 * 60)
        run2 = run_check('Run 2')
        compare(run1, run2)
    finally:
        log('\nStopping server...')
        subprocess.run(['taskkill', '/F', '/PID', str(server.pid)], capture_output=True)
        kill_server()

if __name__ == '__main__':
    main()

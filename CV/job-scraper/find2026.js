import Database from 'better-sqlite3';

const db = new Database('../jobs_v2.db');

// Stats for 2026 jobs
const total = db.prepare("SELECT COUNT(*) c FROM jobs WHERE published_date LIKE '%2026%'").get().c;
const uk = db.prepare("SELECT COUNT(*) c FROM jobs WHERE published_date LIKE '%2026%' AND (country LIKE '%United Kingdom%' OR country LIKE '%UK%')").get().c;
const europe = db.prepare("SELECT COUNT(*) c FROM jobs WHERE published_date LIKE '%2026%' AND country LIKE '%Europe%'").get().c;
const remote = db.prepare("SELECT COUNT(*) c FROM jobs WHERE published_date LIKE '%2026%' AND is_remote=1").get().c;
const noIndia = db.prepare("SELECT COUNT(*) c FROM jobs WHERE published_date LIKE '%2026%' AND country NOT LIKE '%India%' AND is_remote=1").get().c;

console.log('=== 2026 JOBS STATS ===');
console.log('Total 2026 jobs:', total);
console.log('UK jobs:', uk);
console.log('Europe jobs:', europe);
console.log('Remote jobs:', remote);
console.log('Remote (no India):', noIndia);

// List UK/Europe Remote 2026 jobs
console.log('\n=== UK/EUROPE REMOTE 2026 JOBS ===\n');
const jobs = db.prepare(`
  SELECT title, company, country, salary, published_date
  FROM jobs 
  WHERE published_date LIKE '%2026%'
    AND is_remote = 1
    AND country NOT LIKE '%India%'
    AND (country LIKE '%UK%' OR country LIKE '%United Kingdom%' OR country LIKE '%Europe%' OR country LIKE '%Germany%' OR country LIKE '%Poland%' OR country LIKE '%France%' OR country LIKE '%Netherlands%')
  ORDER BY published_date DESC
`).all();

console.log('Found:', jobs.length, 'UK/Europe Remote 2026 jobs\n');
jobs.forEach((j, i) => {
    console.log(`${i + 1}. ${j.title.slice(0, 55)}`);
    console.log(`   ${j.company} | ${j.country} | ${j.salary || 'No salary'} | ${j.published_date}`);
});

db.close();

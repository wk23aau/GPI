import Database from 'better-sqlite3';
import * as fs from 'fs';

const db = new Database('../jobs_v2.db');
const jobs = db.prepare(`
  SELECT title, company, country, salary, tags, description, apply_link, published_date 
  FROM jobs 
  WHERE published_date LIKE '%2026%' 
    AND is_remote = 1 
    AND country NOT LIKE '%India%' 
    AND (country LIKE '%UK%' OR country LIKE '%United Kingdom%' OR country LIKE '%Europe%' 
         OR country LIKE '%Germany%' OR country LIKE '%Poland%' OR country LIKE '%France%' 
         OR country LIKE '%Netherlands%' OR country LIKE '%Romania%' OR country LIKE '%Spain%'
         OR country LIKE '%Portugal%' OR country LIKE '%Bulgaria%' OR country LIKE '%Ukraine%')
  ORDER BY published_date DESC
`).all();

fs.writeFileSync('uk_europe_2026.json', JSON.stringify(jobs, null, 2));
console.log('Exported', jobs.length, 'jobs to uk_europe_2026.json');
db.close();

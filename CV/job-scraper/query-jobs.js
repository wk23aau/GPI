import Database from 'better-sqlite3';
import * as fs from 'fs';

const db = new Database('../jobs.db');

// Get stats
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as with_title,
    COUNT(CASE WHEN description IS NOT NULL AND LENGTH(description) > 100 THEN 1 END) as with_desc,
    COUNT(CASE WHEN company IS NOT NULL AND company != '' THEN 1 END) as with_company,
    COUNT(CASE WHEN location IS NOT NULL AND location != '' THEN 1 END) as with_location
  FROM jobs
`).get();

console.log('📊 Database Statistics:');
console.log(JSON.stringify(stats, null, 2));

// Get all jobs for analysis
const jobs = db.prepare(`
  SELECT id, url, title, company, location, salary, skills, description, apply_link
  FROM jobs 
  WHERE title IS NOT NULL AND title != ''
  ORDER BY id
`).all();

console.log(`\n📋 Total jobs to analyze: ${jobs.length}`);

// Export to JSON for detailed analysis
const exportData = jobs.map(j => ({
    id: j.id,
    url: j.url,
    title: j.title,
    company: j.company || 'Unknown',
    location: j.location || 'Unknown',
    hasDescription: j.description && j.description.length > 50,
    descLength: j.description?.length || 0,
    skills: j.skills || '',
    applyLink: j.apply_link || ''
}));

fs.writeFileSync('all_jobs.json', JSON.stringify(exportData, null, 2));
console.log('✅ Exported all jobs to all_jobs.json');

// Print first 30 for preview
console.log('\n📝 First 30 jobs:');
jobs.slice(0, 30).forEach((j, i) => {
    console.log(`${i + 1}. [${j.id}] ${(j.title || '').slice(0, 60)} | ${(j.company || 'Unknown').slice(0, 25)}`);
});

db.close();

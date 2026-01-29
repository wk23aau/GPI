import Database from 'better-sqlite3';

const db = new Database('../jobs.db');

const jobs = db.prepare(`
  SELECT id, url, title, location, skills, description
  FROM jobs 
  WHERE title IS NOT NULL AND title != ''
    AND (skills LIKE '%UK%' OR skills LIKE '%United Kingdom%' OR skills LIKE '%Europe%' 
         OR skills LIKE '%Remote%' OR location LIKE '%Remote%')
    AND skills NOT LIKE '%India%' AND location NOT LIKE '%India%'
    AND skills NOT LIKE '%Bangalore%'
  ORDER BY id DESC
  LIMIT 25
`).all();

console.log("RECENT UK/EUROPE/REMOTE JOBS (No India)");
console.log("========================================\n");

jobs.forEach((job, i) => {
    const urlId = job.url.match(/\d+/g)?.pop() || '0';
    const skills = job.skills || '';

    let loc = 'Unknown';
    if (skills.includes('UK') || skills.includes('United Kingdom')) loc = 'UK';
    else if (skills.includes('Germany')) loc = 'Germany';
    else if (skills.includes('France')) loc = 'France';
    else if (skills.includes('Poland')) loc = 'Poland';
    else if (skills.includes('Europe')) loc = 'Europe';
    else if (skills.includes('Remote')) loc = 'Remote';

    const remote = skills.includes('Remote') ? 'REMOTE' : 'Onsite';

    console.log((i + 1) + ". [" + urlId + "] " + job.title.slice(0, 55));
    console.log("   " + remote + " - " + loc);
    console.log("   " + job.url);
    console.log("");
});

console.log("Total: " + jobs.length + " jobs");
db.close();

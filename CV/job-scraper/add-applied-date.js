import Database from 'better-sqlite3';

const db = new Database('../jobs_v2.db');

// Check if column exists
const columns = db.prepare('PRAGMA table_info(jobs)').all().map(c => c.name);

if (!columns.includes('applied_date')) {
    db.exec('ALTER TABLE jobs ADD COLUMN applied_date TEXT');
    console.log('✅ Added applied_date column');
} else {
    console.log('✅ applied_date column already exists');
}

// Show current schema
console.log('\nCurrent columns:', columns);

db.close();

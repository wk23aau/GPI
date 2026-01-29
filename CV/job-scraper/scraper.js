import Database from 'better-sqlite3';
import { parseStringPromise } from 'xml2js';

const SITEMAP_URL = 'https://testdevjobs.com/sitemap.xml';
const DB_PATH = '../jobs_v2.db';

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    url TEXT UNIQUE,
    title TEXT,
    company TEXT,
    location TEXT,
    country TEXT,
    job_type TEXT,
    salary TEXT,
    is_remote INTEGER,
    is_featured INTEGER,
    tags TEXT,
    description TEXT,
    apply_link TEXT,
    published_date TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertJob = db.prepare(`
  INSERT OR REPLACE INTO jobs (job_id, url, title, company, location, country, job_type, salary, is_remote, is_featured, tags, description, apply_link, published_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const existingUrls = new Set(db.prepare('SELECT url FROM jobs').all().map(r => r.url));

async function fetchSitemap() {
    console.log('📥 Fetching sitemap...');
    const res = await fetch(SITEMAP_URL);
    const xml = await res.text();
    const result = await parseStringPromise(xml);
    const urls = result.urlset.url.map(u => u.loc[0]).filter(url => url.includes('/job/'));
    console.log(`✅ Found ${urls.length} job URLs`);
    return urls;
}

async function scrapeJob(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();

        // Extract JSON from __INITIAL_STATE__
        const match = html.match(/window\.__INITIAL_STATE__=(\{.*?\});/s);
        if (!match) return null;

        const data = JSON.parse(match[1]);
        const job = data.data?.job;
        if (!job) return null;

        // Extract all fields
        const tags = Array.isArray(job.tags) ? job.tags.map(t => t.id || t.title).join(', ') : '';
        const country = Array.isArray(job.country) ? job.country.map(c => c.id || c.title).join(', ') : (job.country || '');

        return {
            job_id: job.id || '',
            title: job.jobTitle || '',
            company: job.companyName || '',
            location: job.joblocation || '',
            country: country,
            job_type: job.jobType || '',
            salary: job.salary || '',
            is_remote: job.isRemote ? 1 : 0,
            is_featured: job.isFeatured ? 1 : 0,
            tags: tags,
            description: job.jobDescription || '',
            apply_link: job.applyLink || '',
            published_date: job.jobPosted || ''
        };
    } catch (err) {
        console.error(`❌ ${url}: ${err.message}`);
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity;
    const fast = args.includes('--fast');

    const urls = await fetchSitemap();
    const toScrape = urls.filter(u => !existingUrls.has(u)).slice(0, limit);
    console.log(`🚀 Scraping ${toScrape.length} jobs (${existingUrls.size} in DB)...`);

    let count = 0;
    for (const url of toScrape) {
        const job = await scrapeJob(url);
        if (job?.title) {
            insertJob.run(job.job_id, url, job.title, job.company, job.location, job.country, job.job_type, job.salary, job.is_remote, job.is_featured, job.tags, job.description, job.apply_link, job.published_date);
            count++;
            console.log(`✅ [${count}/${toScrape.length}] ${job.title.slice(0, 50)} | ${job.published_date}`);
        }
        // No waits - full speed
    }

    const total = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
    console.log(`\n🎉 Done! Total: ${total}`);
    db.close();
}

main().catch(console.error);

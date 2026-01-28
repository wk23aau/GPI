/**
 * XOD Job Search Flow - Autonomous job hunting
 * 
 * Uses the 30 Hz loop + mutation observer, not manual commands
 */

const SITES = [
    { name: 'Indeed', url: 'https://uk.indeed.com/jobs?q=QA+Engineer', selector: '.job_seen_beacon' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search?keywords=QA%20Engineer', selector: '.job-card-container' },
    { name: 'Glassdoor', url: 'https://www.glassdoor.co.uk/Job/qa-engineer-jobs-SRCH_KO0,11.htm', selector: '.JobCard_jobCardContainer' },
    { name: 'Reed', url: 'https://www.reed.co.uk/jobs/qa-engineer-jobs', selector: '.job-card' },
    { name: 'TotalJobs', url: 'https://www.totaljobs.com/jobs/qa-engineer', selector: '.res-1foik6i' }
];

export class JobSearchFlow {
    constructor(executor) {
        this.executor = executor;
        this.cdp = executor.cdp;
        this.jobs = [];
        this.currentSite = 0;
        this.running = false;
    }

    async start() {
        this.running = true;
        console.log('[JobSearch] Starting autonomous search on 5 sites...');

        // Setup reflexes for job sites
        this.executor.addReflex('cookie-dismiss',
            () => true, // Check every tick
            async (exec) => {
                // Quick cookie banner check
                await exec.cdp.eval(`
                    (function() {
                        const btns = document.querySelectorAll('button');
                        for (const b of btns) {
                            const t = b.textContent.toLowerCase();
                            if (t.includes('accept') || t.includes('agree') || t.includes('got it')) {
                                b.click();
                                return true;
                            }
                        }
                    })()
                `);
            }
        );

        // Go through each site
        for (const site of SITES) {
            if (!this.running) break;
            console.log(`[JobSearch] Searching ${site.name}...`);

            await this.searchSite(site);
        }

        console.log(`[JobSearch] Done! Found ${this.jobs.length} jobs total`);
        return this.jobs;
    }

    async searchSite(site) {
        // Navigate
        await this.cdp.navigate(site.url);
        await this.sleep(2000);
        await this.cdp.injectAgent();

        // Extract jobs using page eval (fast, no round trips)
        const jobs = await this.cdp.eval(`
            (function() {
                const cards = document.querySelectorAll('${site.selector}');
                const results = [];
                for (let i = 0; i < Math.min(cards.length, 2); i++) {
                    const card = cards[i];
                    const title = card.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || '';
                    const company = card.querySelector('[class*="company"], [class*="employer"]')?.textContent?.trim() || '';
                    const link = card.querySelector('a')?.href || '';
                    if (title) results.push({ site: '${site.name}', title, company, link });
                }
                return results;
            })()
        `);

        if (jobs && jobs.length) {
            this.jobs.push(...jobs);
            console.log(`  Found ${jobs.length} jobs on ${site.name}`);
            jobs.forEach(j => console.log(`    - ${j.title} @ ${j.company}`));
        }
    }

    stop() {
        this.running = false;
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// Quick start function
export async function searchJobs(executor) {
    const flow = new JobSearchFlow(executor);
    return await flow.start();
}

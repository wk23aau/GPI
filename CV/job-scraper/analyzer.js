import Database from 'better-sqlite3';

const DB_PATH = '../jobs.db';
const db = new Database(DB_PATH);

// CV Skills from constants.ts - Senior Frontend QA Engineer profile
const CV_SKILLS = {
    core: ['python', 'selenium', 'cypress', 'playwright', 'docker', 'kubernetes', 'ci/cd', 'jenkins', 'github actions', 'git'],
    testing: ['qa', 'automation', 'testing', 'test', 'quality', 'e2e', 'unit', 'integration', 'performance', 'api testing', 'postman'],
    frontend: ['javascript', 'typescript', 'react', 'vue', 'angular', 'html', 'css', 'web'],
    ai_ml: ['ai', 'machine learning', 'ml', 'llm', 'gpt', 'data science', 'pytorch', 'tensorflow'],
    infrastructure: ['aws', 'gcp', 'azure', 'linux', 'devops', 'terraform', 'ansible'],
    languages: ['python', 'java', 'javascript', 'typescript', 'sql']
};

const CV_EXPERIENCE_YEARS = 6; // 6+ years experience
const CV_LOCATION = 'uk'; // UK-based with right to work

// Weight factors for scoring
const WEIGHTS = {
    skillMatch: 0.35,
    experienceMatch: 0.20,
    locationMatch: 0.20,
    salaryAttractiveness: 0.15,
    recency: 0.10
};

// Add new columns - SQLite doesn't support IF NOT EXISTS for ALTER, use try/catch
try { db.exec(`ALTER TABLE jobs ADD COLUMN skill_score REAL DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN relevance_score REAL DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN ats_score REAL DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN acceptance_chance TEXT DEFAULT ''`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN priority_rank INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN matched_skills TEXT DEFAULT ''`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN missing_skills TEXT DEFAULT ''`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN location_match INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN salary_min INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN salary_max INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN salary_currency TEXT DEFAULT ''`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN is_remote INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN experience_required INTEGER DEFAULT 0`); } catch { }
try { db.exec(`ALTER TABLE jobs ADD COLUMN analyzed_at DATETIME`); } catch { }

// Prepare update statement
const updateJob = db.prepare(`
  UPDATE jobs SET
    skill_score = ?, relevance_score = ?, ats_score = ?, acceptance_chance = ?,
    matched_skills = ?, missing_skills = ?, location_match = ?,
    salary_min = ?, salary_max = ?, salary_currency = ?, is_remote = ?,
    experience_required = ?, analyzed_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

function extractSkillsFromText(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    const allSkills = [...CV_SKILLS.core, ...CV_SKILLS.testing, ...CV_SKILLS.frontend,
    ...CV_SKILLS.ai_ml, ...CV_SKILLS.infrastructure, ...CV_SKILLS.languages];
    return [...new Set(allSkills.filter(skill => lower.includes(skill)))];
}

function calculateSkillScore(jobText) {
    const allSkills = [...new Set([...CV_SKILLS.core, ...CV_SKILLS.testing, ...CV_SKILLS.frontend,
    ...CV_SKILLS.ai_ml, ...CV_SKILLS.infrastructure])];
    const matched = extractSkillsFromText(jobText);
    const matchedCore = CV_SKILLS.core.filter(s => matched.includes(s));
    const matchedOther = matched.filter(s => !CV_SKILLS.core.includes(s));

    // Core skills weighted 2x
    const score = (matchedCore.length * 2 + matchedOther.length) / (CV_SKILLS.core.length * 2 + 15);
    return Math.min(score * 100, 100);
}

function extractSalary(text) {
    if (!text) return { min: 0, max: 0, currency: '' };

    // Match various salary patterns
    const patterns = [
        /\$(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–—to]+\s*\$?(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /£(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–—to]+\s*£?(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /€(\d{1,3}(?:,\d{3})*(?:k)?)\s*[-–—to]+\s*€?(\d{1,3}(?:,\d{3})*(?:k)?)/i,
        /(\d{1,3}(?:,\d{3})*)\s*(?:usd|gbp|eur)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let min = parseInt(match[1].replace(/[,k]/gi, ''));
            let max = match[2] ? parseInt(match[2].replace(/[,k]/gi, '')) : min;
            if (match[1].toLowerCase().includes('k')) min *= 1000;
            if (match[2]?.toLowerCase().includes('k')) max *= 1000;
            const currency = text.includes('$') ? 'USD' : text.includes('£') ? 'GBP' : 'EUR';
            return { min, max, currency };
        }
    }
    return { min: 0, max: 0, currency: '' };
}

function checkLocationMatch(text) {
    if (!text) return { match: 0, isRemote: false };
    const lower = text.toLowerCase();
    const isRemote = lower.includes('remote') || lower.includes('anywhere') || lower.includes('worldwide');
    const isUK = lower.includes('uk') || lower.includes('united kingdom') || lower.includes('london') ||
        lower.includes('england') || lower.includes('britain');
    const isEurope = lower.includes('europe') || lower.includes('emea');

    if (isUK) return { match: 100, isRemote };
    if (isRemote) return { match: 90, isRemote: true };
    if (isEurope) return { match: 70, isRemote };
    return { match: 30, isRemote };
}

function extractExperienceYears(text) {
    if (!text) return 0;
    const patterns = [
        /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
        /(\d+)\+?\s*years?\s*(?:in|with)/i,
        /experience:\s*(\d+)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return parseInt(match[1]);
    }
    return 0;
}

function calculateRelevanceScore(skillScore, locationMatch, salary, expRequired) {
    let score = skillScore * WEIGHTS.skillMatch;
    score += locationMatch * WEIGHTS.locationMatch;

    // Salary attractiveness (higher salary = more attractive)
    if (salary.max > 0) {
        const salaryScore = Math.min(salary.max / 150000 * 100, 100); // Normalize to 150k max
        score += salaryScore * WEIGHTS.salaryAttractiveness;
    }

    // Experience match (penalty if requires more than CV has)
    if (expRequired <= CV_EXPERIENCE_YEARS) {
        score += 100 * WEIGHTS.experienceMatch;
    } else {
        score += Math.max(0, (CV_EXPERIENCE_YEARS / expRequired) * 100) * WEIGHTS.experienceMatch;
    }

    return Math.round(score);
}

function calculateAcceptanceChance(relevanceScore, skillScore, locationMatch) {
    const avgScore = (relevanceScore + skillScore + locationMatch) / 3;
    if (avgScore >= 80) return 'HIGH';
    if (avgScore >= 60) return 'MEDIUM';
    if (avgScore >= 40) return 'LOW';
    return 'UNLIKELY';
}

async function analyzeJobs() {
    const jobs = db.prepare('SELECT * FROM jobs WHERE analyzed_at IS NULL OR skill_score = 0').all();
    console.log(`🔍 Analyzing ${jobs.length} jobs...`);

    let count = 0;
    for (const job of jobs) {
        const text = `${job.title} ${job.description} ${job.skills} ${job.location}`.toLowerCase();

        const skillScore = calculateSkillScore(text);
        const matched = extractSkillsFromText(text);
        const allCvSkills = [...CV_SKILLS.core, ...CV_SKILLS.testing.slice(0, 5)];
        const missing = allCvSkills.filter(s => !matched.includes(s));

        const { match: locationMatch, isRemote } = checkLocationMatch(text);
        const salary = extractSalary(text);
        const expRequired = extractExperienceYears(text);

        const relevanceScore = calculateRelevanceScore(skillScore, locationMatch, salary, expRequired);
        const atsScore = Math.round((skillScore * 0.6 + locationMatch * 0.2 + (expRequired <= CV_EXPERIENCE_YEARS ? 20 : 5)));
        const acceptanceChance = calculateAcceptanceChance(relevanceScore, skillScore, locationMatch);

        updateJob.run(
            skillScore, relevanceScore, atsScore, acceptanceChance,
            matched.join(', '), missing.slice(0, 5).join(', '), locationMatch,
            salary.min, salary.max, salary.currency, isRemote ? 1 : 0,
            expRequired, job.id
        );

        count++;
        if (count % 100 === 0) console.log(`  ✅ Analyzed ${count}/${jobs.length} jobs...`);
    }

    // Update priority ranks
    db.exec(`
    UPDATE jobs SET priority_rank = (
      SELECT COUNT(*) + 1 FROM jobs j2 
      WHERE j2.relevance_score > jobs.relevance_score
    )
  `);

    console.log(`\n🎉 Analysis complete! ${count} jobs analyzed.`);

    // Print summary statistics
    const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN acceptance_chance = 'HIGH' THEN 1 ELSE 0 END) as high_chance,
      SUM(CASE WHEN acceptance_chance = 'MEDIUM' THEN 1 ELSE 0 END) as medium_chance,
      SUM(CASE WHEN is_remote = 1 THEN 1 ELSE 0 END) as remote_jobs,
      SUM(CASE WHEN location_match >= 90 THEN 1 ELSE 0 END) as uk_remote_jobs,
      AVG(skill_score) as avg_skill_score,
      AVG(relevance_score) as avg_relevance,
      MAX(salary_max) as max_salary
    FROM jobs
  `).get();

    console.log(`\n📊 Summary Statistics:`);
    console.log(`   Total Jobs: ${stats.total}`);
    console.log(`   HIGH Acceptance Chance: ${stats.high_chance}`);
    console.log(`   MEDIUM Acceptance Chance: ${stats.medium_chance}`);
    console.log(`   Remote Jobs: ${stats.remote_jobs}`);
    console.log(`   UK/Remote Match: ${stats.uk_remote_jobs}`);
    console.log(`   Avg Skill Score: ${stats.avg_skill_score?.toFixed(1)}%`);
    console.log(`   Avg Relevance: ${stats.avg_relevance?.toFixed(1)}`);
    console.log(`   Max Salary Found: $${stats.max_salary?.toLocaleString()}`);

    // Top 10 jobs
    const topJobs = db.prepare(`
    SELECT title, company, relevance_score, ats_score, acceptance_chance, is_remote, salary_max
    FROM jobs 
    ORDER BY relevance_score DESC 
    LIMIT 10
  `).all();

    console.log(`\n🏆 Top 10 Matched Jobs:`);
    topJobs.forEach((j, i) => {
        console.log(`${i + 1}. [${j.acceptance_chance}] ${j.title.slice(0, 50)}... (${j.relevance_score}%)`);
    });

    db.close();
}

analyzeJobs().catch(console.error);

import Database from 'better-sqlite3';
import * as fs from 'fs';

const db = new Database('../jobs.db');

// CV Profile for matching
const CV_PROFILE = {
    name: 'Waseem Raza Khan',
    title: 'Staff Infrastructure & Automation Engineer',
    location: 'London, UK',
    yearsExp: 6,
    coreSkills: ['docker', 'kubernetes', 'linux', 'aws', 'ci/cd', 'python', 'github actions', 'jenkins', 'git', 'infrastructure as code', 'terraform'],
    testingSkills: ['automation', 'qa', 'testing', 'selenium', 'playwright', 'cypress', 'api testing', 'postman', 'pytest'],
    devSkills: ['javascript', 'typescript', 'react', 'vue', 'html', 'css'],
    aiMlSkills: ['ai', 'machine learning', 'ml', 'llm', 'data science', 'pytorch', 'tensorflow'],
    dbSkills: ['postgresql', 'sql', 'mongodb'],
    preferredLocations: ['uk', 'united kingdom', 'london', 'england', 'remote', 'europe', 'emea']
};

// Extract company from URL
function extractCompany(url) {
    const match = url.match(/testdevjobs\.com\/job\/([^\/]+)/);
    if (!match) return 'Unknown';

    // Parse company name from URL slug
    const slug = match[1];
    const parts = slug.split('-');

    // Common patterns: company-name-job-title-id
    // Find where job title starts (usually after known company name patterns)
    let companyParts = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].toLowerCase();
        // Stop when we hit job-related words
        if (['qa', 'engineer', 'senior', 'junior', 'lead', 'staff', 'automation', 'software', 'principal', 'manager', 'technical'].includes(part)) {
            break;
        }
        companyParts.push(parts[i]);
    }

    if (companyParts.length === 0) return 'Unknown';

    // Format company name
    return companyParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        .replace(/Gmb H/g, 'GmbH')
        .replace(/Inc$/g, 'Inc.')
        .replace(/Ltd$/g, 'Ltd.')
        .replace(/ Co$/g, ' Co.')
        .replace(/ Se$/g, ' SE');
}

// Parse location from skills/location field
function parseLocation(skills, location) {
    const combined = `${skills || ''} ${location || ''}`.toLowerCase();

    const isRemote = combined.includes('remote') || combined.includes('fully remote') || combined.includes('anywhere');
    const isHybrid = combined.includes('hybrid');

    // Extract country
    const countries = {
        'united kingdom': 'UK', 'uk': 'UK', 'london': 'UK', 'england': 'UK',
        'united states': 'US', 'usa': 'US', 'california': 'US', 'new york': 'US',
        'germany': 'Germany', 'poland': 'Poland', 'india': 'India', 'spain': 'Spain',
        'france': 'France', 'austria': 'Austria', 'netherlands': 'Netherlands',
        'israel': 'Israel', 'cyprus': 'Cyprus', 'serbia': 'Serbia', 'lithuania': 'Lithuania',
        'brazil': 'Brazil', 'portugal': 'Portugal', 'romania': 'Romania', 'greece': 'Greece',
        'europe': 'Europe', 'emea': 'Europe'
    };

    let country = 'Unknown';
    for (const [key, value] of Object.entries(countries)) {
        if (combined.includes(key)) {
            country = value;
            break;
        }
    }

    return { isRemote, isHybrid, country };
}

// Parse tech stack from skills field
function parseTechStack(skills) {
    if (!skills) return [];

    const techKeywords = [
        'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'python', 'java', 'javascript', 'typescript',
        'selenium', 'playwright', 'cypress', 'appium', 'pytest', 'jenkins', 'git', 'postman',
        'sql', 'postgresql', 'mongodb', 'react', 'vue', 'angular', 'node', 'linux', 'microservices',
        'api', 'rest', 'graphql', 'jmeter', 'gatling', 'allure', 'cucumber', 'terraform', 'ansible',
        'ai', 'machine learning', 'ml', 'android', 'ios', 'swift', 'kotlin', 'game'
    ];

    const lower = skills.toLowerCase();
    return techKeywords.filter(tech => lower.includes(tech));
}

// Calculate match score
function calculateMatch(job) {
    const techStack = parseTechStack(job.skills);
    const { isRemote, isHybrid, country } = parseLocation(job.skills, job.location);
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const combined = `${title} ${description} ${job.skills || ''}`.toLowerCase();

    let score = 0;
    let reasons = [];

    // Title match (max 30 points)
    if (title.includes('infrastructure') && title.includes('automation')) {
        score += 30;
        reasons.push('Title: Infrastructure + Automation = perfect');
    } else if (title.includes('infrastructure') || title.includes('platform')) {
        score += 20;
        reasons.push('Title: Infrastructure/Platform role');
    } else if (title.includes('automation') && title.includes('engineer')) {
        score += 18;
        reasons.push('Title: Automation Engineer');
    } else if (title.includes('senior') && (title.includes('qa') || title.includes('automation'))) {
        score += 15;
        reasons.push('Title: Senior QA/Automation');
    } else if (title.includes('staff') || title.includes('principal') || title.includes('lead')) {
        score += 12;
        reasons.push('Title: Staff/Principal/Lead level');
    } else if (title.includes('qa') || title.includes('quality')) {
        score += 10;
        reasons.push('Title: QA role');
    }

    // Core skills match (max 25 points)
    const coreMatches = CV_PROFILE.coreSkills.filter(s => techStack.includes(s) || combined.includes(s));
    score += Math.min(coreMatches.length * 3, 25);
    if (coreMatches.length > 0) reasons.push(`Core: ${coreMatches.slice(0, 5).join(', ')}`);

    // Testing skills match (max 15 points)
    const testMatches = CV_PROFILE.testingSkills.filter(s => techStack.includes(s) || combined.includes(s));
    score += Math.min(testMatches.length * 2, 15);
    if (testMatches.length > 0) reasons.push(`Test: ${testMatches.slice(0, 3).join(', ')}`);

    // AI/ML skills match (max 10 points) - MSc advantage
    const aiMatches = CV_PROFILE.aiMlSkills.filter(s => combined.includes(s));
    score += Math.min(aiMatches.length * 3, 10);
    if (aiMatches.length > 0) reasons.push(`AI/ML: ${aiMatches.join(', ')}`);

    // Location match (max 20 points)
    if (country === 'UK') {
        score += 20;
        reasons.push('Location: UK ✅');
    } else if (isRemote && (country === 'Europe' || country === 'Unknown')) {
        score += 18;
        reasons.push('Location: Remote (Europe)');
    } else if (isRemote) {
        score += 12;
        reasons.push('Location: Remote');
    } else if (country === 'Europe' && isHybrid) {
        score += 10;
        reasons.push('Location: Europe Hybrid');
    } else if (country === 'US') {
        score += 5;
        reasons.push('Location: US (visa needed)');
    } else {
        reasons.push(`Location: ${country} (relocation)`);
    }

    // Determine acceptance chance
    let chance;
    if (score >= 70) chance = 'HIGH';
    else if (score >= 50) chance = 'MEDIUM';
    else if (score >= 30) chance = 'LOW';
    else chance = 'UNLIKELY';

    return {
        score: Math.min(score, 100),
        chance,
        reasons,
        techStack,
        location: { isRemote, isHybrid, country }
    };
}

// Main analysis
async function analyzeAllJobs() {
    console.log('🔍 Starting comprehensive job analysis...\n');

    // Get all jobs
    const jobs = db.prepare(`
    SELECT id, url, title, company, location, salary, skills, description, apply_link
    FROM jobs 
    WHERE title IS NOT NULL AND title != ''
    ORDER BY id
  `).all();

    console.log(`📊 Total jobs to analyze: ${jobs.length}\n`);

    // Analyze each job
    const analyzed = jobs.map(job => {
        const company = extractCompany(job.url);
        const match = calculateMatch(job);

        return {
            id: job.id,
            title: job.title,
            company: company,
            url: job.url,
            location: match.location,
            score: match.score,
            chance: match.chance,
            reasons: match.reasons,
            techStack: match.techStack.slice(0, 10),
            hasDescription: job.description && job.description.length > 100,
            applyLink: job.apply_link || ''
        };
    });

    // Sort by score descending
    analyzed.sort((a, b) => b.score - a.score);

    // Print top 50
    console.log('🏆 TOP 50 MATCHED JOBS:\n');
    console.log('Rank | Score | Chance | Company | Title | Location');
    console.log('-'.repeat(100));

    analyzed.slice(0, 50).forEach((job, i) => {
        const loc = job.location.isRemote ? '🌐 Remote' :
            job.location.isHybrid ? '🏠 Hybrid' : '🏢 On-site';
        console.log(`${(i + 1).toString().padStart(2)} | ${job.score.toString().padStart(3)}% | ${job.chance.padEnd(8)} | ${job.company.slice(0, 20).padEnd(20)} | ${job.title.slice(0, 35).padEnd(35)} | ${loc} ${job.location.country}`);
    });

    // Stats
    const stats = {
        total: analyzed.length,
        high: analyzed.filter(j => j.chance === 'HIGH').length,
        medium: analyzed.filter(j => j.chance === 'MEDIUM').length,
        low: analyzed.filter(j => j.chance === 'LOW').length,
        unlikely: analyzed.filter(j => j.chance === 'UNLIKELY').length,
        ukJobs: analyzed.filter(j => j.location.country === 'UK').length,
        remoteJobs: analyzed.filter(j => j.location.isRemote).length
    };

    console.log('\n📈 STATISTICS:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   HIGH chance: ${stats.high}`);
    console.log(`   MEDIUM chance: ${stats.medium}`);
    console.log(`   LOW chance: ${stats.low}`);
    console.log(`   UK jobs: ${stats.ukJobs}`);
    console.log(`   Remote jobs: ${stats.remoteJobs}`);

    // Export full analysis
    fs.writeFileSync('analyzed_jobs.json', JSON.stringify(analyzed, null, 2));
    console.log('\n✅ Full analysis exported to analyzed_jobs.json');

    // Create markdown report
    let md = `# Comprehensive Job Analysis Report

**CV Profile**: Waseem Raza Khan - Staff Infrastructure & Automation Engineer
**Analysis Date**: ${new Date().toISOString().split('T')[0]}
**Total Jobs Analyzed**: ${stats.total}

## Summary Statistics

| Metric | Count |
|--------|-------|
| HIGH Acceptance Chance | ${stats.high} |
| MEDIUM Acceptance Chance | ${stats.medium} |
| LOW Acceptance Chance | ${stats.low} |
| UK-Based Jobs | ${stats.ukJobs} |
| Remote Jobs | ${stats.remoteJobs} |

---

## Top 50 Jobs by Match Score

| # | Score | Chance | Company | Title | Location |
|---|-------|--------|---------|-------|----------|
`;

    analyzed.slice(0, 50).forEach((job, i) => {
        const locIcon = job.location.isRemote ? '🌐' : job.location.isHybrid ? '🏠' : '🏢';
        const country = job.location.country === 'UK' ? '**UK** ✅' : job.location.country;
        md += `| ${i + 1} | ${job.score}% | ${job.chance} | ${job.company.slice(0, 25)} | [${job.title.slice(0, 40)}](${job.url}) | ${locIcon} ${country} |\n`;
    });

    md += `\n---\n\n## Detailed Analysis (Top 20)\n\n`;

    analyzed.slice(0, 20).forEach((job, i) => {
        md += `### ${i + 1}. ${job.company} - ${job.title.slice(0, 60)}\n\n`;
        md += `| Field | Value |\n|-------|-------|\n`;
        md += `| **Score** | ${job.score}% |\n`;
        md += `| **Chance** | ${job.chance} |\n`;
        md += `| **Location** | ${job.location.isRemote ? 'Remote' : job.location.isHybrid ? 'Hybrid' : 'On-site'} - ${job.location.country} |\n`;
        md += `| **Tech Stack** | ${job.techStack.join(', ') || 'Not specified'} |\n`;
        md += `| **Match Reasons** | ${job.reasons.join(' • ')} |\n`;
        md += `| **Link** | [Apply](${job.url}) |\n\n`;
    });

    fs.writeFileSync('comprehensive_analysis.md', md);
    console.log('✅ Markdown report exported to comprehensive_analysis.md');

    db.close();
}

analyzeAllJobs().catch(console.error);

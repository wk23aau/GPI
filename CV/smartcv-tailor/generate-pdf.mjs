import puppeteer from 'puppeteer';
import fs from 'fs';

// Read the tailored resume data
const { INITIAL_RESUME } = await import('./constants.js');
const resume = INITIAL_RESUME;

// Generate HTML with proper styling
const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Source Sans Pro', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.25;
      color: #333;
      padding: 0.2in 0.5in 0.3in 0.5in;
    }
    
    .header {
      text-align: center;
      margin-bottom: 12px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
    }
    
    .name {
      font-size: 18pt;
      font-weight: 700;
      color: #1e40af;
      letter-spacing: 1px;
    }
    
    .title {
      font-size: 12pt;
      font-weight: 600;
      color: #4b5563;
      margin-top: 2px;
    }
    
    .contact {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 4px;
    }
    
    .section {
      margin-bottom: 6px;
    }
    
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1e40af;
      border-bottom: 1px solid #dbeafe;
      padding-bottom: 2px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary {
      font-size: 9.5pt;
      color: #4b5563;
      text-align: justify;
    }
    
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
    }
    
    .skill-category {
      font-size: 9pt;
    }
    
    .skill-category strong {
      color: #1f2937;
    }
    
    .skill-items {
      color: #4b5563;
    }
    
    .experience-item {
      margin-bottom: 6px;
    }
    
    .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    
    .exp-company {
      font-weight: 700;
      font-size: 10pt;
      color: #1f2937;
    }
    
    .exp-location {
      font-size: 9pt;
      color: #6b7280;
    }
    
    .exp-role {
      font-weight: 600;
      font-size: 9.5pt;
      color: #2563eb;
    }
    
    .exp-dates {
      font-size: 9pt;
      color: #6b7280;
    }
    
    .exp-bullets {
      margin-top: 3px;
      padding-left: 14px;
    }
    
    .exp-bullets li {
      font-size: 9pt;
      margin-bottom: 2px;
      color: #374151;
    }
    
    .education-item {
      margin-bottom: 6px;
    }
    
    .edu-header {
      display: flex;
      justify-content: space-between;
    }
    
    .edu-degree {
      font-weight: 600;
      font-size: 9.5pt;
    }
    
    .edu-dates {
      font-size: 9pt;
      color: #6b7280;
    }
    
    .edu-institution {
      font-size: 9pt;
      color: #4b5563;
    }
    
    .edu-details {
      font-size: 8.5pt;
      color: #6b7280;
    }
    
    .additional {
      font-size: 9pt;
      color: #4b5563;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${resume.personalInfo.name}</div>
    <div class="title">${resume.personalInfo.title}</div>
    <div class="contact">${resume.personalInfo.address} | ${resume.personalInfo.phone} | ${resume.personalInfo.email}</div>
  </div>

  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${resume.summary}</div>
  </div>

  <div class="section">
    <div class="section-title">Technical Skills</div>
    <div class="skills-grid">
      ${resume.skills.map(s => `
        <div class="skill-category">
          <strong>${s.category}:</strong>
          <span class="skill-items">${s.items.join(', ')}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Professional Experience</div>
    ${resume.experience.map(exp => `
      <div class="experience-item">
        <div class="exp-header">
          <span class="exp-company">${exp.company}</span>
          <span class="exp-location">${exp.location}</span>
        </div>
        <div class="exp-header">
          <span class="exp-role">${exp.role}</span>
          <span class="exp-dates">${exp.dates}</span>
        </div>
        <ul class="exp-bullets">
          ${exp.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Education</div>
    ${resume.education.map(edu => `
      <div class="education-item">
        <div class="edu-header">
          <span class="edu-degree">${edu.degree}</span>
          <span class="edu-dates">${edu.dates}</span>
        </div>
        <div class="edu-institution">${edu.institution} | ${edu.location}</div>
        ${edu.details.map(d => `<div class="edu-details">${d}</div>`).join('')}
      </div>
    `).join('')}
  </div>

  ${resume.additionalInfo ? `
    <div class="section">
      <div class="additional">${resume.additionalInfo.join(' | ')}</div>
    </div>
  ` : ''}
</body>
</html>
`;

// Generate PDF
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });

const jobName = process.argv[2] || 'tailored';
const outputPath = `./output/${jobName}.pdf`;

// Ensure output directory exists
if (!fs.existsSync('./output')) {
  fs.mkdirSync('./output');
}

await page.pdf({
  path: outputPath,
  format: 'A4',
  margin: { top: '0.5in', bottom: '0.5in', left: '0', right: '0' },
  printBackground: true
});

await browser.close();
console.log(`✅ PDF generated: ${outputPath}`);

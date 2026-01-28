# Job Search Automation Prompt

Use this prompt with `cdp-flow.js` or the REPL to automate job searching.

---

## The Prompt

```
Search for QA (Quality Assurance) jobs on 5 major UK job websites. Find 10 jobs total (2 from each site).

**Websites to search:**
1. Indeed UK - https://uk.indeed.com
2. LinkedIn Jobs - https://www.linkedin.com/jobs
3. Reed - https://www.reed.co.uk
4. Totaljobs - https://www.totaljobs.com
5. Glassdoor UK - https://www.glassdoor.co.uk

**Search criteria:**
- Job title: "QA Engineer" OR "Quality Assurance" OR "QA Tester" OR "Test Engineer"
- Location: United Kingdom (remote preferred)
- Experience level: Entry to Mid-level
- Posted: Last 7 days

**For each job, extract:**
1. Job title
2. Company name
3. Location (city or remote)
4. Salary (if shown)
5. Direct link to apply
6. Key requirements (top 3)

**Output format:**
Create a markdown table with all 10 jobs sorted by salary (highest first).

**Process:**
1. Open Chrome browser (it should already be running with remote debugging on port 9223)
2. For each website:
   - Navigate to the job search page
   - Enter search terms: "QA Engineer"
   - Set location filter to UK
   - Sort by date (newest first)
   - Extract details from the first 2 relevant jobs
3. Compile results into a single table
4. Save the results to a file: job-results.md

Start with Indeed UK, then proceed to the other sites in order.
```

---

## How to Use

### Option 1: Using cdp-flow.js (automated)
Edit the PROMPT constant in `cdp-flow.js` with the above text, then run:
```bash
cd GPI/xAPI
node cdp-flow.js
```

### Option 2: Using REPL (manual)
```bash
cd GPI/xAPI
node repl.js
```
Then type:
```
newchat
send <paste the prompt above>
```
Use `accept` to approve each browser action as the agent executes.

---

## Prerequisites

1. **Chrome with remote debugging:**
   ```bash
   Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9223"
   ```

2. **CDP REPL running:**
   ```bash
   cd GPI/extras/TEAM && node index.js
   ```

3. **Antigravity with CDP enabled:**
   ```bash
   --remote-debugging-port=9222
   ```

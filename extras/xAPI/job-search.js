/**
 * Job Search Agent Spawner
 * Sends a comprehensive prompt to find jobs across multiple websites
 */
import { AntigravityClient } from './xapi.js';

const PROMPT = `You are a JOB SEARCH AUTOMATION AGENT. DO NOT ASK QUESTIONS - EXECUTE IMMEDIATELY.

MISSION: Visit 5 different job websites and collect 10 job listings total (2 per site).

STEP 1 - LAUNCH CHROME WITH CDP DEBUG PORT:
run_command({ CommandLine: "start chrome --remote-debugging-port=9222 --user-data-dir=C:/temp/chrome-debug https://indeed.com", Cwd: "C:/", WaitMsBeforeAsync: 3000, SafeToAutoRun: true })

STEP 2 - START CDP REPL (after Chrome opens):
run_command({ CommandLine: "node index.js", Cwd: "c:/Users/wk23aau/Documents/GPI/extras/TEAM", WaitMsBeforeAsync: 5000, SafeToAutoRun: true })

STEP 3 - USE REPL COMMANDS via send_command_input:
- __cdp.ui() shows clickable elements with X,Y coordinates
- Page.navigate {"url":"https://indeed.com"} navigates to URL
- Input.dispatchMouseEvent {"type":"mousePressed","x":300,"y":200,"button":"left","clickCount":1} then Input.dispatchMouseEvent {"type":"mouseReleased","x":300,"y":200,"button":"left"} clicks
- Input.insertText {"text":"software engineer"} types text

JOB SITES (visit 5): indeed.com, linkedin.com/jobs, glassdoor.com, monster.com, ziprecruiter.com

WORKFLOW PER SITE:
1. Navigate to site
2. __cdp.ui() to see elements
3. Click search box, type "software engineer", submit
4. Extract 2 jobs: title, company, URL
5. Next site

OUTPUT: Create jobs.md with table of all 10 jobs found.

START NOW - Execute Step 1 to launch Chrome.`;

async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  Job Search Agent Spawner                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const client = new AntigravityClient();

    try {
        const target = await client.connect();
        console.log(`✓ Connected: ${target.title?.substring(0, 50)}`);

        // Open new chat
        console.log('📝 Opening new chat...');
        await client.newChat();
        await new Promise(r => setTimeout(r, 1500));

        // Focus chat and type message
        console.log('📤 Sending job search task...');
        await client.focusChat();
        await new Promise(r => setTimeout(r, 200));

        // Type the prompt
        await client.typeText(PROMPT);
        await new Promise(r => setTimeout(r, 100));

        // Press Enter to send
        await client.pressKey('Enter');

        console.log('✓ Task sent!');
        console.log('\nThe agent should now:');
        console.log('1. Launch Chrome with CDP debugging');
        console.log('2. Start the CDP REPL');
        console.log('3. Automate job searches on 5 sites');
        console.log('4. Create jobs.md with 10 listings');

        client.close();

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
}

main();

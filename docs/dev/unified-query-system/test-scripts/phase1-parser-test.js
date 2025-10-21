/**
 * Phase 1: Simple Property Parser Tests
 * 
 * Run with: node test-scripts/phase1-parser-test.js
 */

// Mock SimplePropertyParser for testing
class SimplePropertyParser {
    static parse(query) {
        const result = {};
        
        // Priority: P1-P4
        const priorityMatch = query.match(/\b[pP]([1-4])\b/);
        if (priorityMatch) {
            result.priority = parseInt(priorityMatch[1]);
        }
        
        // Date shortcuts
        if (/\btoday\b/i.test(query)) {
            result.dueDate = "today";
        } else if (/\btomorrow\b/i.test(query)) {
            result.dueDate = "tomorrow";
        } else if (/\b(overdue|od)\b/i.test(query)) {
            result.dueDate = "overdue";
        } else {
            const relMatch = query.match(/\b(\d+)([dwm])\b/);
            if (relMatch) {
                result.dueDate = `+${relMatch[1]}${relMatch[2]}`;
            }
        }
        
        // Date ranges
        const rangeMatch = query.match(/date\s+(before|after):\s*([^\s&|]+)/i);
        if (rangeMatch) {
            const operator = rangeMatch[1].toLowerCase();
            const dateStr = rangeMatch[2].trim();
            result.dueDateRange = operator === "before" 
                ? { end: dateStr }
                : { start: dateStr };
        }
        
        // Tags
        const tagMatches = [...query.matchAll(/#(\w+)/g)];
        if (tagMatches.length > 0) {
            result.tags = tagMatches.map(m => m[1]);
        }
        
        // Folder
        const folderMatch = query.match(/folder:\s*["']([^"']+)["']/i);
        if (folderMatch) {
            result.folder = folderMatch[1];
        }
        
        return result;
    }
    
    static extractKeywords(query) {
        let remaining = query;
        
        // Remove property tokens
        remaining = remaining.replace(/\b[pP][1-4]\b/g, '');
        remaining = remaining.replace(/\b(today|tomorrow|overdue|od)\b/gi, '');
        remaining = remaining.replace(/\b\d+[dwm]\b/g, '');
        remaining = remaining.replace(/date\s+(before|after):[^\s&|]+/gi, '');
        remaining = remaining.replace(/#\w+/g, '');
        remaining = remaining.replace(/folder:\s*["'][^"']+["']/gi, '');
        
        // Extract keywords
        return remaining
            .split(/[\s&|!()]+/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k.length > 0);
    }
}

// Test Runner
class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }
    
    test(name, actual, expected) {
        const pass = JSON.stringify(actual) === JSON.stringify(expected);
        if (pass) {
            this.passed++;
            console.log(`✅ ${name}`);
        } else {
            this.failed++;
            console.log(`❌ ${name}`);
            console.log(`   Expected: ${JSON.stringify(expected)}`);
            console.log(`   Actual:   ${JSON.stringify(actual)}`);
        }
        this.results.push({ name, pass, expected, actual });
    }
    
    summary() {
        const total = this.passed + this.failed;
        const percentage = ((this.passed / total) * 100).toFixed(1);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 Test Summary`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Total:  ${total} tests`);
        console.log(`Passed: ${this.passed} (${percentage}%)`);
        console.log(`Failed: ${this.failed}`);
        console.log(`${'='.repeat(60)}\n`);
        
        if (this.failed === 0) {
            console.log(`🎉 All tests passed! Ready for integration.`);
        } else {
            console.log(`⚠️  ${this.failed} test(s) failed. Please fix before proceeding.`);
        }
    }
}

// Run Tests
function runTests() {
    const runner = new TestRunner();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Phase 1: Simple Property Parser Tests`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Test Suite 1: Priority Extraction
    console.log(`\n📋 Test Suite 1: Priority Extraction`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Priority P1",
        SimplePropertyParser.parse("bug P1 overdue"),
        { priority: 1, dueDate: "overdue" }
    );
    
    runner.test(
        "Priority p2 (lowercase)",
        SimplePropertyParser.parse("feature p2 urgent"),
        { priority: 2 }
    );
    
    runner.test(
        "Priority P3",
        SimplePropertyParser.parse("task P3"),
        { priority: 3 }
    );
    
    runner.test(
        "Priority p4",
        SimplePropertyParser.parse("item p4"),
        { priority: 4 }
    );
    
    runner.test(
        "No priority",
        SimplePropertyParser.parse("no priority here"),
        {}
    );
    
    // Test Suite 2: Date Extraction
    console.log(`\n📅 Test Suite 2: Date Extraction`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Date: today",
        SimplePropertyParser.parse("meeting today"),
        { dueDate: "today" }
    );
    
    runner.test(
        "Date: tomorrow",
        SimplePropertyParser.parse("task tomorrow"),
        { dueDate: "tomorrow" }
    );
    
    runner.test(
        "Date: overdue",
        SimplePropertyParser.parse("bug overdue"),
        { dueDate: "overdue" }
    );
    
    runner.test(
        "Date: od (overdue shorthand)",
        SimplePropertyParser.parse("task od"),
        { dueDate: "overdue" }
    );
    
    runner.test(
        "Date: 1d (relative)",
        SimplePropertyParser.parse("item 1d"),
        { dueDate: "+1d" }
    );
    
    runner.test(
        "Date: 2w (relative)",
        SimplePropertyParser.parse("feature 2w"),
        { dueDate: "+2w" }
    );
    
    runner.test(
        "Date: 3m (relative)",
        SimplePropertyParser.parse("project 3m"),
        { dueDate: "+3m" }
    );
    
    // Test Suite 3: Date Ranges
    console.log(`\n📆 Test Suite 3: Date Ranges`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Date before",
        SimplePropertyParser.parse("date before: 2025-10-25"),
        { dueDateRange: { end: "2025-10-25" } }
    );
    
    runner.test(
        "Date after",
        SimplePropertyParser.parse("date after: 2025-10-20"),
        { dueDateRange: { start: "2025-10-20" } }
    );
    
    // Test Suite 4: Tags
    console.log(`\n🏷️  Test Suite 4: Tags`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Single tag",
        SimplePropertyParser.parse("task #urgent"),
        { tags: ["urgent"] }
    );
    
    runner.test(
        "Multiple tags",
        SimplePropertyParser.parse("bug #critical #backend"),
        { tags: ["critical", "backend"] }
    );
    
    // Test Suite 5: Folder
    console.log(`\n📁 Test Suite 5: Folder`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Folder with double quotes",
        SimplePropertyParser.parse('folder:"Projects/Work"'),
        { folder: "Projects/Work" }
    );
    
    runner.test(
        "Folder with single quotes",
        SimplePropertyParser.parse("folder:'Tasks/Dev'"),
        { folder: "Tasks/Dev" }
    );
    
    // Test Suite 6: Keyword Extraction
    console.log(`\n🔤 Test Suite 6: Keyword Extraction`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Keywords with properties",
        SimplePropertyParser.extractKeywords("bug P1 overdue"),
        ["bug"]
    );
    
    runner.test(
        "Multiple keywords",
        SimplePropertyParser.extractKeywords("fix critical bug P1"),
        ["fix", "critical", "bug"]
    );
    
    runner.test(
        "Chinese keywords",
        SimplePropertyParser.extractKeywords("开发 Task Chat"),
        ["开发", "task", "chat"]
    );
    
    runner.test(
        "Only properties (no keywords)",
        SimplePropertyParser.extractKeywords("#urgent P1 today"),
        []
    );
    
    // Test Suite 7: Complex Queries
    console.log(`\n🔧 Test Suite 7: Complex Queries`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Complex: keywords + priority + date + tags",
        SimplePropertyParser.parse("fix bug P1 overdue #critical"),
        { 
            priority: 1, 
            dueDate: "overdue",
            tags: ["critical"]
        }
    );
    
    runner.test(
        "Complex: keywords extraction",
        SimplePropertyParser.extractKeywords("fix bug P1 overdue #critical"),
        ["fix", "bug"]
    );
    
    runner.test(
        "Complex: all property types",
        SimplePropertyParser.parse('urgent P1 today #dev folder:"Projects/TaskChat"'),
        {
            priority: 1,
            dueDate: "today",
            tags: ["dev"],
            folder: "Projects/TaskChat"
        }
    );
    
    // Summary
    runner.summary();
    
    return runner.failed === 0;
}

// Execute
const success = runTests();
process.exit(success ? 0 : 1);

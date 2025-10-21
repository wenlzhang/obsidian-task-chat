/**
 * Phase 1 Enhanced Tests: Date Range Extraction + Structured Logging
 * 
 * Run with: node docs/dev/unified-query-system/test-scripts/phase1-enhanced-test.js
 */

// Mock enhanced SimplePropertyParser with date range support
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
        
        // Date ranges (NEW: Enhancement #1)
        const dueDateRange = this.extractDueDateRange(query);
        if (dueDateRange) {
            result.dueDateRange = dueDateRange;
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
    
    static extractDueDateRange(query) {
        const lowerQuery = query.toLowerCase();
        
        // Pattern 1: "before YYYY-MM-DD" or "date before: YYYY-MM-DD"
        const beforeMatch = lowerQuery.match(/(?:date\s+)?before[:\s]+(\d{4}-\d{2}-\d{2})/);
        if (beforeMatch) {
            return { end: beforeMatch[1] };
        }
        
        // Pattern 2: "after YYYY-MM-DD" or "date after: YYYY-MM-DD"
        const afterMatch = lowerQuery.match(/(?:date\s+)?after[:\s]+(\d{4}-\d{2}-\d{2})/);
        if (afterMatch) {
            return { start: afterMatch[1] };
        }
        
        // Pattern 3: "from YYYY-MM-DD to YYYY-MM-DD"
        const betweenMatch = lowerQuery.match(/from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
        if (betweenMatch) {
            return { start: betweenMatch[1], end: betweenMatch[2] };
        }
        
        return null;
    }
    
    static extractKeywords(query) {
        let remaining = query;
        
        // Remove property tokens
        remaining = remaining.replace(/\b[pP][1-4]\b/g, '');
        remaining = remaining.replace(/\b(today|tomorrow|overdue|od)\b/gi, '');
        remaining = remaining.replace(/\b\d+[dwm]\b/g, '');
        
        // Remove date range patterns (NEW)
        remaining = remaining.replace(/(?:date\s+)?(?:before|after)[:\s]+\d{4}-\d{2}-\d{2}/gi, '');
        remaining = remaining.replace(/from\s+\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}/gi, '');
        
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
            console.log(`🎉 All tests passed! Enhancement #1 working correctly.`);
        } else {
            console.log(`⚠️  ${this.failed} test(s) failed. Please fix before proceeding.`);
        }
    }
}

// Run Tests
function runTests() {
    const runner = new TestRunner();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Phase 1 Enhanced Tests: Date Range Extraction`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Test Suite 1: Date Range Extraction (NEW)
    console.log(`\n📆 Test Suite 1: Date Range Extraction (Enhancement #1)`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Before date pattern",
        SimplePropertyParser.parse("tasks before 2025-12-31"),
        { dueDateRange: { end: "2025-12-31" } }
    );
    
    runner.test(
        "Before date with 'date' keyword",
        SimplePropertyParser.parse("date before: 2025-12-31"),
        { dueDateRange: { end: "2025-12-31" } }
    );
    
    runner.test(
        "After date pattern",
        SimplePropertyParser.parse("tasks after 2025-01-01"),
        { dueDateRange: { start: "2025-01-01" } }
    );
    
    runner.test(
        "After date with 'date' keyword",
        SimplePropertyParser.parse("date after: 2025-01-01"),
        { dueDateRange: { start: "2025-01-01" } }
    );
    
    runner.test(
        "From...to date range",
        SimplePropertyParser.parse("from 2025-01-01 to 2025-06-30"),
        { dueDateRange: { start: "2025-01-01", end: "2025-06-30" } }
    );
    
    runner.test(
        "No date range",
        SimplePropertyParser.parse("regular task P1"),
        { priority: 1 }
    );
    
    // Test Suite 2: Combined with other properties
    console.log(`\n🔧 Test Suite 2: Date Range + Other Properties`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Date range + priority",
        SimplePropertyParser.parse("bug P1 before 2025-12-31"),
        { priority: 1, dueDateRange: { end: "2025-12-31" } }
    );
    
    runner.test(
        "Date range + tags",
        SimplePropertyParser.parse("tasks after 2025-01-01 #urgent"),
        { dueDateRange: { start: "2025-01-01" }, tags: ["urgent"] }
    );
    
    runner.test(
        "Date range + folder",
        SimplePropertyParser.parse('from 2025-01-01 to 2025-06-30 folder:"Work"'),
        { dueDateRange: { start: "2025-01-01", end: "2025-06-30" }, folder: "Work" }
    );
    
    // Test Suite 3: Keyword Extraction with Date Ranges
    console.log(`\n🔤 Test Suite 3: Keyword Extraction (Date Range Removal)`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Keywords with 'before' removed",
        SimplePropertyParser.extractKeywords("bug fix before 2025-12-31"),
        ["bug", "fix"]
    );
    
    runner.test(
        "Keywords with 'after' removed",
        SimplePropertyParser.extractKeywords("feature after 2025-01-01"),
        ["feature"]
    );
    
    runner.test(
        "Keywords with 'from...to' removed",
        SimplePropertyParser.extractKeywords("tasks from 2025-01-01 to 2025-06-30"),
        ["tasks"]
    );
    
    runner.test(
        "Complex query with all filters",
        SimplePropertyParser.extractKeywords("fix critical bug P1 before 2025-12-31 #urgent"),
        ["fix", "critical", "bug"]
    );
    
    // Test Suite 4: Edge Cases
    console.log(`\n🎯 Test Suite 4: Edge Cases`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Multiple date patterns (first one wins)",
        SimplePropertyParser.parse("before 2025-12-31 and after 2025-01-01"),
        { dueDateRange: { end: "2025-12-31" } } // First match wins
    );
    
    runner.test(
        "Case insensitive",
        SimplePropertyParser.parse("BEFORE 2025-12-31"),
        { dueDateRange: { end: "2025-12-31" } }
    );
    
    runner.test(
        "Date range with extra spaces",
        SimplePropertyParser.parse("date before:   2025-12-31"),
        { dueDateRange: { end: "2025-12-31" } }
    );
    
    // Summary
    runner.summary();
    
    return runner.failed === 0;
}

// Execute
const success = runTests();
process.exit(success ? 0 : 1);

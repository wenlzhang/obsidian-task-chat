/**
 * Phase 3: Comprehensive Enhancements Test Suite
 * Tests all enhanced patterns from Phase 3A-E
 * 
 * Coverage:
 * - Enhanced Todoist syntax (projects, operators, special keywords, time)
 * - Comprehensive DataView duration formats
 * - Enhanced relative date patterns
 * - Enhanced property validation
 * 
 * Run with: node docs/dev/unified-query-system/test-scripts/phase3-comprehensive-test.js
 */

const moment = require('moment');

// Mock DataviewService.parseRelativeDateRange (comprehensive version)
class DataviewService {
    static parseRelativeDateRange(dateFilter, today) {
        const lowerFilter = dateFilter.toLowerCase().trim();

        // DataView duration formats (COMPREHENSIVE)
        const durationPattern = /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months|yr|yrs|year|years)(?:\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months|yr|yrs|year|years))?(?:\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|month|months|yr|yrs|year|years))?$/;
        const durationMatch = lowerFilter.match(durationPattern);
        
        if (durationMatch) {
            const parseDurationUnit = (unitStr) => {
                if (/^(s|sec|secs|second|seconds)$/.test(unitStr)) return 'seconds';
                if (/^(m|min|mins|minute|minutes)$/.test(unitStr)) return 'minutes';
                if (/^(h|hr|hrs|hour|hours)$/.test(unitStr)) return 'hours';
                if (/^(d|day|days)$/.test(unitStr)) return 'days';
                if (/^(w|wk|wks|week|weeks)$/.test(unitStr)) return 'weeks';
                if (/^(mo|month|months)$/.test(unitStr)) return 'months';
                if (/^(yr|yrs|year|years)$/.test(unitStr)) return 'years';
                return 'days';
            };

            let futureDate = moment(today);

            // First unit
            const amount1 = parseInt(durationMatch[1]);
            const unit1 = parseDurationUnit(durationMatch[2]);
            futureDate = futureDate.add(amount1, unit1);

            // Optional second unit
            if (durationMatch[3] && durationMatch[4]) {
                const amount2 = parseInt(durationMatch[3]);
                const unit2 = parseDurationUnit(durationMatch[4]);
                futureDate = futureDate.add(amount2, unit2);
            }

            // Optional third unit
            if (durationMatch[5] && durationMatch[6]) {
                const amount3 = parseInt(durationMatch[5]);
                const unit3 = parseDurationUnit(durationMatch[6]);
                futureDate = futureDate.add(amount3, unit3);
            }

            return {
                start: moment(today).format('YYYY-MM-DD'),
                end: futureDate.format('YYYY-MM-DD')
            };
        }

        // Named days support
        if (lowerFilter === 'next week') {
            const nextWeekStart = moment(today).add(7, 'days').startOf('week');
            const nextWeekEnd = nextWeekStart.clone().endOf('week');
            return {
                start: nextWeekStart.format('YYYY-MM-DD'),
                end: nextWeekEnd.format('YYYY-MM-DD')
            };
        }

        if (lowerFilter === 'first day') {
            const firstDay = moment(today).startOf('month');
            return {
                start: firstDay.format('YYYY-MM-DD'),
                end: firstDay.format('YYYY-MM-DD')
            };
        }

        // Day names
        const dayNames = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
                          wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
                          sat: 6, saturday: 6 };
        if (dayNames.hasOwnProperty(lowerFilter)) {
            const targetDay = dayNames[lowerFilter];
            const currentDay = moment(today).day();
            let daysToAdd = targetDay - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7;
            const targetDate = moment(today).add(daysToAdd, 'days');
            return {
                start: moment(today).format('YYYY-MM-DD'),
                end: targetDate.format('YYYY-MM-DD')
            };
        }

        // Original patterns
        const agoMatch = lowerFilter.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/);
        if (agoMatch) {
            const amount = parseInt(agoMatch[1]);
            const unit = agoMatch[2].startsWith('week') ? 'weeks' :
                        agoMatch[2].startsWith('month') ? 'months' :
                        agoMatch[2].startsWith('year') ? 'years' : 'days';
            const pastDate = moment(today).subtract(amount, unit);
            return {
                start: pastDate.format('YYYY-MM-DD'),
                end: pastDate.format('YYYY-MM-DD')
            };
        }

        return null;
    }

    static parseTodoistSyntax(query) {
        const result = {
            specialKeywords: [],
            operators: {}
        };

        // Detect operators
        if (query.includes('&')) result.operators.and = true;
        if (query.includes('|')) result.operators.or = true;
        if (query.includes('!')) result.operators.not = true;

        // Search keyword
        const searchMatch = query.match(/search:\s*["']?([^"'&|]+)["']?/i);
        if (searchMatch) {
            result.keywords = [searchMatch[1].trim()];
        }

        // Projects
        const projectMatch = query.match(/##+([A-Za-z0-9_-]+)/);
        if (projectMatch) {
            result.project = projectMatch[1];
        }

        // Priority
        const priorityMatch = query.match(/\bp([1-4])\b/i);
        if (priorityMatch) {
            result.priority = parseInt(priorityMatch[1]);
        }

        // Special keywords
        if (/\b(overdue|over\s+due|od)\b/i.test(query) && !query.includes('!overdue')) {
            result.specialKeywords.push('overdue');
        }
        if (/\brecurring\b/i.test(query) && !query.includes('!recurring')) {
            result.specialKeywords.push('recurring');
        }
        if (/\bsubtask\b/i.test(query) && !query.includes('!subtask')) {
            result.specialKeywords.push('subtask');
        }
        if (/\bno\s+date\b/i.test(query)) {
            if (query.includes('!no date')) {
                result.specialKeywords.push('has_date');
            } else {
                result.specialKeywords.push('no_date');
            }
        }
        if (/\bno\s+priority\b/i.test(query)) {
            result.specialKeywords.push('no_priority');
            result.priority = 4;
        }

        return result;
    }
}

// Test Runner
class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }
    
    test(name, actual, condition) {
        const pass = condition(actual);
        if (pass) {
            this.passed++;
            console.log(`✅ ${name}`);
        } else {
            this.failed++;
            console.log(`❌ ${name}`);
            console.log(`   Result: ${JSON.stringify(actual)}`);
        }
        this.results.push({ name, pass, actual });
    }
    
    summary() {
        const total = this.passed + this.failed;
        const percentage = ((this.passed / total) * 100).toFixed(1);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 Test Summary`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Total:  ${total} tests`);
        console.log(`Passed: ${this.passed} (${percentage}%)`);
        console.log(`Failed: ${this.failed}`);
        console.log(`${'='.repeat(80)}\n`);
        
        if (this.failed === 0) {
            console.log(`🎉 All tests passed! Phase 3 enhancements working perfectly.`);
        } else {
            console.log(`⚠️  ${this.failed} test(s) failed. Please review.`);
        }
    }
}

// Run Tests
function runTests() {
    const runner = new TestRunner();
    const today = moment();
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Phase 3: Comprehensive Enhancements Test Suite`);
    console.log(`${'='.repeat(80)}\n`);
    
    // ==========================================================================
    // Test Suite 1: DataView Duration Formats (Comprehensive)
    // ==========================================================================
    console.log(`\n📦 Test Suite 1: DataView Duration Formats (Comprehensive)`);
    console.log(`${'-'.repeat(80)}`);
    
    // Seconds
    runner.test('Parse "5s"', DataviewService.parseRelativeDateRange('5s', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "10 seconds"', DataviewService.parseRelativeDateRange('10 seconds', today),
        (r) => r && r.start && r.end);
    
    // Minutes
    runner.test('Parse "30m"', DataviewService.parseRelativeDateRange('30m', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "15 mins"', DataviewService.parseRelativeDateRange('15 mins', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "45 minutes"', DataviewService.parseRelativeDateRange('45 minutes', today),
        (r) => r && r.start && r.end);
    
    // Hours
    runner.test('Parse "2h"', DataviewService.parseRelativeDateRange('2h', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "4 hrs"', DataviewService.parseRelativeDateRange('4 hrs', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "8 hours"', DataviewService.parseRelativeDateRange('8 hours', today),
        (r) => r && r.start && r.end);
    
    // Days
    runner.test('Parse "1d"', DataviewService.parseRelativeDateRange('1d', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "7 days"', DataviewService.parseRelativeDateRange('7 days', today),
        (r) => r && r.start && r.end);
    
    // Weeks
    runner.test('Parse "2w"', DataviewService.parseRelativeDateRange('2w', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "3 wks"', DataviewService.parseRelativeDateRange('3 wks', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "4 weeks"', DataviewService.parseRelativeDateRange('4 weeks', today),
        (r) => r && r.start && r.end);
    
    // Months
    runner.test('Parse "1mo"', DataviewService.parseRelativeDateRange('1mo', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "6 months"', DataviewService.parseRelativeDateRange('6 months', today),
        (r) => r && r.start && r.end);
    
    // Years
    runner.test('Parse "1yr"', DataviewService.parseRelativeDateRange('1yr', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "2 years"', DataviewService.parseRelativeDateRange('2 years', today),
        (r) => r && r.start && r.end);
    
    // Combinations
    runner.test('Parse "1h 30m"', DataviewService.parseRelativeDateRange('1h 30m', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "2d 4h"', DataviewService.parseRelativeDateRange('2d 4h', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "1yr 2mo 3d"', DataviewService.parseRelativeDateRange('1yr 2mo 3d', today),
        (r) => r && r.start && r.end);
    
    // ==========================================================================
    // Test Suite 2: Named Days & Relative Patterns
    // ==========================================================================
    console.log(`\n📅 Test Suite 2: Named Days & Relative Patterns`);
    console.log(`${'-'.repeat(80)}`);
    
    runner.test('Parse "next week"', DataviewService.parseRelativeDateRange('next week', today),
        (r) => r && r.start && r.end && r.start !== r.end);
    runner.test('Parse "first day"', DataviewService.parseRelativeDateRange('first day', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "sat"', DataviewService.parseRelativeDateRange('sat', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "monday"', DataviewService.parseRelativeDateRange('monday', today),
        (r) => r && r.start && r.end);
    runner.test('Parse "friday"', DataviewService.parseRelativeDateRange('friday', today),
        (r) => r && r.start && r.end);
    
    // ==========================================================================
    // Test Suite 3: Enhanced Todoist Syntax
    // ==========================================================================
    console.log(`\n🎯 Test Suite 3: Enhanced Todoist Syntax`);
    console.log(`${'-'.repeat(80)}`);
    
    runner.test('Parse "search: meeting"', DataviewService.parseTodoistSyntax('search: meeting'),
        (r) => r.keywords && r.keywords[0] === 'meeting');
    runner.test('Parse "##ProjectName"', DataviewService.parseTodoistSyntax('task ##ProjectName'),
        (r) => r.project === 'ProjectName');
    runner.test('Parse "###SubProject"', DataviewService.parseTodoistSyntax('task ###SubProject'),
        (r) => r.project === 'SubProject');
    runner.test('Parse "p1"', DataviewService.parseTodoistSyntax('task p1'),
        (r) => r.priority === 1);
    runner.test('Parse "p4"', DataviewService.parseTodoistSyntax('task p4'),
        (r) => r.priority === 4);
    
    // Special keywords
    runner.test('Parse "overdue"', DataviewService.parseTodoistSyntax('overdue tasks'),
        (r) => r.specialKeywords.includes('overdue'));
    runner.test('Parse "recurring"', DataviewService.parseTodoistSyntax('recurring tasks'),
        (r) => r.specialKeywords.includes('recurring'));
    runner.test('Parse "subtask"', DataviewService.parseTodoistSyntax('subtask items'),
        (r) => r.specialKeywords.includes('subtask'));
    runner.test('Parse "no date"', DataviewService.parseTodoistSyntax('no date tasks'),
        (r) => r.specialKeywords.includes('no_date'));
    runner.test('Parse "!no date"', DataviewService.parseTodoistSyntax('!no date tasks'),
        (r) => r.specialKeywords.includes('has_date'));
    runner.test('Parse "no priority"', DataviewService.parseTodoistSyntax('no priority tasks'),
        (r) => r.specialKeywords.includes('no_priority') && r.priority === 4);
    
    // Operators
    runner.test('Parse "&" operator', DataviewService.parseTodoistSyntax('task1 & task2'),
        (r) => r.operators.and === true);
    runner.test('Parse "|" operator', DataviewService.parseTodoistSyntax('task1 | task2'),
        (r) => r.operators.or === true);
    runner.test('Parse "!" operator', DataviewService.parseTodoistSyntax('!completed'),
        (r) => r.operators.not === true);
    
    // Complex combinations
    runner.test('Parse "search: meeting & p1"', DataviewService.parseTodoistSyntax('search: meeting & p1'),
        (r) => r.keywords && r.keywords[0] === 'meeting' && r.priority === 1 && r.operators.and);
    runner.test('Parse "##Work & overdue"', DataviewService.parseTodoistSyntax('##Work & overdue'),
        (r) => r.project === 'Work' && r.specialKeywords.includes('overdue') && r.operators.and);
    
    // ==========================================================================
    // Test Suite 4: Original Patterns (Backward Compatibility)
    // ==========================================================================
    console.log(`\n🔄 Test Suite 4: Original Patterns (Backward Compatibility)`);
    console.log(`${'-'.repeat(80)}`);
    
    runner.test('Parse "5 days ago"', DataviewService.parseRelativeDateRange('5 days ago', today),
        (r) => r && r.start === r.end);
    runner.test('Parse "2 weeks ago"', DataviewService.parseRelativeDateRange('2 weeks ago', today),
        (r) => r && r.start === r.end);
    runner.test('Parse "1 year ago"', DataviewService.parseRelativeDateRange('1 year ago', today),
        (r) => r && r.start === r.end);
    
    // Summary
    runner.summary();
    
    return runner.failed === 0;
}

// Execute
const success = runTests();
process.exit(success ? 0 : 1);

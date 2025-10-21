/**
 * Phase 3: Optional Enhancements Tests
 * Tests Enhancement #3 (Relative Date Enhancements) and Enhancement #4 (Property Validation)
 * 
 * Run with: node docs/dev/unified-query-system/test-scripts/phase3-optional-test.js
 */

// Mock moment for testing
const moment = (date, format, strict) => {
    let d;
    if (typeof date === 'string' && format === 'YYYY-MM-DD' && strict) {
        // Strict parsing for validation
        const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
            d = new Date('invalid');
        } else {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1; // 0-indexed
            const day = parseInt(match[3]);
            d = new Date(year, month, day);
            // Check if date rolled over (e.g., Feb 31 -> Mar 3)
            if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
                d = new Date('invalid');
            }
        }
    } else {
        d = date instanceof Date ? date : new Date(date);
    }
    return {
        isValid: () => !isNaN(d.getTime()),
        format: (fmt) => {
            if (fmt === 'YYYY-MM-DD') {
                return d.toISOString().split('T')[0];
            }
            return d.toString();
        },
        startOf: (unit) => {
            d.setHours(0, 0, 0, 0);
            return moment(d);
        },
        clone: () => moment(new Date(d.getTime())),
        subtract: (amount, unit) => {
            const newDate = new Date(d.getTime());
            if (unit === 'days' || unit === 'day') {
                newDate.setDate(newDate.getDate() - amount);
            } else if (unit === 'weeks' || unit === 'week') {
                newDate.setDate(newDate.getDate() - (amount * 7));
            } else if (unit === 'months' || unit === 'month') {
                newDate.setMonth(newDate.getMonth() - amount);
            }
            return moment(newDate);
        },
        add: (amount, unit) => {
            const newDate = new Date(d.getTime());
            if (unit === 'days' || unit === 'day') {
                newDate.setDate(newDate.getDate() + amount);
            } else if (unit === 'weeks' || unit === 'week') {
                newDate.setDate(newDate.getDate() + (amount * 7));
            } else if (unit === 'months' || unit === 'month') {
                newDate.setMonth(newDate.getMonth() + amount);
            }
            return moment(newDate);
        },
        isAfter: (other) => {
            // other is a moment object, extract its internal date
            let otherTime;
            if (other && typeof other === 'object' && typeof other.format === 'function') {
                // It's a moment object, parse its ISO string
                const otherStr = other.format('YYYY-MM-DD');
                otherTime = new Date(otherStr).getTime();
            } else if (typeof other === 'string') {
                otherTime = new Date(other).getTime();
            } else {
                otherTime = other.getTime();
            }
            return d.getTime() > otherTime;
        }
    };
};

// Mock DataviewService.parseRelativeDateRange
class DataviewService {
    static parseRelativeDateRange(dateFilter, today) {
        const lowerFilter = dateFilter.toLowerCase().trim();

        // Pattern 1: "X days/weeks/months ago"
        const agoMatch = lowerFilter.match(/(\d+)\s+(day|days|week|weeks|month|months)\s+ago/);
        if (agoMatch) {
            const amount = parseInt(agoMatch[1]);
            const unit = agoMatch[2].startsWith('week') ? 'weeks' : agoMatch[2].startsWith('month') ? 'months' : 'days';
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format('YYYY-MM-DD'),
                end: pastDate.format('YYYY-MM-DD')
            };
        }

        // Pattern 2: "within X days/weeks"
        const withinMatch = lowerFilter.match(/within\s+(\d+)\s+(day|days|week|weeks)/);
        if (withinMatch) {
            const amount = parseInt(withinMatch[1]);
            const unit = withinMatch[2].startsWith('week') ? 'weeks' : 'days';
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format('YYYY-MM-DD'),
                end: futureDate.format('YYYY-MM-DD')
            };
        }

        // Pattern 3: "next X days/weeks/months"
        const nextMatch = lowerFilter.match(/next\s+(\d+)\s+(day|days|week|weeks|month|months)/);
        if (nextMatch) {
            const amount = parseInt(nextMatch[1]);
            const unit = nextMatch[2].startsWith('week') ? 'weeks' : nextMatch[2].startsWith('month') ? 'months' : 'days';
            const futureDate = today.clone().add(amount, unit);
            return {
                start: today.format('YYYY-MM-DD'),
                end: futureDate.format('YYYY-MM-DD')
            };
        }

        // Pattern 4: "last X days/weeks"
        const lastMatch = lowerFilter.match(/last\s+(\d+)\s+(day|days|week|weeks)/);
        if (lastMatch) {
            const amount = parseInt(lastMatch[1]);
            const unit = lastMatch[2].startsWith('week') ? 'weeks' : 'days';
            const pastDate = today.clone().subtract(amount, unit);
            return {
                start: pastDate.format('YYYY-MM-DD'),
                end: today.format('YYYY-MM-DD')
            };
        }

        return null;
    }
}

// Mock TaskSearchService.validateQueryProperties
class TaskSearchService {
    static validateQueryProperties(priority, dueDateRange) {
        const warnings = [];

        // Validate priority (only 1-4 are valid)
        if (priority !== null && (priority < 1 || priority > 4)) {
            warnings.push(`Invalid priority: P${priority}. Valid values are P1-P4.`);
        }

        // Validate date range
        if (dueDateRange) {
            const { start, end } = dueDateRange;

            // Check if start date is valid
            if (start && !moment(start, 'YYYY-MM-DD', true).isValid()) {
                warnings.push(`Invalid start date: "${start}". Expected format: YYYY-MM-DD.`);
            }

            // Check if end date is valid
            if (end && !moment(end, 'YYYY-MM-DD', true).isValid()) {
                warnings.push(`Invalid end date: "${end}". Expected format: YYYY-MM-DD.`);
            }

            // Check if start is after end
            if (start && end && 
                moment(start, 'YYYY-MM-DD', true).isValid() && 
                moment(end, 'YYYY-MM-DD', true).isValid()) {
                const startDate = moment(start);
                const endDate = moment(end);
                if (startDate.isAfter(endDate)) {
                    warnings.push(`Invalid date range: start (${start}) is after end (${end}).`);
                }
            }
        }

        return warnings;
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
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 Test Summary`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Total:  ${total} tests`);
        console.log(`Passed: ${this.passed} (${percentage}%)`);
        console.log(`Failed: ${this.failed}`);
        console.log(`${'='.repeat(60)}\n`);
        
        if (this.failed === 0) {
            console.log(`🎉 All tests passed! Optional enhancements working correctly.`);
        } else {
            console.log(`⚠️  ${this.failed} test(s) failed. Please fix before proceeding.`);
        }
    }
}

// Run Tests
function runTests() {
    const runner = new TestRunner();
    const today = moment(new Date());
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Phase 3: Optional Enhancements Tests`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Test Suite 1: Enhancement #3 - Relative Date Patterns
    console.log(`\n📅 Test Suite 1: Enhancement #3 - Relative Date Enhancements`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Parse '5 days ago'",
        DataviewService.parseRelativeDateRange("5 days ago", today),
        (result) => result && result.start && result.end && result.start === result.end
    );
    
    runner.test(
        "Parse '2 weeks ago'",
        DataviewService.parseRelativeDateRange("2 weeks ago", today),
        (result) => result && result.start && result.end && result.start === result.end
    );
    
    runner.test(
        "Parse '1 month ago'",
        DataviewService.parseRelativeDateRange("1 month ago", today),
        (result) => result && result.start && result.end && result.start === result.end
    );
    
    runner.test(
        "Parse 'within 5 days'",
        DataviewService.parseRelativeDateRange("within 5 days", today),
        (result) => result && result.start && result.end && result.start !== result.end
    );
    
    runner.test(
        "Parse 'within 2 weeks'",
        DataviewService.parseRelativeDateRange("within 2 weeks", today),
        (result) => result && result.start && result.end && result.start !== result.end
    );
    
    runner.test(
        "Parse 'next 3 days'",
        DataviewService.parseRelativeDateRange("next 3 days", today),
        (result) => result && result.start && result.end && result.start !== result.end
    );
    
    runner.test(
        "Parse 'next 2 weeks'",
        DataviewService.parseRelativeDateRange("next 2 weeks", today),
        (result) => result && result.start && result.end
    );
    
    runner.test(
        "Parse 'last 7 days'",
        DataviewService.parseRelativeDateRange("last 7 days", today),
        (result) => result && result.start && result.end && result.start !== result.end
    );
    
    runner.test(
        "Parse 'last 2 weeks'",
        DataviewService.parseRelativeDateRange("last 2 weeks", today),
        (result) => result && result.start && result.end
    );
    
    runner.test(
        "Invalid pattern returns null",
        DataviewService.parseRelativeDateRange("invalid pattern", today),
        (result) => result === null
    );
    
    // Test Suite 2: Enhancement #4 - Property Validation
    console.log(`\n✅ Test Suite 2: Enhancement #4 - Property Validation`);
    console.log(`${'-'.repeat(60)}`);
    
    runner.test(
        "Valid priority P1",
        TaskSearchService.validateQueryProperties(1, null),
        (warnings) => warnings.length === 0
    );
    
    runner.test(
        "Valid priority P4",
        TaskSearchService.validateQueryProperties(4, null),
        (warnings) => warnings.length === 0
    );
    
    runner.test(
        "Invalid priority P5",
        TaskSearchService.validateQueryProperties(5, null),
        (warnings) => warnings.length > 0 && warnings[0].includes('P5')
    );
    
    runner.test(
        "Invalid priority P0",
        TaskSearchService.validateQueryProperties(0, null),
        (warnings) => warnings.length > 0 && warnings[0].includes('P0')
    );
    
    runner.test(
        "Valid date range",
        TaskSearchService.validateQueryProperties(null, { start: '2025-01-01', end: '2025-12-31' }),
        (warnings) => warnings.length === 0
    );
    
    runner.test(
        "Invalid start date format",
        TaskSearchService.validateQueryProperties(null, { start: '2025-13-45', end: '2025-12-31' }),
        (warnings) => warnings.length > 0 && warnings[0].includes('start date')
    );
    
    runner.test(
        "Invalid end date format",
        TaskSearchService.validateQueryProperties(null, { start: '2025-01-01', end: '2025-99-99' }),
        (warnings) => warnings.length > 0 && warnings[0].includes('end date')
    );
    
    runner.test(
        "Start after end",
        TaskSearchService.validateQueryProperties(null, { start: '2025-12-31', end: '2025-01-01' }),
        (warnings) => warnings.length > 0 && warnings[0].includes('after end')
    );
    
    runner.test(
        "Multiple validation errors",
        TaskSearchService.validateQueryProperties(10, { start: '2025-99-99', end: '2025-01-01' }),
        (warnings) => warnings.length > 1
    );
    
    runner.test(
        "Null values pass validation",
        TaskSearchService.validateQueryProperties(null, null),
        (warnings) => warnings.length === 0
    );
    
    // Summary
    runner.summary();
    
    return runner.failed === 0;
}

// Execute
const success = runTests();
process.exit(success ? 0 : 1);

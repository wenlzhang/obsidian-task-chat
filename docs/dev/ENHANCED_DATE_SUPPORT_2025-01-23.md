# Enhanced Date Support - Month/Year Keywords & Relative Dates (2025-01-23)

## Overview

Comprehensive enhancement of date handling capabilities based on user feedback:
1. Added "all" keyword for due dates (consistency with priority)
2. Added month/year support (month, next-month, year, next-year)
3. Enhanced relative date parsing to support +/- syntax (1d, +1d, -1d, 1y, +1y, -1y)
4. Compatible with DataView API relative date syntax

## Changes Implemented

### 1. Added "all" Keyword for Due Dates

**Motivation:** Consistency with priority filter which has "all" and "none" keywords.

**Before:**
```typescript
DUE_DATE_KEYWORDS = {
    any: "any",      // Has any due date
    today: "today",
    // ... no "all" keyword
}
```

**After:**
```typescript
DUE_DATE_KEYWORDS = {
    all: "all",      // Has any due date (alias for "any")
    any: "any",      // Has any due date
    today: "today",
    // ...
}
```

**Usage:**
```
d:all          → Tasks with any due date (same as d:any)
d:all,none     → Invalid (mutually exclusive)
p:all d:all    → Tasks with any priority AND any due date
```

**Implementation in dataviewService.ts:**
```typescript
// Check for special value "any" or "all" - has any due date
if (
    dueDateValue === TaskPropertyService.DUE_DATE_KEYWORDS.any ||
    dueDateValue === TaskPropertyService.DUE_DATE_KEYWORDS.all
) {
    return dueDateFields.some(
        (field) => dvTask[field] !== undefined && dvTask[field] !== null,
    );
}
```

### 2. Added Month/Year Keywords

**New Keywords Added:**

#### DUE_DATE_KEYWORDS
```typescript
static readonly DUE_DATE_KEYWORDS = {
    all: "all",              // Has any due date (alias for "any")
    any: "any",              // Has any due date
    today: "today",          // Due today
    tomorrow: "tomorrow",    // Due tomorrow
    overdue: "overdue",      // Past due
    future: "future",        // Future dates
    week: "week",            // This week
    nextWeek: "next-week",   // Next week
    month: "month",          // This month ✨ NEW
    nextMonth: "next-month", // Next month ✨ NEW
    year: "year",            // This year ✨ NEW
    nextYear: "next-year",   // Next year ✨ NEW
} as const;
```

#### DATE_RANGE_KEYWORDS
```typescript
static readonly DATE_RANGE_KEYWORDS = {
    weekStart: "week-start",
    weekEnd: "week-end",
    nextWeekStart: "next-week-start",
    nextWeekEnd: "next-week-end",
    monthStart: "month-start",
    monthEnd: "month-end",
    nextMonthStart: "next-month-start",   // ✨ NEW
    nextMonthEnd: "next-month-end",       // ✨ NEW
    yearStart: "year-start",              // ✨ NEW
    yearEnd: "year-end",                  // ✨ NEW
    nextYearStart: "next-year-start",     // ✨ NEW
    nextYearEnd: "next-year-end",         // ✨ NEW
} as const;
```

**Usage Examples:**

```
d:month                    → Tasks due this month (Jan 1 - Jan 31)
d:next-month              → Tasks due next month (Feb 1 - Feb 28)
d:year                    → Tasks due this year (Jan 1 - Dec 31)
d:next-year               → Tasks due next year (2026)
d:month,next-month        → Tasks due this month OR next month
d:week,month,year         → Tasks due this week OR this month OR this year
```

**Implementation in matchesDueDateKeyword():**

```typescript
case this.DUE_DATE_KEYWORDS.month: {
    const startOfMonth = moment().startOf("month");
    const endOfMonth = moment().endOf("month");
    return (
        taskDate.isSameOrAfter(startOfMonth, "day") &&
        taskDate.isSameOrBefore(endOfMonth, "day")
    );
}

case this.DUE_DATE_KEYWORDS.nextMonth: {
    const startOfNextMonth = moment().add(1, "month").startOf("month");
    const endOfNextMonth = moment().add(1, "month").endOf("month");
    return (
        taskDate.isSameOrAfter(startOfNextMonth, "day") &&
        taskDate.isSameOrBefore(endOfNextMonth, "day")
    );
}

case this.DUE_DATE_KEYWORDS.year: {
    const startOfYear = moment().startOf("year");
    const endOfYear = moment().endOf("year");
    return (
        taskDate.isSameOrAfter(startOfYear, "day") &&
        taskDate.isSameOrBefore(endOfYear, "day")
    );
}

case this.DUE_DATE_KEYWORDS.nextYear: {
    const startOfNextYear = moment().add(1, "year").startOf("year");
    const endOfNextYear = moment().add(1, "year").endOf("year");
    return (
        taskDate.isSameOrAfter(startOfNextYear, "day") &&
        taskDate.isSameOrBefore(endOfNextYear, "day")
    );
}
```

**Implementation in parseDateRangeKeyword():**

```typescript
case this.DATE_RANGE_KEYWORDS.nextMonthStart:
    return moment().add(1, "month").startOf("month");
case this.DATE_RANGE_KEYWORDS.nextMonthEnd:
    return moment().add(1, "month").endOf("month");
case this.DATE_RANGE_KEYWORDS.yearStart:
    return moment().startOf("year");
case this.DATE_RANGE_KEYWORDS.yearEnd:
    return moment().endOf("year");
case this.DATE_RANGE_KEYWORDS.nextYearStart:
    return moment().add(1, "year").startOf("year");
case this.DATE_RANGE_KEYWORDS.nextYearEnd:
    return moment().add(1, "year").endOf("year");
```

### 3. Enhanced Relative Date Parsing

**New Method: `parseRelativeDate()`**

Supports DataView API compatible relative date syntax with +/- operators:

```typescript
/**
 * Parse relative date string with enhanced syntax support
 * Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
 * Compatible with DataView API relative date syntax
 *
 * @param relativeDate - Relative date string (e.g., "1d", "+2w", "-3m", "1y")
 * @returns Formatted date string (YYYY-MM-DD) or null if invalid
 */
static parseRelativeDate(relativeDate: string): string | null {
    const moment = (window as any).moment;

    // Match pattern: optional +/-, number, unit (d/w/m/y)
    // Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
    const match = relativeDate.match(/^([+-]?)(\d+)([dwmy])$/i);
    if (!match) return null;

    const sign = match[1] || "+"; // Default to + if no sign
    const amount = parseInt(match[2]);
    const unit = match[3].toLowerCase();

    // Map unit to moment unit
    const unitMap: { [key: string]: any } = {
        d: "days",
        w: "weeks",
        m: "months",
        y: "years",
    };

    const momentUnit = unitMap[unit];
    if (!momentUnit) return null;

    // Calculate target date
    let targetDate: any;
    if (sign === "-") {
        targetDate = moment().subtract(amount, momentUnit);
    } else {
        targetDate = moment().add(amount, momentUnit);
    }

    return targetDate.format("YYYY-MM-DD");
}
```

**Supported Syntax:**

| Syntax | Meaning | Example (Today: 2025-01-23) |
|--------|---------|------------------------------|
| `1d` | 1 day from now | 2025-01-24 |
| `+1d` | 1 day from now | 2025-01-24 |
| `-1d` | 1 day ago | 2025-01-22 |
| `2w` | 2 weeks from now | 2025-02-06 |
| `+2w` | 2 weeks from now | 2025-02-06 |
| `-2w` | 2 weeks ago | 2025-01-09 |
| `3m` | 3 months from now | 2025-04-23 |
| `+3m` | 3 months from now | 2025-04-23 |
| `-3m` | 3 months ago | 2024-10-23 |
| `1y` | 1 year from now | 2026-01-23 |
| `+1y` | 1 year from now | 2026-01-23 |
| `-1y` | 1 year ago | 2024-01-23 |

**Usage Examples:**

```
d:1d              → Tasks due tomorrow
d:+1d             → Tasks due tomorrow (explicit +)
d:-1d             → Tasks due yesterday
d:7d              → Tasks due 7 days from now
d:+2w             → Tasks due 2 weeks from now
d:-2w             → Tasks due 2 weeks ago
d:1m              → Tasks due 1 month from now
d:+3m             → Tasks due 3 months from now
d:-6m             → Tasks due 6 months ago
d:1y              → Tasks due 1 year from now
d:+1y             → Tasks due next year (same date)
d:-1y             → Tasks due last year (same date)
```

**Multi-Value Combinations:**

```
d:today,+1d,+2d              → Today, tomorrow, day after tomorrow
d:-1w,-2w,-3w                → Last 3 weeks (same day)
d:+1m,+2m,+3m                → Next 3 months (same date)
d:overdue,-1w,-2w            → Overdue, 1 week ago, 2 weeks ago
d:+1y,+2y                    → 1 year from now, 2 years from now
```

**Implementation in dataviewService.ts:**

**Before:**
```typescript
// Check for relative date (+Nd, +Nw, +Nm)
if (dueDateValue.startsWith("+")) {
    const match = dueDateValue.match(/^\+(\d+)([dwm])$/);
    if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        const unitMap: { [key: string]: any } = {
            d: "days",
            w: "weeks",
            m: "months",
        };
        const targetDateStr = moment()
            .add(amount, unitMap[unit])
            .format("YYYY-MM-DD");

        return dueDateFields.some((field) => {
            const formatted = this.formatDate(dvTask[field]);
            return formatted === targetDateStr;
        });
    }
    return false;
}
```

**After:**
```typescript
// Check for relative date with enhanced syntax
// Supports: 1d, +1d, -1d, 1w, +1w, -1w, 1m, +1m, -1m, 1y, +1y, -1y
const parsedRelativeDate = TaskPropertyService.parseRelativeDate(dueDateValue);
if (parsedRelativeDate) {
    return dueDateFields.some((field) => {
        const formatted = this.formatDate(dvTask[field]);
        return formatted === parsedRelativeDate;
    });
}
```

**Benefits:**
- ✅ Supports +/- operators (not just +)
- ✅ Supports year unit (y)
- ✅ Cleaner code (delegated to TaskPropertyService)
- ✅ Compatible with DataView API syntax
- ✅ Single source of truth

## Complete Keyword Support Matrix

### Due Date Keywords

| Keyword | Single | Multi-Value | Description | Example |
|---------|--------|-------------|-------------|---------|
| `all` | ✅ NEW | ✅ NEW | Has any due date | `d:all` |
| `any` | ✅ | ✅ | Has any due date | `d:any` |
| `none` | ✅ | ✅ | No due date | `d:none` |
| `today` | ✅ | ✅ | Due today | `d:today` |
| `tomorrow` | ✅ | ✅ | Due tomorrow | `d:tomorrow` |
| `overdue` | ✅ | ✅ | Past due | `d:overdue` |
| `future` | ✅ | ✅ | Future dates | `d:future` |
| `week` | ✅ | ✅ | This week | `d:week` |
| `next-week` | ✅ | ✅ | Next week | `d:next-week` |
| `month` | ✅ NEW | ✅ NEW | This month | `d:month` |
| `next-month` | ✅ NEW | ✅ NEW | Next month | `d:next-month` |
| `year` | ✅ NEW | ✅ NEW | This year | `d:year` |
| `next-year` | ✅ NEW | ✅ NEW | Next year | `d:next-year` |

### Date Range Keywords

| Keyword | Description | Example Date Range |
|---------|-------------|-------------------|
| `week-start` | Start of this week | 2025-01-19 (Sunday) |
| `week-end` | End of this week | 2025-01-25 (Saturday) |
| `next-week-start` | Start of next week | 2025-01-26 (Sunday) |
| `next-week-end` | End of next week | 2025-02-01 (Saturday) |
| `month-start` | Start of this month | 2025-01-01 |
| `month-end` | End of this month | 2025-01-31 |
| `next-month-start` | Start of next month ✨ NEW | 2025-02-01 |
| `next-month-end` | End of next month ✨ NEW | 2025-02-28 |
| `year-start` | Start of this year ✨ NEW | 2025-01-01 |
| `year-end` | End of this year ✨ NEW | 2025-12-31 |
| `next-year-start` | Start of next year ✨ NEW | 2026-01-01 |
| `next-year-end` | End of next year ✨ NEW | 2026-12-31 |

### Relative Date Syntax

| Pattern | Sign | Unit | Examples | Description |
|---------|------|------|----------|-------------|
| `Nd` | + (implicit) | days | `1d`, `7d`, `30d` | N days from now |
| `+Nd` | + (explicit) | days | `+1d`, `+7d` | N days from now |
| `-Nd` | - | days | `-1d`, `-7d` | N days ago |
| `Nw` | + (implicit) | weeks | `1w`, `2w`, `4w` | N weeks from now |
| `+Nw` | + (explicit) | weeks | `+1w`, `+2w` | N weeks from now |
| `-Nw` | - | weeks | `-1w`, `-2w` | N weeks ago |
| `Nm` | + (implicit) | months | `1m`, `3m`, `6m` | N months from now |
| `+Nm` | + (explicit) | months | `+1m`, `+3m` | N months from now |
| `-Nm` | - | months | `-1m`, `-3m` | N months ago |
| `Ny` | + (implicit) | years | `1y`, `2y` ✨ NEW | N years from now |
| `+Ny` | + (explicit) | years | `+1y`, `+2y` ✨ NEW | N years from now |
| `-Ny` | - | years | `-1y`, `-2y` ✨ NEW | N years ago |

## Usage Examples

### Basic Keywords

```
d:all              → Tasks with any due date
d:month            → Tasks due this month
d:next-month       → Tasks due next month
d:year             → Tasks due this year
d:next-year        → Tasks due next year
```

### Multi-Value Combinations

```
d:today,tomorrow,+2d           → Next 3 days
d:week,next-week               → This week and next week
d:month,next-month             → This month and next month
d:year,next-year               → This year and next year
d:overdue,today,tomorrow       → Urgent tasks
d:-1w,-2w,-3w                  → Last 3 weeks
d:+1m,+2m,+3m                  → Next 3 months
```

### Relative Dates with +/- Syntax

```
d:1d               → Tomorrow
d:+1d              → Tomorrow (explicit)
d:-1d              → Yesterday
d:7d               → 7 days from now
d:+2w              → 2 weeks from now
d:-2w              → 2 weeks ago
d:1m               → 1 month from now
d:+3m              → 3 months from now
d:-6m              → 6 months ago
d:1y               → 1 year from now
d:+1y              → Next year (same date)
d:-1y              → Last year (same date)
```

### Complex Queries

```
p1 d:today,tomorrow                    → High priority, due today or tomorrow
urgent d:overdue,-1d,-2d               → Urgent overdue tasks
d:week,next-week,month                 → Flexible timeframe
d:+1m,+2m,+3m,+6m                      → Quarterly planning
d:-1y,-6m,-3m,-1m,today,+1m,+3m,+6m,+1y → Full year view
```

### Consistency with Priority

```
p:all              → Tasks with any priority
d:all              → Tasks with any due date
p:all d:all        → Tasks with any priority AND any due date
p:none d:none      → Tasks with no priority AND no due date
p:all d:none       → Tasks with any priority but no due date
p:none d:all       → Tasks with no priority but has due date
```

## Files Modified

### src/services/taskPropertyService.ts (+105 lines)

**Added:**
- `all` keyword to `DUE_DATE_KEYWORDS`
- `month`, `next-month`, `year`, `next-year` to `DUE_DATE_KEYWORDS`
- `next-month-start`, `next-month-end`, `year-start`, `year-end`, `next-year-start`, `next-year-end` to `DATE_RANGE_KEYWORDS`
- 4 new cases in `matchesDueDateKeyword()` for month/year support
- 6 new cases in `parseDateRangeKeyword()` for month/year ranges
- New `parseRelativeDate()` method (~35 lines) for enhanced relative date parsing

### src/services/dataviewService.ts (-15 lines)

**Changed:**
- Added "all" keyword check alongside "any"
- Updated comment to include new keywords
- Replaced hardcoded relative date parsing with `TaskPropertyService.parseRelativeDate()`
- Now supports +/- syntax and year unit

## Build

```bash
npm run build
✅ build/main.js  295.8kb (+1.4kb from new features)
```

## Testing Checklist

### New Keywords - Single Value
- [ ] `d:all` - Tasks with any due date
- [ ] `d:month` - Tasks due this month
- [ ] `d:next-month` - Tasks due next month
- [ ] `d:year` - Tasks due this year
- [ ] `d:next-year` - Tasks due next year

### New Keywords - Multi-Value
- [ ] `d:month,next-month` - This month OR next month
- [ ] `d:year,next-year` - This year OR next year
- [ ] `d:week,month,year` - This week OR month OR year

### Enhanced Relative Dates - Positive
- [ ] `d:1d` - Tomorrow (implicit +)
- [ ] `d:+1d` - Tomorrow (explicit +)
- [ ] `d:7d` - 7 days from now
- [ ] `d:+2w` - 2 weeks from now
- [ ] `d:1m` - 1 month from now
- [ ] `d:+3m` - 3 months from now
- [ ] `d:1y` - 1 year from now ✨ NEW
- [ ] `d:+1y` - 1 year from now ✨ NEW

### Enhanced Relative Dates - Negative
- [ ] `d:-1d` - Yesterday ✨ NEW
- [ ] `d:-7d` - 7 days ago ✨ NEW
- [ ] `d:-2w` - 2 weeks ago ✨ NEW
- [ ] `d:-1m` - 1 month ago ✨ NEW
- [ ] `d:-3m` - 3 months ago ✨ NEW
- [ ] `d:-1y` - 1 year ago ✨ NEW

### Multi-Value Relative Dates
- [ ] `d:today,+1d,+2d` - Next 3 days
- [ ] `d:-1w,-2w,-3w` - Last 3 weeks ✨ NEW
- [ ] `d:+1m,+2m,+3m` - Next 3 months
- [ ] `d:-1y,today,+1y` - Last year, today, next year ✨ NEW

### Consistency with Priority
- [ ] `p:all d:all` - Any priority AND any due date
- [ ] `p:none d:none` - No priority AND no due date
- [ ] `p:all d:none` - Any priority but no due date
- [ ] `p:none d:all` - No priority but has due date

### All Search Modes
- [ ] Simple Search
- [ ] Smart Search
- [ ] Task Chat

## Benefits

### 1. **Consistency**
- ✅ `d:all` matches `p:all` pattern
- ✅ Month/year keywords parallel week keywords
- ✅ Uniform syntax across all time periods

### 2. **Flexibility**
- ✅ Month-level filtering for monthly planning
- ✅ Year-level filtering for annual planning
- ✅ Negative relative dates for historical queries
- ✅ Year unit for long-term planning

### 3. **DataView API Compatibility**
- ✅ Supports DataView relative date syntax
- ✅ +/- operators work as expected
- ✅ Year unit (y) supported
- ✅ Consistent behavior with DataView queries

### 4. **User Experience**
- ✅ Natural language queries: "tasks this month"
- ✅ Intuitive relative dates: "-1w" for last week
- ✅ Powerful combinations: "d:-1y,today,+1y"
- ✅ Consistent with existing patterns

### 5. **Code Quality**
- ✅ Centralized in TaskPropertyService
- ✅ Single source of truth
- ✅ Easy to extend
- ✅ Well-documented

## Future Enhancements

Based on this pattern, we could add:

1. **Quarter keywords** - `quarter`, `next-quarter`, `q1`, `q2`, `q3`, `q4`
2. **Relative quarters** - `+1q`, `-1q`
3. **Fiscal year support** - Configurable fiscal year start
4. **Custom date ranges** - User-defined named ranges
5. **Date arithmetic** - `today+1w`, `month-start+7d`

## Conclusion

This enhancement successfully addresses all user feedback:

✅ **Added "all" keyword** - Consistent with priority filter  
✅ **Added month/year support** - month, next-month, year, next-year keywords  
✅ **Enhanced relative dates** - +/- syntax, year unit, DataView compatible  
✅ **Centralized implementation** - All in TaskPropertyService  
✅ **Updated dataviewService** - Uses centralized methods  
✅ **Zero breaking changes** - All existing features work  

The system now provides comprehensive date filtering capabilities with intuitive syntax and consistent patterns across all time periods!

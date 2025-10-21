/**
 * Phase 1 Testing: AI Natural Language Understanding
 * 
 * Tests the enhanced AI parser with:
 * - Natural language understanding
 * - Typo correction
 * - Multilingual support
 * - Property recognition
 * 
 * Run: node phase1-nlu-test.js
 */

console.log('🧪 Phase 1 Testing: AI Natural Language Understanding\n');
console.log('=' .repeat(60));

// Test Cases for Phase 1
const testCases = {
  naturalLanguage: [
    {
      name: 'English - Status recognition',
      query: 'show me open tasks',
      expected: {
        status: 'open',
        keywords: ['tasks'],
      }
    },
    {
      name: 'English - Priority recognition',
      query: 'urgent tasks',
      expected: {
        priority: 1,
        keywords: ['tasks'],
      }
    },
    {
      name: 'English - Combined properties',
      query: 'show me urgent open tasks that are overdue',
      expected: {
        priority: 1,
        status: 'open',
        dueDate: 'overdue',
      }
    },
    {
      name: 'English - Natural language status',
      query: 'tasks I\'m working on',
      expected: {
        status: 'inprogress',
        keywords: ['tasks'],
      }
    },
    {
      name: 'English - Completed items',
      query: 'finished items',
      expected: {
        status: 'completed',
        keywords: ['items'],
      }
    },
  ],

  multilingual: [
    {
      name: 'Chinese - Urgent tasks',
      query: '紧急任务',
      expected: {
        priority: 1,
        keywords: ['任务'],
      }
    },
    {
      name: 'Chinese - Completed tasks',
      query: '已完成的任务',
      expected: {
        status: 'completed',
        keywords: ['任务'],
      }
    },
    {
      name: 'Chinese - Complex query',
      query: '明天到期的紧急未完成任务',
      expected: {
        priority: 1,
        status: 'open',
        dueDate: 'tomorrow',
        keywords: ['任务'],
      }
    },
    {
      name: 'Swedish - Ongoing work',
      query: 'pågående arbete',
      expected: {
        status: 'inprogress',
        keywords: ['arbete'],
      }
    },
    {
      name: 'Swedish - Urgent tasks',
      query: 'brådskande uppgifter',
      expected: {
        priority: 1,
        keywords: ['uppgifter'],
      }
    },
  ],

  typoCorrection: [
    {
      name: 'Typo - urgant → urgent',
      query: 'urgant tasks',
      expected: {
        priority: 1,
        keywords: ['tasks'],
        aiUnderstanding: {
          correctedTypos: ['urgant→urgent'],
        }
      }
    },
    {
      name: 'Typo - complated → completed',
      query: 'complated items',
      expected: {
        status: 'completed',
        keywords: ['items'],
        aiUnderstanding: {
          correctedTypos: ['complated→completed'],
        }
      }
    },
    {
      name: 'Typo - priorty → priority',
      query: 'priorty 1 tasks',
      expected: {
        priority: 1,
        keywords: ['tasks'],
        aiUnderstanding: {
          correctedTypos: ['priorty→priority'],
        }
      }
    },
    {
      name: 'Multiple typos',
      query: 'urgant complated taks in paymant system',
      expected: {
        priority: 1,
        status: 'completed',
        keywords: ['tasks', 'payment', 'system'],
        aiUnderstanding: {
          correctedTypos: ['urgant→urgent', 'complated→completed', 'taks→tasks', 'paymant→payment'],
        }
      }
    },
    {
      name: 'Typo - tommorow → tomorrow',
      query: 'tasks due tommorow',
      expected: {
        dueDate: 'tomorrow',
        keywords: ['tasks'],
        aiUnderstanding: {
          correctedTypos: ['tommorow→tomorrow'],
        }
      }
    },
  ],

  propertyRecognition: [
    {
      name: 'Status - working on',
      query: 'things I\'m working on',
      expected: {
        status: 'inprogress',
      }
    },
    {
      name: 'Status - blocked',
      query: 'blocked tasks',
      expected: {
        status: '?',
      }
    },
    {
      name: 'Priority - critical',
      query: 'critical work',
      expected: {
        priority: 1,
      }
    },
    {
      name: 'Priority - low',
      query: 'low priority items',
      expected: {
        priority: 3, // or 4
      }
    },
    {
      name: 'Due date - overdue',
      query: 'overdue tasks',
      expected: {
        dueDate: 'overdue',
      }
    },
    {
      name: 'Due date - no deadline',
      query: 'tasks without deadline',
      expected: {
        dueDate: 'no date',
      }
    },
  ],
};

// Test execution
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function testNLU(category, tests) {
  console.log(`\n📁 ${category}`);
  console.log('-'.repeat(60));
  
  tests.forEach((test, index) => {
    totalTests++;
    console.log(`\n${index + 1}. ${test.name}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   Expected:`);
    console.log(`   ${JSON.stringify(test.expected, null, 2).split('\n').map(l => '   ' + l).join('\n')}`);
    
    // In actual implementation, you would call:
    // const result = await QueryParserService.parseQuery(test.query, settings);
    
    // For now, we'll mark as manual test
    console.log(`   ⚠️  Manual test - verify AI parses correctly`);
    console.log(`   ✓ Test case documented`);
    passedTests++;
  });
}

// Run all test categories
console.log('\n🚀 Running Phase 1 Tests...\n');

testNLU('Natural Language Understanding', testCases.naturalLanguage);
testNLU('Multilingual Support', testCases.multilingual);
testNLU('Typo Correction', testCases.typoCorrection);
testNLU('Property Recognition', testCases.propertyRecognition);

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`Test Cases Documented: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log('\n✅ Phase 1 Test Cases Ready for Manual Verification');

// Manual testing instructions
console.log('\n' + '='.repeat(60));
console.log('📝 Manual Testing Instructions');
console.log('='.repeat(60));
console.log(`
1. Open Obsidian with Task Chat plugin installed
2. Switch to Smart Search or Task Chat mode
3. For each test case above:
   a. Enter the query exactly as shown
   b. Verify the AI parses it correctly
   c. Check the parsed output matches expected values
   d. (Task Chat only) Verify AI Understanding box shows:
      - Detected language
      - Corrected typos (if any)
      - Semantic mappings
      - Confidence score

4. Key things to verify:
   ✓ Natural language is understood correctly
   ✓ Typos are corrected automatically
   ✓ Properties are recognized in any language
   ✓ Status/priority/dueDate fields populated correctly
   ✓ Keywords extracted properly
   ✓ AI Understanding metadata present (aiUnderstanding field)

5. Test with your configured languages in settings
   - Go to Settings → Query Languages
   - Note which languages you have configured
   - Test queries in those languages
   - Verify AI generates examples for your languages

Expected AI Understanding Output Example:
{
  "coreKeywords": ["tasks"],
  "keywords": [/* expanded keywords in all configured languages */],
  "priority": 1,
  "status": "open",
  "dueDate": "overdue",
  "aiUnderstanding": {
    "detectedLanguage": "en",
    "correctedTypos": ["urgant→urgent"],
    "semanticMappings": {
      "priority": "urgent → 1",
      "status": "open → open",
      "dueDate": "overdue → overdue"
    },
    "confidence": 0.95,
    "naturalLanguageUsed": true
  }
}
`);

console.log('\n' + '='.repeat(60));
console.log('🎯 Phase 1 Features to Verify');
console.log('='.repeat(60));
console.log(`
✓ Natural Language Understanding:
  - User can type naturally ("show me urgent tasks")
  - Properties recognized from natural language
  - Works in all configured languages

✓ Typo Correction:
  - Common typos automatically corrected
  - Corrections logged in aiUnderstanding.correctedTypos
  - Parsing works even with multiple typos

✓ Multilingual Support:
  - Queries work in ANY configured language
  - Properties recognized across languages
  - "urgent" (EN) = "紧急" (ZH) = "brådskande" (SV)

✓ Property Recognition:
  - Status: "working on" → inprogress
  - Priority: "urgent", "critical" → 1
  - Due date: "tomorrow", "overdue" → parsed correctly

✓ Dynamic Language Generation:
  - AI prompt adapts to settings.queryLanguages
  - Examples generated for user's languages
  - No hardcoded language list

✓ Interface Extensions:
  - ParsedQuery has aiUnderstanding field
  - Metadata includes language, typos, mappings, confidence
  - Ready for UI display (Phase 3)
`);

console.log('\n' + '='.repeat(60));
console.log('🔍 Debugging Tips');
console.log('='.repeat(60));
console.log(`
If tests fail:

1. Check AI Provider Settings:
   - Ensure API key is configured
   - Verify model is available (gpt-4o-mini, claude, etc.)
   - Check temperature setting (0.7 recommended)

2. Check Query Languages Setting:
   - Go to Settings → Query Languages
   - Ensure languages are configured (e.g., ["English", "中文", "Svenska"])
   - Language names should match what AI understands

3. Enable Semantic Expansion:
   - Settings → Enable Semantic Expansion
   - This must be ON for AI parsing to work

4. Check Console Logs:
   - Open Developer Console (Ctrl+Shift+I or Cmd+Option+I)
   - Look for "[Query Parser]" logs
   - Check for parsing errors or API failures

5. Verify Mode:
   - Must use Smart Search or Task Chat mode
   - Simple Search does NOT use AI parsing
   - Check mode selector at top of chat

6. Test with Simple Queries First:
   - Start with: "urgent tasks"
   - Then: "open tasks"  
   - Then: "urgent open tasks"
   - Build complexity gradually

7. Check AI Response:
   - If AI returns invalid JSON, check prompt
   - If properties not recognized, check mappings
   - If typos not corrected, check examples

Common Issues:
- API key expired/invalid → Configure in settings
- Language not recognized → Check spelling in settings
- Properties not parsed → Verify AI prompt loaded
- No expansion → Enable semantic expansion setting
`);

console.log('\n✅ Phase 1 test script complete!');
console.log('📖 Refer to: docs/dev/AI_NLU_IMPLEMENTATION_PHASES.md');
console.log('📋 Full test cases: docs/dev/unified-query-system/test-scripts/ai-nlu-test-cases.md\n');

# Settings Tab Current Structure (Backup)

## Current Section Order

1. Understanding Settings Overview (lines 31-97)
2. AI provider (line 100)
3. Chat (line 277)
4. Stop words (line 707)
5. Task display (line 750)
6. Scoring coefficients (line 823)
7. Advanced scoring coefficients (line 993)
8. Multi-criteria sorting (line 2734)
9. Advanced (line 1424)
10. DataView integration (line 1460)
11. Priority mapping (line 1553)
12. Status categories (line 1653)
13. Pricing data (line 1839)
14. Usage statistics (line 1896)

## New Section Order (To Implement)

1. AI provider
2. Chat modes
3. Semantic search
4. Task chat
5. DataView integration
6. Status categories
7. Task filtering
8. Task scoring
9. Task sorting
10. Task display
11. Advanced

## Section Mapping

Current → New:
- AI provider (100) → AI provider (1)
- Chat (277) → Split into: Chat modes (2), Semantic search (3), Task chat (4)
- DataView integration (1460) → DataView integration (5)
- Status categories (1653) → Status categories (6)
- Stop words (707) → Task filtering (7)
- Scoring coefficients (823) + Advanced scoring (993) → Task scoring (8)
- Multi-criteria sorting (2734) → Task sorting (9)
- Task display (750) → Task display (10)
- Advanced (1424) + Pricing (1839) + Usage stats (1896) → Advanced (11)
- Priority mapping (1553) → Remove or merge into DataView

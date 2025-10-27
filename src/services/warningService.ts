/**
 * Warning Service
 * Centralized management of all warning messages, diagnostics, and cleanup
 */

import { PluginSettings } from "../settings";
import { Task } from "../models/task";

/**
 * Generate detailed diagnostic message for zero-results scenarios
 * Analyzes user settings and provides specific, actionable recommendations
 */
export function generateZeroResultsDiagnostic(
    settings: PluginSettings,
    queryType: {
        hasKeywords: boolean;
        hasTaskProperties: boolean;
        queryType: "keywords-only" | "properties-only" | "mixed" | "empty";
    },
    maxScore: number,
    finalThreshold: number,
    filteredCount: number,
    topScores: Array<{
        score: number;
        relevanceScore: number;
        task: Task;
    }>,
): string {
    let message = `⚠️ **No Tasks Found After Filtering**\n\n`;
    message += `Found ${filteredCount} matching tasks, but all were filtered out.\n\n`;

    // Show top task score if available
    if (topScores.length > 0) {
        const topScore = topScores[0];
        const scorePercentage = (
            (topScore.score / finalThreshold) *
            100
        ).toFixed(0);
        message += `**Top Task Score:** ${topScore.score.toFixed(1)} points (needed: ${finalThreshold.toFixed(2)})`;

        // Show relevance if it's a keyword query
        if (queryType.hasKeywords) {
            const relevancePercentage = (topScore.relevanceScore * 100).toFixed(
                0,
            );
            message += ` | Relevance: ${relevancePercentage}%`;
        }

        message += `\n\n`;
    }

    message += `**Why Tasks Were Filtered:**\n`;

    const reasons: string[] = [];

    // Analyze quality filter
    if (settings.qualityFilterStrength > 0) {
        const percentage = Math.round(settings.qualityFilterStrength * 100);
        reasons.push(
            `• **Quality Filter:** ${percentage}% threshold eliminates low-scoring tasks (threshold: ${finalThreshold.toFixed(2)}/${maxScore.toFixed(1)} points)`,
        );
    }

    // Analyze minimum relevance
    if (settings.minimumRelevanceScore > 0) {
        const percentage = Math.round(settings.minimumRelevanceScore * 100);
        reasons.push(
            `• **Minimum Relevance:** ${percentage}% threshold requires strong keyword matches`,
        );
    }

    // Analyze relevance coefficient if very low
    if (queryType.hasKeywords && settings.relevanceCoefficient < 10) {
        reasons.push(
            `• **Low Relevance Coefficient:** ${settings.relevanceCoefficient} reduces keyword match importance (default: 20)`,
        );
    }

    // Add proximity analysis if top score is close
    if (topScores.length > 0) {
        const topScore = topScores[0];
        const ratio = topScore.score / finalThreshold;
        if (ratio >= 0.5 && ratio < 1.0) {
            reasons.push(
                `• **Tasks Are Close:** Top task is at ${(ratio * 100).toFixed(0)}% of threshold but not quite enough`,
            );
        } else if (ratio < 0.5) {
            reasons.push(
                `• **Tasks Too Far:** Top task is only ${(ratio * 100).toFixed(0)}% of threshold`,
            );
        }
    }

    // Add keyword weakness analysis
    if (
        queryType.hasKeywords &&
        settings.minimumRelevanceScore > 0 &&
        topScores.length > 0
    ) {
        const topRelevance = topScores[0].relevanceScore;
        if (topRelevance < settings.minimumRelevanceScore) {
            const actualPct = (topRelevance * 100).toFixed(0);
            const requiredPct = (settings.minimumRelevanceScore * 100).toFixed(
                0,
            );
            reasons.push(
                `• **Keyword Matches Too Weak:** ${actualPct}% < ${requiredPct}% minimum`,
            );
        }
    }

    message += reasons.join("\n") + "\n\n";

    // Generate quick fixes
    message += `**💡 Quick Fixes:**\n`;

    const fixes: string[] = [];

    // Suggest lowering quality filter
    if (settings.qualityFilterStrength > 0) {
        const current = Math.round(settings.qualityFilterStrength * 100);
        let suggested: number;
        if (current >= 50) {
            suggested = 30;
        } else if (current >= 30) {
            suggested = 20;
        } else if (current >= 20) {
            suggested = 10;
        } else {
            suggested = 0;
        }
        fixes.push(
            `• Lower quality filter to ${suggested}% (currently ${current}%)`,
        );
    }

    // Suggest lowering minimum relevance
    if (settings.minimumRelevanceScore > 0) {
        const current = Math.round(settings.minimumRelevanceScore * 100);
        const suggested = queryType.queryType === "properties-only" ? 0 : 30;
        fixes.push(
            `• ${queryType.queryType === "properties-only" ? "Disable" : "Lower"} minimum relevance to ${suggested}% (currently ${current}%)`,
        );
    }

    // Suggest increasing relevance coefficient if low
    if (queryType.hasKeywords && settings.relevanceCoefficient < 15) {
        fixes.push(
            `• Increase relevance coefficient to 20 (currently ${settings.relevanceCoefficient})`,
        );
    }

    message += fixes.join("\n") + "\n\n";

    // Additional options
    message += `**🔧 More Options:**\n`;
    message += `• Simplify your query (remove some filters)\n`;
    message += `• Check if tasks exist with these criteria\n`;
    message += `• Review Advanced Scoring settings\n\n`;

    // Link to troubleshooting
    message += `**📖 Detailed Guide:** [Troubleshooting filtering issues](https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#no-results-found)\n\n`;

    message += `---\n\n`;

    return message;
}

/**
 * Clean warning messages from content
 * Used when sending chat history to AI (removes warnings from context)
 * WARNING: Do NOT use when saving to chat history - warnings should be visible in UI
 */
export function cleanWarningsFromContent(content: string): string {
    // Remove zero-results diagnostic
    content = content.replace(
        /⚠️ \*\*No Tasks Found After Filtering\*\*[\s\S]*?---\n\n/g,
        "",
    );

    // Remove AI format issue warning
    content = content.replace(
        /⚠️ \*\*AI Response Format Issue\*\*[\s\S]*?---\n\n/g,
        "",
    );

    // Remove AI query parser failed warning
    content = content.replace(
        /⚠️ \*\*AI Query Parser Failed\*\*[\s\S]*?---\n\n/g,
        "",
    );

    // Remove any other warning blocks (pattern: ⚠️ **Title**...---\n\n)
    content = content.replace(/⚠️ \*\*[^*]+\*\*[\s\S]*?---\n\n/g, "");

    return content.trim();
}

/**
 * Generate AI format issue warning
 */
export function generateAIFormatWarning(
    taskCount: number,
    modelInfo: string,
    timestamp: string,
): string {
    return (
        `⚠️ **AI Response Format Issue**\n\n` +
        `The AI didn't use the expected task reference format. Showing **${taskCount}** tasks (scored by relevance) instead.\n\n` +
        `**💡 Quick Fixes:**\n` +
        `• Try your query again (AI behavior varies)\n` +
        `• Start new session (may help with consistency)\n` +
        `• Use larger model like GPT-5 (more reliable)\n\n` +
        `**🔧 Debug Info:** Model: ${modelInfo} | Time: ${timestamp}\n\n` +
        `**📖 Troubleshooting:** [AI format issues guide](https://github.com/wenlzhang/obsidian-task-chat/blob/main/docs/TROUBLESHOOTING.md#ai-model-format-issues)\n\n` +
        `---\n\n`
    );
}

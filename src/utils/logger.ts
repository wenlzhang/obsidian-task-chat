/**
 * Logging utility for Task Chat plugin
 * Follows Obsidian guidelines: minimize console output by default
 */

import { PluginSettings } from "../settings";

export class Logger {
    private static settings: PluginSettings | null = null;

    /**
     * Initialize logger with plugin settings
     */
    static initialize(settings: PluginSettings): void {
        this.settings = settings;
    }

    /**
     * Log debug information (only when debug logging is enabled)
     * @param message - Message to log
     * @param data - Optional data to include
     */
    static debug(message: string, ...data: unknown[]): void {
        if (this.settings?.enableDebugLogging) {
            console.log(`[Task Chat] ${message}`, ...data);
        }
    }

    /**
     * Log errors (always shown, regardless of debug setting)
     * @param message - Error message
     * @param error - Optional error object
     */
    static error(message: string, error?: unknown): void {
        if (error) {
            console.error(`[Task Chat] ${message}`, error);
        } else {
            console.error(`[Task Chat] ${message}`);
        }
    }

    /**
     * Log warnings (always shown, regardless of debug setting)
     * @param message - Warning message
     * @param data - Optional data to include
     */
    static warn(message: string, ...data: unknown[]): void {
        console.warn(`[Task Chat] ${message}`, ...data);
    }

    /**
     * Log info (only when debug logging is enabled)
     * @param message - Info message
     * @param data - Optional data to include
     */
    static info(message: string, ...data: unknown[]): void {
        if (this.settings?.enableDebugLogging) {
            console.info(`[Task Chat] ${message}`, ...data);
        }
    }
}

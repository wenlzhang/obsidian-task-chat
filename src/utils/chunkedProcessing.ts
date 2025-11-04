/**
 * Chunked processing utilities for non-blocking background operations
 *
 * Even with vectorized operations, processing very large datasets (>5000 items)
 * can block the main thread. This module provides chunked processing with
 * periodic yielding to keep the UI responsive.
 *
 * HYBRID APPROACH:
 * - Use vectorized operations for speed (batch calculations)
 * - Process in chunks to avoid blocking (background processing)
 * - Best of both worlds: Fast AND responsive
 */

import { CHUNK_SIZES } from "./constants";

/**
 * Yield to browser event loop using requestAnimationFrame
 * More efficient and smoother than setTimeout(0)
 */
export async function yieldToUI(): Promise<void> {
    return new Promise((resolve) => {
        // Use requestAnimationFrame for smooth ~16ms yields
        requestAnimationFrame(() => resolve());
    });
}

/**
 * Process array in chunks with periodic yielding
 *
 * @param items - Array to process
 * @param processor - Function to process each item
 * @param chunkSize - Number of items to process before yielding (uses CHUNK_SIZES.DEFAULT if not specified)
 * @param onProgress - Optional progress callback
 * @returns Promise that resolves when all items are processed
 */
export async function processInChunks<T>(
    items: T[],
    processor: (item: T, index: number) => void,
    chunkSize: number = CHUNK_SIZES.DEFAULT,
    onProgress?: (processed: number, total: number) => void,
): Promise<void> {
    const total = items.length;

    for (let i = 0; i < total; i += chunkSize) {
        const end = Math.min(i + chunkSize, total);

        // Process chunk synchronously (fast)
        for (let j = i; j < end; j++) {
            processor(items[j], j);
        }

        // Report progress
        if (onProgress) {
            onProgress(end, total);
        }

        // Yield to UI if more chunks remain
        if (end < total) {
            await yieldToUI();
        }
    }
}

/**
 * Filter array in chunks with periodic yielding
 *
 * @param items - Array to filter
 * @param predicate - Filter predicate
 * @param chunkSize - Number of items to process before yielding
 * @returns Filtered array
 */
export async function filterInChunks<T>(
    items: T[],
    predicate: (item: T, index: number) => boolean,
    chunkSize = 500,
): Promise<T[]> {
    const result: T[] = [];
    const total = items.length;

    for (let i = 0; i < total; i += chunkSize) {
        const end = Math.min(i + chunkSize, total);

        // Filter chunk synchronously (fast)
        for (let j = i; j < end; j++) {
            if (predicate(items[j], j)) {
                result.push(items[j]);
            }
        }

        // Yield to UI if more chunks remain
        if (end < total) {
            await yieldToUI();
        }
    }

    return result;
}

/**
 * Map array in chunks with periodic yielding
 *
 * @param items - Array to map
 * @param mapper - Mapping function
 * @param chunkSize - Number of items to process before yielding
 * @returns Mapped array
 */
export async function mapInChunks<T, R>(
    items: T[],
    mapper: (item: T, index: number) => R,
    chunkSize = 500,
): Promise<R[]> {
    const result: R[] = new Array(items.length);
    const total = items.length;

    for (let i = 0; i < total; i += chunkSize) {
        const end = Math.min(i + chunkSize, total);

        // Map chunk synchronously (fast)
        for (let j = i; j < end; j++) {
            result[j] = mapper(items[j], j);
        }

        // Yield to UI if more chunks remain
        if (end < total) {
            await yieldToUI();
        }
    }

    return result;
}

/**
 * Vectorized operation in chunks
 * Processes data in vectorized batches, yielding between batches
 *
 * @param batchProcessor - Function that processes a batch (should be vectorized internally)
 * @param totalItems - Total number of items
 * @param chunkSize - Batch size before yielding
 */
export async function vectorizedInChunks<T>(
    batchProcessor: (startIndex: number, endIndex: number) => T,
    totalItems: number,
    chunkSize = 1000,
): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < totalItems; i += chunkSize) {
        const end = Math.min(i + chunkSize, totalItems);

        // Process batch (vectorized)
        const batchResult = batchProcessor(i, end);
        results.push(batchResult);

        // Yield to UI if more batches remain
        if (end < totalItems) {
            await yieldToUI();
        }
    }

    return results;
}

/**
 * Performance timer with automatic logging
 */
export class PerformanceTimer {
    private startTime: number;
    private label: string;

    constructor(label: string) {
        this.label = label;
        this.startTime = performance.now();
    }

    lap(sublabel?: string): number {
        const elapsed = performance.now() - this.startTime;
        const fullLabel = sublabel ? `${this.label} - ${sublabel}` : this.label;
        console.debug(`[Performance] ${fullLabel}: ${elapsed.toFixed(1)}ms`);
        return elapsed;
    }

    reset(): void {
        this.startTime = performance.now();
    }
}

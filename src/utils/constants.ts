/**
 * Global constants for the plugin
 * Centralized configuration for performance tuning
 */

/**
 * Chunked processing configuration
 * Controls how many items to process before yielding to event loop
 * to keep UI responsive during long operations.
 *
 * Tuning guidelines:
 * - Smaller values (200-300): More responsive UI, slightly slower processing
 * - Larger values (700-1000): Less responsive UI, faster processing
 * - Recommended range: 400-600 for best balance
 */
export const CHUNK_SIZES = {
    /**
     * General purpose chunk size for most operations
     * Used in: Property extraction, validation, task processing
     */
    DEFAULT: 500,

    /**
     * Chunk size for lightweight operations (text extraction, simple validation)
     * Can be larger since operations are fast
     */
    LIGHTWEIGHT: 1000,

    /**
     * Chunk size for expensive operations (property parsing, scoring)
     * Smaller to ensure UI remains responsive
     */
    EXPENSIVE: 300,

    /**
     * Chunk size for vectorized batch operations
     * Can be larger because vectorized ops are inherently fast
     */
    VECTORIZED: 1000,
} as const;

/**
 * API-level early limiting configuration
 * Controls how many tasks to process at API level before creating Task objects
 *
 * KEY OPTIMIZATION: By limiting early, we avoid expensive Task object creation
 * for tasks that won't be used anyway.
 *
 * Example: Instead of creating 46,981 Task objects and then taking top 100,
 * we score at API level, take top 100, then create only 100 Task objects.
 * Performance gain: 470x fewer objects to create!
 */
export const API_LIMITS = {
    /**
     * Maximum tasks to score at API level when keywords are present
     * After relevance filtering, we typically have 100-1000 tasks
     */
    WITH_KEYWORDS: 2000,

    /**
     * Maximum tasks to score at API level when no keywords (property-only queries)
     * We need a larger buffer since no relevance filtering happens
     */
    WITHOUT_KEYWORDS: 5000,

    /**
     * Multiplier for initial limit before comprehensive scoring
     * We take (maxTasksForAI * BUFFER_MULTIPLIER) tasks, score them all,
     * then return top maxTasksForAI
     */
    BUFFER_MULTIPLIER: 10,
} as const;

/**
 * @deprecated Use CHUNK_SIZES instead
 * Kept for backwards compatibility
 */
export const BATCH_PROCESSING = {
    FILTER_BATCH_SIZE: CHUNK_SIZES.DEFAULT,
    VALIDATION_BATCH_SIZE: CHUNK_SIZES.DEFAULT,
    PROCESSING_BATCH_SIZE: CHUNK_SIZES.DEFAULT,
    SCORING_BATCH_SIZE: CHUNK_SIZES.DEFAULT,
} as const;

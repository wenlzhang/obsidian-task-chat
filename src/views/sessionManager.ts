import {
    ChatSession,
    SessionData,
    ChatMessage,
    TaskFilter,
} from "../models/task";

/**
 * Service for managing chat sessions
 */
export class SessionManager {
    private sessions: Map<string, ChatSession>;
    private currentSessionId: string | null;
    private lastSessionId: string | null;

    constructor() {
        this.sessions = new Map();
        this.currentSessionId = null;
        this.lastSessionId = null;
    }

    /**
     * Initialize from saved data
     */
    loadFromData(data: SessionData): void {
        this.sessions.clear();

        // Defensive check: ensure data exists and has the right structure
        if (!data) {
            this.currentSessionId = null;
            this.lastSessionId = null;
            return;
        }

        if (data.sessions && Array.isArray(data.sessions)) {
            data.sessions.forEach((session) => {
                // Ensure each session has required fields
                if (session && session.id) {
                    this.sessions.set(session.id, session);
                }
            });
        }

        this.currentSessionId = data.currentSessionId ?? null;
        this.lastSessionId = data.lastSessionId ?? null;
    }

    /**
     * Export data for saving
     */
    exportData(): SessionData {
        return {
            sessions: Array.from(this.sessions.values()),
            currentSessionId: this.currentSessionId,
            lastSessionId: this.lastSessionId,
        };
    }

    /**
     * Create a new session
     * Automatically prunes oldest sessions if maxSessions limit is exceeded
     *
     * @param name - Optional session name
     * @param maxSessions - Maximum number of sessions to keep (optional, defaults to no limit)
     */
    createSession(name?: string, maxSessions?: number): ChatSession {
        const id = this.generateSessionId();
        const now = Date.now();

        const session: ChatSession = {
            id,
            name: name || this.generateSessionName(),
            messages: [],
            createdAt: now,
            updatedAt: now,
        };

        this.sessions.set(id, session);
        this.currentSessionId = id;
        this.lastSessionId = id;

        // Enforce session limit by removing oldest sessions
        if (maxSessions !== undefined && this.sessions.size > maxSessions) {
            const excess = this.sessions.size - maxSessions;
            // Get all sessions sorted by update time (oldest first)
            const sortedSessions = Array.from(this.sessions.values()).sort(
                (a, b) => a.updatedAt - b.updatedAt,
            );
            // Delete the oldest excess sessions
            for (let i = 0; i < excess; i++) {
                this.sessions.delete(sortedSessions[i].id);
            }
        }

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(id: string): ChatSession | undefined {
        return this.sessions.get(id);
    }

    /**
     * Get current session
     */
    getCurrentSession(): ChatSession | null {
        if (!this.currentSessionId) {
            return null;
        }
        return this.sessions.get(this.currentSessionId) || null;
    }

    /**
     * Get or create current session
     *
     * @param maxSessions - Maximum number of sessions to keep (optional, defaults to no limit)
     */
    getOrCreateCurrentSession(maxSessions?: number): ChatSession {
        let session = this.getCurrentSession();
        if (!session) {
            session = this.createSession(undefined, maxSessions);
        }
        return session;
    }

    /**
     * Switch to a different session
     */
    switchSession(id: string): ChatSession | null {
        const session = this.sessions.get(id);
        if (session) {
            this.currentSessionId = id;
            this.lastSessionId = id;
            return session;
        }
        return null;
    }

    /**
     * Update session
     */
    updateSession(id: string, updates: Partial<ChatSession>): void {
        const session = this.sessions.get(id);
        if (session) {
            Object.assign(session, updates, {
                updatedAt: Date.now(),
            });
        }
    }

    /**
     * Add message to current session
     *
     * @param message - Message to add
     * @param maxSessions - Maximum number of sessions to keep (optional, defaults to no limit)
     */
    addMessage(message: ChatMessage, maxSessions?: number): void {
        const session = this.getOrCreateCurrentSession(maxSessions);
        session.messages.push(message);
        session.updatedAt = Date.now();
    }

    /**
     * Get messages from current session
     */
    getCurrentMessages(): ChatMessage[] {
        const session = this.getCurrentSession();
        return session ? session.messages : [];
    }

    /**
     * Clear messages in current session
     */
    clearCurrentSession(): void {
        const session = this.getCurrentSession();
        if (session) {
            session.messages = [];
            session.updatedAt = Date.now();
        }
    }

    /**
     * Delete a session
     */
    deleteSession(id: string): void {
        this.sessions.delete(id);

        // If deleting current session, switch to another or create new
        if (this.currentSessionId === id) {
            const remaining = this.getAllSessions();
            if (remaining.length > 0) {
                this.currentSessionId = remaining[0].id;
                this.lastSessionId = remaining[0].id;
            } else {
                this.currentSessionId = null;
                this.lastSessionId = null;
            }
        }
    }

    /**
     * Get all sessions sorted by update time
     */
    getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt,
        );
    }

    /**
     * Rename a session
     */
    renameSession(id: string, name: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.name = name;
            session.updatedAt = Date.now();
        }
    }

    /**
     * Update session filter
     */
    updateSessionFilter(id: string, filter: TaskFilter): void {
        const session = this.sessions.get(id);
        if (session) {
            session.filter = filter;
            session.updatedAt = Date.now();
        }
    }

    /**
     * Get session count
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    /**
     * Generate default session name
     */
    private generateSessionName(): string {
        const date = new Date();
        const month = date.toLocaleString("default", { month: "short" });
        const day = date.getDate();
        const time = date.toLocaleTimeString("default", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        return `Chat ${month} ${day}, ${time}`;
    }
}

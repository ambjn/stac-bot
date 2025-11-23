/**
 * formats a timestamp to iso string
 */
export const formatTimestamp = (date: Date = new Date()): string => {
    return date.toISOString();
};

/**
 * formats latency with ms suffix
 */
export const formatLatency = (ms: number): string => {
    return `${ms}ms`;
};

/**
 * escapes markdown v2 special characters for telegram
 */
export const escapeMarkdownV2 = (text: string): string => {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

/**
 * generates a random room id
 */
export const generateRoomId = (): string => {
    return Math.random().toString(36).substring(2, 8);
};

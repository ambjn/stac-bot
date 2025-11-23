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

/**
 * formats a number as currency
 */
export const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * formats a percentage
 */
export const formatPercentage = (value: number, total: number): string => {
    if (total === 0) return '0.0%';
    return ((value / total) * 100).toFixed(1) + '%';
};

/**
 * parses command arguments from message text
 * e.g. "/invite abc123 @user" -> ["abc123", "@user"]
 */
export const parseCommandArgs = (text: string): string[] => {
    const parts = text.trim().split(/\s+/);
    return parts.slice(1); // remove command itself
};

/**
 * extracts username without @ prefix
 */
export const parseUsername = (raw: string): string => {
    return raw.replace(/^@/, '');
};

/**
 * validates a room id format (6 alphanumeric chars)
 */
export const isValidRoomId = (id: string): boolean => {
    return /^[a-z0-9]{6}$/.test(id);
};

/**
 * parses a numeric value from string, returns null if invalid
 */
export const parseNumber = (value: string): number | null => {
    const num = Number(value);
    return isNaN(num) ? null : num;
};

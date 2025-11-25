import { supabase } from './connection';

export interface User {
    userId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    createdAt: Date;
    lastSeen: Date;
}

/**
 * Registers or updates a user when they use /start
 * If user exists, updates their last_seen timestamp
 * If user doesn't exist, creates a new record
 */
export const registerUser = async (
    userId: number,
    username?: string,
    firstName?: string,
    lastName?: string
): Promise<User> => {
    // Check if user exists
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (existingUser) {
        // Update existing user - update last_seen and potentially username/names if changed
        const { data, error } = await supabase
            .from('users')
            .update({
                username,
                first_name: firstName,
                last_name: lastName,
                last_seen: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update user: ${error.message}`);

        return {
            userId: data.user_id,
            username: data.username,
            firstName: data.first_name,
            lastName: data.last_name,
            createdAt: new Date(data.created_at),
            lastSeen: new Date(data.last_seen)
        };
    } else {
        // Create new user
        const { data, error } = await supabase
            .from('users')
            .insert({
                user_id: userId,
                username,
                first_name: firstName,
                last_name: lastName
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to register user: ${error.message}`);

        return {
            userId: data.user_id,
            username: data.username,
            firstName: data.first_name,
            lastName: data.last_name,
            createdAt: new Date(data.created_at),
            lastSeen: new Date(data.last_seen)
        };
    }
};

/**
 * Get user by user ID
 */
export const getUser = async (userId: number): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) return null;

    return {
        userId: data.user_id,
        username: data.username,
        firstName: data.first_name,
        lastName: data.last_name,
        createdAt: new Date(data.created_at),
        lastSeen: new Date(data.last_seen)
    };
};

/**
 * Get user by username
 */
export const getUserByUsername = async (username: string): Promise<User | null> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !data) return null;

    return {
        userId: data.user_id,
        username: data.username,
        firstName: data.first_name,
        lastName: data.last_name,
        createdAt: new Date(data.created_at),
        lastSeen: new Date(data.last_seen)
    };
};

/**
 * Get all registered users
 */
export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
        userId: row.user_id,
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name,
        createdAt: new Date(row.created_at),
        lastSeen: new Date(row.last_seen)
    }));
};

/**
 * Get count of total users
 */
export const getUserCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count ?? 0;
};

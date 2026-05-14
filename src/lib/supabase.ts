import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffomyqmyactoylflhgvk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb215cW15YWN0b3lsZmxoZ3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MjIwOTUsImV4cCI6MjA5NDI5ODA5NX0.0nddAhZBCDQBYmnzwj3eOl4P2QMwZI0jHRj13JSFliY';

const webStorageAdapter = {
  getItem: (key: string) => {
    const value = localStorage.getItem(key);
    return Promise.resolve(value);
  },
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: webStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

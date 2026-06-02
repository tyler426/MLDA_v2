// Migrated to Supabase. This file used to create the Base44 client; it now
// re-exports the Supabase-backed compatibility adapter under the same name, so
// every `import { base44 } from '@/api/base44Client'` across the app keeps
// working without edits. See src/api/db.js for the implementation.
import { db } from '@/api/db';

export const base44 = db;
export default base44;

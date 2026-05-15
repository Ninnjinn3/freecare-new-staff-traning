
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDemoUsers() {
    console.log('Checking demo users in staff_master...');
    const { data, error } = await supabase
        .from('staff_master')
        .select('staff_id, name, role')
        .in('staff_id', ['FC001', 'FC002', 'FC003']);

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('Found users:', JSON.stringify(data, null, 2));
    
    if (!data || data.length === 0) {
        console.log('No demo users found in Supabase.');
    }
}

checkDemoUsers();

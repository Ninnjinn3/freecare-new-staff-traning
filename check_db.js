const { createClient } = require('@supabase/supabase-js');
const url = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const apiKey = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';
const supabase = createClient(url, apiKey);

async function run() {
    const { data, error } = await supabase.from('facilities').select('*');
    console.log('Facilities in DB:');
    for (const row of data || []) {
        console.log(`- ${row.id}: ${row.name}`);
    }
    if (error) console.error(error);
}
run();

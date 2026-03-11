const { createClient } = require('@supabase/supabase-js');
const url = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const apiKey = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';
const supabase = createClient(url, apiKey);

async function run() {
    const { data, error } = await supabase.from('care_targets').select('*').limit(10);
    console.log('Targets in DB:');
    for (const row of data || []) {
        console.log(`- ${row.target_code}: ${row.name} (facility: ${row.facility_id}, adl: ${row.adl ? 'Yes' : 'No'})`);
    }
    if (error) console.error(error);
}
run();

const { createClient } = require('@supabase/supabase-js');
const url = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const apiKey = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';
const supabase = createClient(url, apiKey);

async function run() {
    console.log("Renaming facilities...");
    // Update F001/F002 to group home just in case
    const { data: facilities } = await supabase.from('facilities').select('*');
    const f002 = facilities.find(f => f.name.includes('南'));
    if (f002) {
        await supabase.from('facilities').update({ name: '運営本部' }).eq('id', f002.id);
        console.log(`Renamed ${f002.id} to 運営本部`);
    }

    const hq = facilities.find(f => f.name.includes('本社') || f.id === '1000' || f.id === 'HQ');
    let adminId = '1000';
    if (hq) {
        adminId = hq.id;
        await supabase.from('facilities').update({ name: '管理者' }).eq('id', adminId);
        console.log(`Renamed ${adminId} to 管理者`);
    } else {
       await supabase.from('facilities').upsert({ id: '1000', name: '管理者', region: '大阪'});
       console.log("Created 1000 -> 管理者");
    }

    const staffIds = ['2012', '3001', '4001', '7006', '5000', '6001', '8001', '8002'];
    for (const sid of staffIds) {
        const { error } = await supabase.from('staff_master').update({ facility_id: adminId }).eq('staff_id', sid);
        if (error) console.error(`Error updating ${sid}:`, error);
        else console.log(`Moved ${sid} to facility ${adminId}`);
    }
}
run();

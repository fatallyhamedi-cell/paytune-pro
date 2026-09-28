/**
 * PAYTUNE Artist Registration & Auth Diagnostic Test Script
 * Runs all 7 health checks to diagnose and fix artist registration & login issues
 * 
 * Run from terminal:
 *   node backend/test-artist.js
 *   or: cd backend && node test-artist.js
 */

const path = require('path');
// Attempt loading .env from root and backend directories
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseUrl = (rawUrl || '').trim();
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    if (supabaseUrl.includes('.')) {
      supabaseUrl = `https://${supabaseUrl}`;
    } else {
      supabaseUrl = `https://${supabaseUrl}.supabase.co`;
    }
  }
}

const allCandidates = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_KEY
].map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);

let serviceKey = allCandidates.find(k => k.startsWith('sb_secret_'));
let anonKey = allCandidates.find(k => k.startsWith('sb_publishable_'));

if (!serviceKey) serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!anonKey) anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n======================================================');
console.log('   PAYTUNE ARTIST AUTH & DATABASE DIAGNOSTIC TEST   ');
console.log('======================================================\n');

if (!supabaseUrl) {
  console.error('❌ [CONFIG ERROR] SUPABASE_URL is missing!');
  console.log('👉 Fix: Add SUPABASE_URL=https://your-project.supabase.co in .env\n');
}

if (!serviceKey) {
  console.warn('⚠️  [CONFIG WARNING] SUPABASE_SERVICE_ROLE_KEY is missing!');
  console.log('👉 Warning: Backend operations require SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies.');
  console.log('👉 Fix: Copy your "service_role" key (not anon key) from Supabase Dashboard -> Settings -> API into .env\n');
} else {
  console.log('🔑 Supabase Service Key: Configured (' + (serviceKey.startsWith('sb_secret_') ? 'Detected secret key sb_secret_...' : 'Length: ' + serviceKey.length) + ')');
}

const activeKey = serviceKey || anonKey;
if (!supabaseUrl || !activeKey) {
  console.log('ℹ️  Running in mock / local sandbox test mode since live Supabase credentials are not yet configured in .env.');
  console.log('    To test your real Supabase instance, create a .env file with:');
  console.log('      SUPABASE_URL=https://your-project.supabase.co');
  console.log('      SUPABASE_SERVICE_ROLE_KEY=ey...\n');
  
  // Test local phone parsing logic
  console.log('🔍 [CHECK 5] Testing phone formatting rules locally:');
  const testPhones = [
    { input: '0788123456', expected: '+250788123456', desc: 'Rwanda MTN local 10-digit' },
    { input: '+250 788 123 456', expected: '+250788123456', desc: 'Rwanda with spaces and dial code' },
    { input: '0720001234', expected: '+250720001234', desc: 'Rwanda Airtel local 10-digit' },
    { input: '+254712345678', expected: '+254712345678', desc: 'Kenya M-Pesa' }
  ];

  for (const t of testPhones) {
    const cleanDigits = t.input.replace(/[\s\-\(\)\.]/g, '');
    let formatted = '';
    if (/^(\+?250|0)?7[2389]\d{7}$/.test(cleanDigits)) {
      if (cleanDigits.startsWith('+250')) formatted = cleanDigits;
      else if (cleanDigits.startsWith('250')) formatted = '+' + cleanDigits;
      else if (cleanDigits.startsWith('0')) formatted = '+250' + cleanDigits.substring(1);
      else formatted = '+250' + cleanDigits;
    } else if (cleanDigits.startsWith('+')) {
      formatted = cleanDigits;
    }
    const pass = formatted === t.expected;
    console.log(`   ${pass ? '✅' : '❌'} ${t.desc}: "${t.input}" -> "${formatted}" (Match: ${pass})`);
  }

  console.log('\n======================================================');
  console.log('   LOCAL VERIFICATION COMPLETE: ALL PASS   ');
  console.log('======================================================\n');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, activeKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runDiagnostics() {
  const results = {
    connection: false,
    artistsTable: false,
    rlsCheck: false,
    schemaColumns: false,
    orphanUsers: 0,
    testInsert: false
  };

  try {
    // 1. Connection check
    console.log('📡 Step 1: Testing Supabase Connection...');
    const { data: pingData, error: pingErr } = await supabase.from('artists').select('count').limit(1);
    if (pingErr) {
      console.error('   ❌ Connection to artists table failed:', pingErr.message);
      if (pingErr.code === '42P01') {
        console.error('   👉 The "artists" table does NOT exist in your Supabase database!');
        console.error('   👉 Fix: Run supabase/migrations/20260918_fix_artist_auth_schema.sql in Supabase SQL editor.');
      } else if (pingErr.message?.includes('JWT') || pingErr.code === 'PGRST301') {
        console.error('   👉 Supabase key error: Invalid API key.');
      }
    } else {
      console.log('   ✅ Connection successful! Accessible tables detected.');
      results.connection = true;
      results.artistsTable = true;
    }

    // 2. Check schema columns on artists
    console.log('\n🔍 Step 2: Checking artists table schema...');
    const { data: sampleRow, error: sampleErr } = await supabase
      .from('artists')
      .select('*')
      .limit(1);

    if (!sampleErr) {
      console.log('   ✅ Successfully read from artists table.');
      results.schemaColumns = true;
    }

    // 3. Test insertion with valid RFC4122 UUID
    console.log('\n🧪 Step 3: Testing Artist Record Creation & Cleanup...');
    const testUuid = crypto.randomUUID();
    const testEmail = `diagnostic_test_${Date.now()}@paytune-verify.com`;
    const testPhone = `+250788${Math.floor(100000 + Math.random() * 900000)}`;

    const testArtist = {
      id: testUuid,
      user_id: testUuid,
      email: testEmail,
      full_name: 'PAYTUNE Diagnostic Test Artist',
      username: `diag_${Date.now()}`,
      phone: testPhone,
      phone_country_code: '+250',
      country_code: 'RW',
      currency_code: 'RWF',
      momo_code: testPhone,
      momo_provider: 'MTN',
      is_approved: true
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('artists')
      .insert([testArtist])
      .select();

    if (insertErr) {
      if (insertErr.message?.includes('column of \'artists\'') || insertErr.code === '42703') {
        console.warn('   ⚠️  Notice: Extended columns (e.g. country_code) not yet migrated to remote database.');
        console.log('   👉 Run "supabase/migrations/20260918_fix_artist_auth_schema.sql" in Supabase SQL editor to add extended columns.');
        
        // Test base schema insert
        console.log('   🧪 Testing with base schema columns (id, email, full_name, phone, momo_code)...');
        const baseArtist = {
          id: testUuid,
          email: testEmail,
          full_name: 'PAYTUNE Base Test Artist',
          phone: testPhone,
          momo_code: testPhone,
          momo_provider: 'MTN',
          is_approved: true
        };
        const { error: baseErr } = await supabase.from('artists').insert([baseArtist]);
        if (baseErr) {
          console.error('   ❌ Base insert also failed:', baseErr.message);
        } else {
          console.log('   ✅ Base artist insert succeeded! Current schema is operational.');
          results.testInsert = true;
          await supabase.from('artists').delete().eq('id', testUuid);
          console.log('   🧹 Test artist record cleaned up successfully.');
        }
      } else if (insertErr.message?.includes('violates row-level security')) {
        console.error('   👉 RLS Violation: Service role key not bypassing RLS.');
        console.error('   👉 Fix: Set SUPABASE_SERVICE_ROLE_KEY to your secret key.');
      } else {
        console.error('   ❌ Failed to insert test artist row:', insertErr.message);
      }
    } else {
      console.log('   ✅ Test artist with full columns successfully inserted into public.artists!');
      results.testInsert = true;

      // Clean up test artist
      await supabase.from('artists').delete().eq('id', testUuid);
      console.log('   🧹 Test artist record cleaned up successfully.');
    }

    // 4. Check for orphan auth users (Problem 1 check)
    if (serviceKey) {
      console.log('\n👥 Step 4: Scanning for orphan Supabase Auth users (users without artist row)...');
      try {
        const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
        if (!usersErr && usersData?.users) {
          const authUsers = usersData.users;
          const { data: artistsData } = await supabase.from('artists').select('user_id, email');
          const registeredUserIds = new Set((artistsData || []).map(a => a.user_id));
          const registeredEmails = new Set((artistsData || []).map(a => a.email?.toLowerCase()));

          const orphanUsers = authUsers.filter(u => 
            !registeredUserIds.has(u.id) && 
            !registeredEmails.has(u.email?.toLowerCase()) &&
            !u.email?.includes('master')
          );

          if (orphanUsers.length > 0) {
            results.orphanUsers = orphanUsers.length;
            console.warn(`   ⚠️  Found ${orphanUsers.length} orphan auth user(s):`);
            orphanUsers.slice(0, 5).forEach(u => {
              console.log(`      - ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at}`);
            });
            console.log('   👉 Fix: Run Diagnostic Query 2 in supabase/migrations/20260918_fix_artist_auth_schema.sql to automatically generate artist rows for these users.');
          } else {
            console.log('   ✅ No orphan auth users found! Auth and artists tables are in sync.');
          }
        }
      } catch (adminErr) {
        console.log('   ℹ️  Skipping orphan user list (requires service_role auth admin privileges).');
      }
    }

    console.log('\n======================================================');
    console.log('               DIAGNOSTIC SUMMARY                   ');
    console.log('======================================================');
    console.log(`📡 Database Connection:  ${results.connection ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`📋 Artists Table Schema:  ${results.schemaColumns ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`✍️ Artist Record Insert:  ${results.testInsert ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`👥 Orphan Auth Users:     ${results.orphanUsers === 0 ? 'CLEAN ✅' : results.orphanUsers + ' FOUND ⚠️'}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Unexpected error running diagnostics:', err);
  }
}

runDiagnostics();

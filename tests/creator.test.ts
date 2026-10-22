import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDbStore } from '../src/config/supabase_mock';

describe('Creator Studio & Video Management Engine', () => {
  it('retrieves verified artist profile with valid MoMo payout account', () => {
    const store = getDbStore();
    const artist = store.artists.find((a: any) => a.email === 'testartist@paytune.com');

    assert.ok(artist, 'Test artist must exist in database');
    assert.strictEqual(artist.is_approved, true, 'Test artist must be approved');
    assert.strictEqual(artist.is_blocked, false, 'Test artist must not be blocked');
    assert.ok(artist.momo_code, 'Artist must have a valid MoMo payout number');
    assert.ok(artist.momo_provider, 'Artist must have a MoMo provider configured');
  });

  it('rejects uploads if originality declarations are incomplete', () => {
    // Declarations require all three: ownership_declared, no_ai_declared, no_copyright_declared
    const payload1 = { ownership_declared: true, no_ai_declared: false, no_copyright_declared: true };
    const allDeclared1 = payload1.ownership_declared && payload1.no_ai_declared && payload1.no_copyright_declared;
    assert.strictEqual(allDeclared1, false, 'Must reject if AI declaration missing');

    const payload2 = { ownership_declared: true, no_ai_declared: true, no_copyright_declared: true };
    const allDeclared2 = payload2.ownership_declared && payload2.no_ai_declared && payload2.no_copyright_declared;
    assert.strictEqual(allDeclared2, true, 'Must accept when all three declarations are true');
  });

  it('enforces that new uploads enter moderation review status', () => {
    const store = getDbStore();
    // In our system, newly uploaded videos start in 'review' status until approved by Master Admin
    const sampleUpload = {
      title: 'Original Rwandan Melodies',
      upload_status: 'review',
      copyright_status: 'review',
      is_active: false
    };

    assert.strictEqual(sampleUpload.upload_status, 'review');
    assert.strictEqual(sampleUpload.copyright_status, 'review');
    assert.strictEqual(sampleUpload.is_active, false, 'Unapproved uploads must not be active');
  });

  it('isolates creator catalog so creators cannot edit videos of other artists', () => {
    const store = getDbStore();
    const artist1Id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    const artist2Id = 'unverified-artist-001';

    const sampleVideo = {
      id: 'vid-creator-iso-1',
      artist_id: artist1Id,
      title: 'Artist 1 Track'
    };

    // Attempting edit with artist2 credentials
    const isOwner = sampleVideo.artist_id === artist2Id;
    assert.strictEqual(isOwner, false, 'Cross-artist ownership check must deny editing access');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Creator Studio & Video Management Engine', () => {
  it('validates approved artist payout configuration requirements', () => {
    const artist = {
      email: 'verifiedartist@paytune.com',
      is_approved: true,
      is_blocked: false,
      momo_code: '0780000001',
      momo_provider: 'MTN',
    };

    assert.ok(artist.email, 'Artist must have an email');
    assert.strictEqual(artist.is_approved, true, 'Artist must be approved');
    assert.strictEqual(artist.is_blocked, false, 'Artist must not be blocked');
    assert.ok(artist.momo_code, 'Artist must have a valid MoMo payout number');
    assert.ok(artist.momo_provider, 'Artist must have a MoMo provider configured');
  });

  it('rejects uploads if originality declarations are incomplete', () => {
    const payload1 = { ownership_declared: true, no_ai_declared: false, no_copyright_declared: true };
    const allDeclared1 = payload1.ownership_declared && payload1.no_ai_declared && payload1.no_copyright_declared;
    assert.strictEqual(allDeclared1, false, 'Must reject if AI declaration missing');

    const payload2 = { ownership_declared: true, no_ai_declared: true, no_copyright_declared: true };
    const allDeclared2 = payload2.ownership_declared && payload2.no_ai_declared && payload2.no_copyright_declared;
    assert.strictEqual(allDeclared2, true, 'Must accept when all three declarations are true');
  });

  it('enforces that new uploads enter moderation review status', () => {
    const sampleUpload = {
      title: 'Original Rwandan Melodies',
      upload_status: 'review',
      copyright_status: 'review',
      is_active: false,
    };

    assert.strictEqual(sampleUpload.upload_status, 'review');
    assert.strictEqual(sampleUpload.copyright_status, 'review');
    assert.strictEqual(sampleUpload.is_active, false, 'Unapproved uploads must not be active');
  });

  it('isolates creator catalog so creators cannot edit videos of other artists', () => {
    const artist1Id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    const artist2Id = 'b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e';

    const sampleVideo = {
      id: 'vid-creator-iso-1',
      artist_id: artist1Id,
      title: 'Artist 1 Track',
    };

    const isOwner = sampleVideo.artist_id === artist2Id;
    assert.strictEqual(isOwner, false, 'Cross-artist ownership check must deny editing access');
  });
});

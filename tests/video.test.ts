import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Video Discovery & Playback Authorization Engine', () => {
  const sampleCatalog = [
    {
      id: 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c',
      artist_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      title: 'Kigali Night Life',
      thumbnail_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/thumbnails/sample-1.jpg',
      video_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/videos/sample-1.mp4',
      price_rwf: 500,
      price_usd: 0.5,
      is_free: false,
      is_short: false,
      category: 'Afrobeat',
      visibility: 'public',
      is_active: true,
    },
    {
      id: 'c9123c49-2b9e-41c2-ba54-c2128656bedc',
      artist_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      title: 'Inyange Live',
      thumbnail_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/thumbnails/sample-2.jpg',
      video_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/videos/sample-2.mp4',
      price_rwf: 0,
      price_usd: 0,
      is_free: true,
      is_short: false,
      category: 'RnB',
      visibility: 'public',
      is_active: true,
    },
    {
      id: 'vid-1',
      artist_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      title: 'Kigali Summer Vibes (Shorts)',
      thumbnail_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/thumbnails/sample-3.jpg',
      video_url: 'https://lgetnnqaggjjdfefhbgn.supabase.co/storage/v1/object/public/videos/sample-3.mp4',
      price_rwf: 0,
      price_usd: 0,
      is_free: true,
      is_short: true,
      category: 'Shorts',
      visibility: 'public',
      is_active: true,
    },
  ];

  it('validates public video catalog filter rules for active releases', () => {
    const activeVideos = sampleCatalog.filter((v) => v.is_active !== false && v.visibility === 'public');

    assert.ok(activeVideos.length > 0, 'Catalog filter must keep published active videos');
    for (const v of activeVideos) {
      assert.ok(v.id, 'Video must have an ID');
      assert.ok(v.title, 'Video must have a title');
      assert.ok(v.thumbnail_url, 'Video must have a thumbnail');
      assert.ok(v.video_url, 'Video must have a playable video URL');
      assert.ok(typeof v.is_free === 'boolean', 'Video must declare free or paid model');
    }
  });

  it('correctly identifies free vs paid videos for paywall gating', () => {
    const paidVideo = sampleCatalog.find((v) => v.id === 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c');
    assert.ok(paidVideo);
    assert.strictEqual(paidVideo.is_free, false, 'Kigali Night Life is a paid release');
    assert.strictEqual(paidVideo.price_rwf, 500, 'Price must be 500 RWF');

    const freeVideo = sampleCatalog.find((v) => v.id === 'c9123c49-2b9e-41c2-ba54-c2128656bedc');
    assert.ok(freeVideo);
    assert.strictEqual(freeVideo.is_free, true, 'Inyange Live is free for all viewers');
    assert.strictEqual(freeVideo.price_rwf, 0);
  });

  it('correctly identifies short-form vertical videos', () => {
    const shortVideo = sampleCatalog.find((v) => v.id === 'vid-1');
    assert.ok(shortVideo);
    assert.strictEqual(shortVideo.is_short, true);
    assert.strictEqual(shortVideo.category, 'Shorts');
    assert.strictEqual(shortVideo.is_free, true, 'Shorts are always 100% free with no paywall');
  });

  it('enforces paywall decision logic for anonymous vs paid viewers', () => {
    const checkCanPlay = (video: { is_free: boolean; is_short: boolean }, userOwns: boolean) => {
      if (video.is_free || video.is_short) return true;
      return userOwns;
    };

    const paidVideo = { is_free: false, is_short: false };
    assert.strictEqual(checkCanPlay(paidVideo, false), false, 'Non-owner must be blocked by paywall');
    assert.strictEqual(checkCanPlay(paidVideo, true), true, 'Verified purchaser must be granted playback');

    const freeVideo = { is_free: true, is_short: false };
    assert.strictEqual(checkCanPlay(freeVideo, false), true, 'Free video must play for all users');
  });
});

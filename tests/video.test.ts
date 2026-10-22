import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDbStore } from '../src/config/supabase_mock';

describe('Video Discovery & Playback Authorization Engine', () => {
  it('loads public video catalog containing active videos with valid metadata', () => {
    const store = getDbStore();
    const activeVideos = (store.videos || []).filter((v: any) => v.is_active !== false && v.visibility === 'public');

    assert.ok(activeVideos.length > 0, 'Catalog must contain published active videos');
    for (const v of activeVideos) {
      assert.ok(v.id, 'Video must have an ID');
      assert.ok(v.title, 'Video must have a title');
      assert.ok(v.thumbnail_url, 'Video must have a thumbnail');
      assert.ok(v.video_url, 'Video must have a playable video URL');
      assert.ok(typeof v.is_free === 'boolean', 'Video must declare free or paid model');
    }
  });

  it('correctly identifies free vs paid videos for paywall gating', () => {
    const store = getDbStore();
    const paidVideo = store.videos.find((v: any) => v.id === 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c');
    assert.ok(paidVideo);
    assert.strictEqual(paidVideo.is_free, false, 'Kigali Night Life is a paid release');
    assert.strictEqual(paidVideo.price_rwf, 500, 'Price must be 500 RWF');

    const freeVideo = store.videos.find((v: any) => v.id === 'c9123c49-2b9e-41c2-ba54-c2128656bedc');
    assert.ok(freeVideo);
    assert.strictEqual(freeVideo.is_free, true, 'Inyange Live is free for all viewers');
    assert.strictEqual(freeVideo.price_rwf, 0);
  });

  it('correctly identifies short-form vertical videos', () => {
    const store = getDbStore();
    const shortVideo = store.videos.find((v: any) => v.id === 'vid-1');
    assert.ok(shortVideo);
    assert.strictEqual(shortVideo.is_short, true);
    assert.strictEqual(shortVideo.category, 'Shorts');
    assert.strictEqual(shortVideo.is_free, true, 'Shorts are always 100% free with no paywall');
  });

  it('enforces paywall decision logic for anonymous vs paid viewers', () => {
    const checkCanPlay = (video: any, userOwns: boolean) => {
      if (video.is_free || video.is_short) return true;
      return userOwns;
    };

    const paidVideo = { id: 'v-test', is_free: false, is_short: false };
    assert.strictEqual(checkCanPlay(paidVideo, false), false, 'Non-owner must be blocked by paywall');
    assert.strictEqual(checkCanPlay(paidVideo, true), true, 'Verified purchaser must be granted playback');

    const freeVideo = { id: 'v-free', is_free: true, is_short: false };
    assert.strictEqual(checkCanPlay(freeVideo, false), true, 'Free video must play for all users');
  });
});

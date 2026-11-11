import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateArtistQualification, PartnerProgramRules } from '../src/controllers/partnerProgramController';

describe('PayTune Partner Program (PPP) & Creator Monetization Engine', () => {
  const mockRules: PartnerProgramRules = {
    min_followers: 1000,
    min_free_views: 10000,
    min_watch_hours: 1000,
    artist_ad_share_pct: 40,
    measurement_period_days: 365,
    auto_ad_distribution: true,
  };

  it('correctly calculates in_progress status when artist has not met all thresholds', () => {
    const mockStore = {
      artists: [
        {
          id: 'artist-test-1',
          full_name: 'Budding Creator',
          subscribers_count: 250,
          phone_verified: true,
          is_approved: true,
          monetization_status: null
        }
      ],
      videos: [
        { id: 'v1', artist_id: 'artist-test-1', is_paid: false, views: 1200 },
        { id: 'v2', artist_id: 'artist-test-1', is_paid: true, views: 500 }
      ],
      subscriptions: [],
      watch_progress: [],
      watch_history: [],
      infringement_strikes: []
    };

    const qual = calculateArtistQualification('artist-test-1', mockStore, mockRules);

    assert.strictEqual(qual.followers, 250);
    assert.strictEqual(qual.totalFreeViews, 1200); // Only free videos count
    assert.strictEqual(qual.isAllEligible, false);
    assert.strictEqual(qual.status, 'in_progress');
    assert.strictEqual(qual.requirements.followers.passed, false);
    assert.strictEqual(qual.requirements.views.passed, false);
    assert.strictEqual(qual.requirements.verification.passed, true);
  });

  it('marks artist as eligible when all 5 qualification criteria are fulfilled', () => {
    const mockStore = {
      artists: [
        {
          id: 'artist-pro-1',
          full_name: 'Verified Pan-African Star',
          subscribers_count: 5000,
          phone_verified: true,
          is_approved: true,
          monetization_status: null
        }
      ],
      videos: [
        { id: 'v-free-1', artist_id: 'artist-pro-1', is_paid: false, views: 25000, duration: 240 }
      ],
      subscriptions: [],
      watch_progress: [
        { video_id: 'v-free-1', watched_seconds: 4000000 } // > 1,100 hours
      ],
      watch_history: [],
      infringement_strikes: []
    };

    const qual = calculateArtistQualification('artist-pro-1', mockStore, mockRules);

    assert.strictEqual(qual.followers, 5000);
    assert.strictEqual(qual.totalFreeViews, 25000);
    assert.strictEqual(qual.requirements.followers.passed, true);
    assert.strictEqual(qual.requirements.views.passed, true);
    assert.strictEqual(qual.requirements.watchHours.passed, true);
    assert.strictEqual(qual.requirements.verification.passed, true);
    assert.strictEqual(qual.requirements.policy.passed, true);
    assert.strictEqual(qual.isAllEligible, true);
    assert.strictEqual(qual.status, 'eligible');
  });

  it('disqualifies artist if active copyright strikes exist on account', () => {
    const mockStore = {
      artists: [
        {
          id: 'artist-strike-1',
          full_name: 'Infringing Creator',
          subscribers_count: 15000,
          phone_verified: true,
          is_approved: true
        }
      ],
      videos: [
        { id: 'v-st', artist_id: 'artist-strike-1', is_paid: false, views: 80000 }
      ],
      subscriptions: [],
      watch_progress: [{ video_id: 'v-st', watched_seconds: 5000000 }],
      watch_history: [],
      infringement_strikes: [
        { id: 'strike-1', artist_id: 'artist-strike-1', status: 'active', reason: 'Unlicensed beat' }
      ]
    };

    const qual = calculateArtistQualification('artist-strike-1', mockStore, mockRules);

    assert.strictEqual(qual.requirements.policy.passed, false);
    assert.strictEqual(qual.isAllEligible, false);
  });

  it('preserves existing approved_monetized status and tracks ad revenue split metrics', () => {
    const mockStore = {
      artists: [
        {
          id: 'artist-approved-1',
          full_name: 'Monetized Partner',
          subscribers_count: 14200,
          phone_verified: true,
          is_approved: true,
          monetization_status: 'approved_monetized',
          ad_earnings_rwf: 12500,
          ad_impressions_count: 2500
        }
      ],
      videos: [],
      subscriptions: [],
      watch_progress: [],
      watch_history: [],
      infringement_strikes: []
    };

    const qual = calculateArtistQualification('artist-approved-1', mockStore, mockRules);

    assert.strictEqual(qual.status, 'approved_monetized');
    assert.strictEqual(qual.adEarningsRwf, 12500);
    assert.strictEqual(qual.adImpressionsCount, 2500);
    assert.strictEqual(qual.artistAdSharePct, 40);
  });
});

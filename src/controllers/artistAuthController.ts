import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { parsePhoneNumber, isValidPhoneNumber } from '../utils/phoneUtil';
import { supabase, supabaseAdmin, rawSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { detectCountryFromRequest } from '../services/geoService';
import { getJwtSecret } from '../utils/jwtSecret';

const db = () => rawSupabaseAdmin || supabaseAdmin || supabase;
const JWT_EXPIRES_IN = '7d';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ARTIST_TYPES = new Set(['solo', 'group', 'band', 'orchestra', 'other']);

function slugifyHandle(base: string): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'artist';
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${clean}_${suffix}`;
}

function normalizeArtistHandle(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 60);
}

function makeProfileUsername(base: string, userId: string): string {
  const clean = String(base || 'artist')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 23) || 'artist';
  return `${clean}_${String(userId).slice(0, 6)}`.slice(0, 30);
}

export function generateArtistToken(artist: {
  id: string;
  user_id: string;
  channel_id?: string | null;
  email: string;
  artist_name?: string;
  country_code?: string;
  currency_code?: string;
}): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      userId: artist.user_id,
      id: artist.user_id,
      sub: artist.user_id,
      artistId: artist.id,
      channelId: artist.channel_id || null,
      role: 'artist',
      email: artist.email,
      fullName: artist.artist_name || 'Artist',
      country_code: artist.country_code || 'RW',
      currency_code: artist.currency_code || 'RWF',
      user_metadata: {
        role: 'artist',
        artistId: artist.id,
        channelId: artist.channel_id || null,
        full_name: artist.artist_name || 'Artist',
      },
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function resolveArtistContextByUser(userId: string) {
  const client = db();
  const { data: artistProfile } = await client
    .from('artist_profiles')
    .select('*')
    .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
    .maybeSingle();

  const { data: channel } = await client
    .from('creator_channels')
    .select('*')
    .or(`owner_user_id.eq.${userId},created_by_user_id.eq.${userId}`)
    .maybeSingle();

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { artistProfile, channel, profile };
}

function formatArtistPayload(params: {
  artistProfile: any;
  channel?: any;
  profile?: any;
  userId: string;
  email: string;
  phone?: string;
  countryCode: string;
  currencyCode: string;
  momoCode?: string | null;
  momoProvider?: string | null;
}) {
  const { artistProfile, channel, profile, userId, email, phone, countryCode, currencyCode, momoCode, momoProvider } = params;
  const artistId = artistProfile?.id || channel?.id || userId;
  const approvalStatus = artistProfile?.approval_status || channel?.approval_status || 'pending';
  const artistName =
    artistProfile?.artist_name ||
    channel?.channel_name ||
    profile?.display_name ||
    email.split('@')[0] ||
    'Artist';

  return {
    id: artistId,
    user_id: userId,
    channel_id: channel?.id || null,
    full_name: artistName,
    artist_name: artistName,
    artist_handle: artistProfile?.artist_handle || channel?.channel_handle || '',
    artist_type: artistProfile?.artist_type || 'solo',
    email,
    avatar_url: artistProfile?.avatar_path || channel?.avatar_path || null,
    banner_url: artistProfile?.banner_path || channel?.banner_path || null,
    bio: artistProfile?.bio_en || channel?.description_en || null,
    phone: phone || '',
    country_code: countryCode,
    currency_code: currencyCode,
    is_approved: approvalStatus === 'approved',
    approval_status: approvalStatus,
    momo_code: momoCode || phone || '',
    momo_provider: momoProvider || null,
  };
}

async function ensureBaseUserRoleAssignment(client: ReturnType<typeof db>, userId: string) {
  const { data: existing } = await client
    .from('user_role_assignments')
    .select('id, is_active')
    .eq('user_id', userId)
    .eq('role', 'user')
    .maybeSingle();

  if (!existing) {
    const { error } = await client.from('user_role_assignments').insert({
      user_id: userId,
      role: 'user',
      is_active: true,
    });
    if (error && error.code !== '23505') {
      throw error;
    }
  } else if (!existing.is_active) {
    const { error } = await client
      .from('user_role_assignments')
      .update({ is_active: true })
      .eq('id', existing.id);
    if (error) {
      throw error;
    }
  }
}

function parseAndFormatOptionalPhone(
  rawPhone: any,
  targetCountry: string
): { formattedPhone: string; resolvedCountry: string; error?: string } {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return { formattedPhone: '', resolvedCountry: targetCountry };
  }

  const cleanDigits = rawPhone.trim().replace(/[\s\-().]/g, '');
  if (/^(\+?250|0)?7[2389]\d{7}$/.test(cleanDigits)) {
    const suffix = cleanDigits.replace(/^(\+?250|0)/, '');
    return { formattedPhone: `+250${suffix}`, resolvedCountry: 'RW' };
  }

  try {
    if (cleanDigits.startsWith('+') && isValidPhoneNumber(cleanDigits)) {
      const parsed = parsePhoneNumber(cleanDigits);
      return {
        formattedPhone: parsed.format('E.164'),
        resolvedCountry: parsed.country || targetCountry,
      };
    }

    for (const c of [targetCountry, 'RW', 'KE', 'UG', 'TZ', 'US']) {
      if (isValidPhoneNumber(cleanDigits, c as any)) {
        const parsed = parsePhoneNumber(cleanDigits, c as any);
        return {
          formattedPhone: parsed.format('E.164'),
          resolvedCountry: parsed.country || c,
        };
      }
    }
  } catch {
    // Handled below
  }

  if (/^\+\d{8,15}$/.test(cleanDigits)) {
    return { formattedPhone: cleanDigits, resolvedCountry: targetCountry };
  }

  return {
    formattedPhone: '',
    resolvedCountry: targetCountry,
    error: `Invalid phone number for ${targetCountry}. Include country dial code (e.g. +250788123456).`,
  };
}

/**
 * POST /api/artist/register & POST /api/auth/artist/register
 * Automatic idempotent artist profile + creator channel provisioning on signup (no OTP step).
 */
export const registerArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'service_unavailable',
      message: 'Supabase database and authentication service is not configured.',
    });
  }

  try {
    const body = req.body || {};
    const authUserCtx = (req as any).user;
    const rawEmail = body.email;
    const rawPassword = body.password;
    const rawFullName = body.fullName ?? body.full_name ?? body.artist_name ?? body.artistName;
    const rawHandle = body.artistHandle ?? body.artist_handle;
    const rawArtistType = body.artistType ?? body.artist_type;
    const rawPhone = body.phone;
    const rawCountryCode = body.countryCode ?? body.country_code;
    const rawMomoCode = body.momoCode ?? body.momo_code;
    const rawMomoProvider = body.momoProvider ?? body.momo_provider;
    const rawBio = body.bio ?? body.bio_en;

    const geo = await detectCountryFromRequest(req);
    const client = db();
    const nowIso = new Date().toISOString();

    const { data: settingRow } = await client
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'platform_config')
      .maybeSingle();
    const autoApprove = Boolean((settingRow?.setting_value as any)?.auto_approve_artists);
    const approvalStatus = autoApprove ? 'approved' : 'pending';

    const COUNTRY_MAP: Record<string, { currency: string; provider: string }> = {
      RW: { currency: 'RWF', provider: 'MTN' },
      TZ: { currency: 'TZS', provider: 'M-Pesa' },
      KE: { currency: 'KES', provider: 'M-Pesa' },
      UG: { currency: 'UGX', provider: 'MTN' },
      NG: { currency: 'NGN', provider: 'Paystack' },
      GH: { currency: 'GHS', provider: 'MTN' },
      ZA: { currency: 'ZAR', provider: 'Paystack' },
      US: { currency: 'USD', provider: 'Stripe' },
      GB: { currency: 'GBP', provider: 'Stripe' },
      CA: { currency: 'CAD', provider: 'Stripe' },
      AU: { currency: 'AUD', provider: 'Stripe' },
    };

    // Mode A: Authenticated existing Supabase user registering their Artist profile
    if (authUserCtx?.id && !rawPassword) {
      const userId = String(authUserCtx.id);
      const artistName = String(rawFullName || '').trim();
      const artistType = String(rawArtistType || 'solo').trim().toLowerCase();

      if (!artistName || artistName.length < 2 || artistName.length > 160) {
        return res.status(400).json({
          success: false,
          error: 'validation_failed',
          message: 'Artist name must be between 2 and 160 characters.',
        });
      }

      if (!VALID_ARTIST_TYPES.has(artistType)) {
        return res.status(400).json({
          success: false,
          error: 'validation_failed',
          message: 'Invalid artist type. Must be one of: solo, group, band, orchestra, other.',
        });
      }

      const normalizedHandle = rawHandle
        ? normalizeArtistHandle(rawHandle)
        : slugifyHandle(artistName);

      if (normalizedHandle.length < 3 || normalizedHandle.length > 60 || !/^[a-z0-9_]+$/.test(normalizedHandle)) {
        return res.status(400).json({
          success: false,
          error: 'validation_failed',
          message: 'Artist handle must contain 3–60 lowercase letters, numbers, or underscores.',
        });
      }

      const { data: existingProfile, error: profileCheckErr } = await client
        .from('artist_profiles')
        .select('*')
        .or(`created_by_user_id.eq.${userId},primary_contact_user_id.eq.${userId}`)
        .maybeSingle();

      if (profileCheckErr) {
        return res.status(500).json({
          success: false,
          error: 'server_error',
          message: 'Could not verify your existing artist profile.',
        });
      }

      if (existingProfile) {
        return res.status(409).json({
          success: false,
          error: 'already_registered',
          message: 'You already have an artist profile.',
          artist: existingProfile,
        });
      }

      const { data: existingHandle, error: handleCheckErr } = await client
        .from('artist_profiles')
        .select('id')
        .ilike('artist_handle', normalizedHandle)
        .maybeSingle();

      if (handleCheckErr) {
        return res.status(500).json({
          success: false,
          error: 'server_error',
          message: 'Could not verify artist handle availability.',
        });
      }

      if (existingHandle) {
        return res.status(409).json({
          success: false,
          error: 'handle_taken',
          message: 'This artist handle is already taken.',
        });
      }

      const targetCountry = String(rawCountryCode || authUserCtx.country_code || geo.country_code || 'RW')
        .toUpperCase()
        .slice(0, 2);
      const phoneCheck = parseAndFormatOptionalPhone(rawPhone, targetCountry);
      if (phoneCheck.error) {
        return res.status(400).json({
          success: false,
          error: 'validation_failed',
          message: phoneCheck.error,
        });
      }

      const resolvedCountry = phoneCheck.resolvedCountry;
      const countryInfo = COUNTRY_MAP[resolvedCountry] || {
        currency: geo.currency_code || 'RWF',
        provider: 'MTN',
      };

      const { data: existingUserProfile } = await client
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingUserProfile) {
        const { error: profErr } = await client.from('profiles').insert({
          user_id: userId,
          username: makeProfileUsername(normalizedHandle, userId),
          display_name: artistName.slice(0, 100),
          bio: rawBio ? String(rawBio).trim().slice(0, 500) : null,
          country_code: targetCountry,
          preferred_language_code: 'en',
          account_status: 'active',
          is_verified: false,
          created_at: nowIso,
          updated_at: nowIso,
        });
        if (profErr) {
          return res.status(400).json({
            success: false,
            error: 'profile_init_failed',
            message: profErr.message || 'Could not initialize user profile for artist registration.',
          });
        }
      }

      const artistProfileId = crypto.randomUUID();
      const channelId = crypto.randomUUID();
      let createdChannelThisRequest = false;

      let insertedArtist: any = null;
      let resolvedChannel: any = null;
      let resolvedChannelId = channelId;
      let maskedDest: string | null = null;
      const destination = rawMomoCode ? String(rawMomoCode).trim() : phoneCheck.formattedPhone;
      const providerName = rawMomoProvider || countryInfo.provider;

      try {
        const { data: apData, error: apErr } = await client
          .from('artist_profiles')
          .insert({
            id: artistProfileId,
            artist_name: artistName,
            artist_handle: normalizedHandle,
            artist_type: artistType,
            bio_en: rawBio ? String(rawBio).trim() : null,
            country_code: targetCountry,
            primary_language_code: 'en',
            created_by_user_id: userId,
            primary_contact_user_id: userId,
            record_status: 'active',
            verification_status: 'not_submitted',
            approval_status: approvalStatus,
            is_public: true,
            approved_at: autoApprove ? nowIso : null,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select('*')
          .single();

        if (apErr) throw apErr;
        insertedArtist = apData;

        const { data: existingMember } = await client
          .from('artist_members')
          .select('id')
          .eq('artist_id', artistProfileId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingMember) {
          const { error: amErr } = await client.from('artist_members').insert({
            artist_id: artistProfileId,
            user_id: userId,
            member_role: 'owner',
            is_active: true,
            joined_at: nowIso,
            created_at: nowIso,
          });
          if (amErr) throw amErr;
        }

        const { data: existingChannel } = await client
          .from('creator_channels')
          .select('*')
          .eq('owner_user_id', userId)
          .maybeSingle();

        resolvedChannelId = existingChannel?.id || channelId;
        resolvedChannel = existingChannel;
        if (!existingChannel) {
          const { data: createdChannel, error: chInsertErr } = await client
            .from('creator_channels')
            .insert({
              id: resolvedChannelId,
              channel_name: artistName,
              channel_handle: normalizedHandle,
              channel_type: artistType === 'solo' ? 'individual' : 'brand',
              description_en: rawBio ? String(rawBio).trim() : null,
              country_code: targetCountry,
              primary_language_code: 'en',
              owner_user_id: userId,
              created_by_user_id: userId,
              record_status: 'active',
              verification_status: 'not_submitted',
              approval_status: approvalStatus,
              is_public: true,
              approved_at: autoApprove ? nowIso : null,
              created_at: nowIso,
              updated_at: nowIso,
            })
            .select('*')
            .single();
          if (chInsertErr) throw chInsertErr;
          resolvedChannel = createdChannel;
          createdChannelThisRequest = true;
        }

        const { data: existingChMember } = await client
          .from('creator_channel_members')
          .select('id')
          .eq('channel_id', resolvedChannelId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingChMember) {
          const { error: ccmErr } = await client.from('creator_channel_members').insert({
            channel_id: resolvedChannelId,
            user_id: userId,
            member_role: 'owner',
            is_active: true,
            joined_at: nowIso,
            created_at: nowIso,
          });
          if (ccmErr) throw ccmErr;
        }

        await ensureBaseUserRoleAssignment(client, userId);

        if (destination) {
          maskedDest = destination.length >= 6 ? `${destination.slice(0, 3)}****${destination.slice(-3)}` : destination;
          const { error: pmErr } = await client.from('creator_payout_methods').insert({
            creator_channel_id: resolvedChannelId,
            owner_user_id: userId,
            method_type: providerName === 'Stripe' ? 'bank_transfer' : 'mobile_money',
            provider_name: providerName,
            provider_account_reference: crypto.createHash('sha256').update(destination).digest('hex').slice(0, 32),
            provider_method_reference: `pm_${crypto.randomBytes(6).toString('hex')}`,
            country_code: resolvedCountry,
            currency_code: countryInfo.currency,
            account_holder_name: artistName,
            masked_account_reference: maskedDest,
            mobile_money_network: providerName === 'Stripe' ? null : providerName,
            method_status: 'active',
            verification_status: 'pending',
            is_default: true,
            metadata: { phone: destination },
            created_at: nowIso,
            updated_at: nowIso,
          });
          if (pmErr) throw pmErr;
        }
      } catch (modeAErr: any) {
        await Promise.allSettled([
          client.from('creator_payout_methods').delete().eq('creator_channel_id', resolvedChannelId).eq('owner_user_id', userId),
          createdChannelThisRequest ? client.from('creator_channel_members').delete().eq('channel_id', resolvedChannelId) : Promise.resolve(),
          createdChannelThisRequest ? client.from('creator_channels').delete().eq('id', resolvedChannelId) : Promise.resolve(),
          client.from('artist_members').delete().eq('artist_id', artistProfileId),
          client.from('artist_profiles').delete().eq('id', artistProfileId),
        ]);
        if (modeAErr?.code === '23505') {
          return res.status(409).json({
            success: false,
            error: 'duplicate_artist',
            message: 'Artist handle or artist profile already exists.',
          });
        }
        throw modeAErr;
      }

      const token = generateArtistToken({
        id: artistProfileId,
        user_id: userId,
        channel_id: resolvedChannelId,
        email: authUserCtx.email || '',
        artist_name: artistName,
        country_code: targetCountry,
        currency_code: countryInfo.currency,
      });

      const formattedArtist = formatArtistPayload({
        artistProfile: insertedArtist,
        channel: resolvedChannel,
        userId,
        email: authUserCtx.email || '',
        phone: phoneCheck.formattedPhone,
        countryCode: targetCountry,
        currencyCode: countryInfo.currency,
        momoCode: maskedDest,
        momoProvider: destination ? providerName : null,
      });

      return res.status(201).json({
        success: true,
        message: 'Artist account and studio profile created successfully.',
        artist: formattedArtist,
        artistId: artistProfileId,
        channelId: resolvedChannelId,
        userId,
        approval_status: approvalStatus,
        is_approved: autoApprove,
        country_code: targetCountry,
        currency_code: countryInfo.currency,
        redirectTo: '/artist/dashboard',
        token,
      });
    }

    // Mode B: New Artist Account Registration (email + password + fullName/artist_name)
    const errors: Record<string, string> = {};

    if (!rawEmail || !EMAIL_REGEX.test(String(rawEmail).trim())) {
      errors.email = 'A valid email address is required.';
    }
    if (!rawPassword || typeof rawPassword !== 'string' || rawPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    if (!rawFullName || typeof rawFullName !== 'string' || rawFullName.trim().length < 2) {
      errors.fullName = 'Stage or Full Name is required (minimum 2 characters).';
    }

    const requestedType = rawArtistType ? String(rawArtistType).trim().toLowerCase() : 'solo';
    if (!VALID_ARTIST_TYPES.has(requestedType)) {
      errors.artist_type = 'Invalid artist type. Must be one of: solo, group, band, orchestra, other.';
    }

    const targetCountry = String(rawCountryCode || geo.country_code || 'RW').toUpperCase().slice(0, 2);
    const phoneCheck = parseAndFormatOptionalPhone(rawPhone, targetCountry);
    if (phoneCheck.error) {
      errors.phone = phoneCheck.error;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: Object.values(errors)[0],
        errors,
      });
    }

    const formattedPhone = phoneCheck.formattedPhone;
    const resolvedCountry = phoneCheck.resolvedCountry;
    const cleanEmail = String(rawEmail).trim().toLowerCase();
    const cleanFullName = String(rawFullName).trim().slice(0, 160);
    const handle = rawHandle
      ? normalizeArtistHandle(rawHandle)
      : slugifyHandle(cleanFullName || cleanEmail.split('@')[0]);

    if (handle.length < 3 || handle.length > 60 || !/^[a-z0-9_]+$/.test(handle)) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Artist handle must contain 3–60 lowercase letters, numbers, or underscores.',
      });
    }

    if (rawHandle) {
      const { data: handleConflict } = await client
        .from('artist_profiles')
        .select('id')
        .ilike('artist_handle', handle)
        .maybeSingle();
      if (handleConflict) {
        return res.status(409).json({
          success: false,
          error: 'handle_taken',
          message: 'This artist handle is already taken.',
        });
      }
    }

    const countryInfo = COUNTRY_MAP[resolvedCountry] || {
      currency: geo.currency_code || 'RWF',
      provider: 'MTN',
    };

    const { data: createdAuth, error: createErr } = await client.auth.admin.createUser({
      email: cleanEmail,
      password: String(rawPassword),
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        role: 'artist',
        ...(formattedPhone ? { phone: formattedPhone } : {}),
        country_code: resolvedCountry,
        currency_code: countryInfo.currency,
      },
    });

    if (createErr || !createdAuth?.user) {
      const msg = createErr?.message || 'Unable to register artist account.';
      const isDuplicate = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists');
      return res.status(isDuplicate ? 409 : 400).json({
        success: false,
        error: isDuplicate ? 'account_exists' : 'registration_failed',
        message: isDuplicate
          ? 'An account with this email already exists. Please sign in instead.'
          : msg,
      });
    }

    const userId = createdAuth.user.id;
    const artistProfileId = crypto.randomUUID();
    const channelId = crypto.randomUUID();

    try {
      const { error: profErr } = await client.from('profiles').upsert(
        {
          user_id: userId,
          username: makeProfileUsername(handle, userId),
          display_name: cleanFullName.slice(0, 100),
          bio: rawBio ? String(rawBio).trim().slice(0, 500) : null,
          country_code: resolvedCountry,
          preferred_language_code: 'en',
          account_status: 'active',
          is_verified: false,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );
      if (profErr) throw profErr;

      const { data: insertedArtist, error: apErr } = await client
        .from('artist_profiles')
        .insert({
          id: artistProfileId,
          artist_name: cleanFullName,
          artist_handle: handle,
          artist_type: requestedType,
          bio_en: rawBio ? String(rawBio).trim() : null,
          country_code: resolvedCountry,
          primary_language_code: 'en',
          created_by_user_id: userId,
          primary_contact_user_id: userId,
          record_status: 'active',
          verification_status: 'not_submitted',
          approval_status: approvalStatus,
          is_public: true,
          approved_at: autoApprove ? nowIso : null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (apErr) throw apErr;

      const { error: amErr } = await client.from('artist_members').insert({
        artist_id: artistProfileId,
        user_id: userId,
        member_role: 'owner',
        is_active: true,
        joined_at: nowIso,
        created_at: nowIso,
      });
      if (amErr) throw amErr;

      const { data: insertedChannel, error: chErr } = await client
        .from('creator_channels')
        .insert({
          id: channelId,
          channel_name: cleanFullName,
          channel_handle: handle,
          channel_type: requestedType === 'solo' ? 'individual' : 'brand',
          description_en: rawBio ? String(rawBio).trim() : null,
          country_code: resolvedCountry,
          primary_language_code: 'en',
          owner_user_id: userId,
          created_by_user_id: userId,
          record_status: 'active',
          verification_status: 'not_submitted',
          approval_status: approvalStatus,
          is_public: true,
          approved_at: autoApprove ? nowIso : null,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();
      if (chErr) throw chErr;

      const { error: ccmErr } = await client.from('creator_channel_members').insert({
        channel_id: channelId,
        user_id: userId,
        member_role: 'owner',
        is_active: true,
        joined_at: nowIso,
        created_at: nowIso,
      });
      if (ccmErr) throw ccmErr;

      await ensureBaseUserRoleAssignment(client, userId);

      const destination = rawMomoCode ? String(rawMomoCode).trim() : formattedPhone;
      const providerName = rawMomoProvider || countryInfo.provider;
      let maskedDest: string | null = null;
      if (destination) {
        maskedDest = destination.length >= 6 ? `${destination.slice(0, 3)}****${destination.slice(-3)}` : destination;
        const { error: pmErr } = await client.from('creator_payout_methods').insert({
          creator_channel_id: channelId,
          owner_user_id: userId,
          method_type: providerName === 'Stripe' ? 'bank_transfer' : 'mobile_money',
          provider_name: providerName,
          provider_account_reference: crypto.createHash('sha256').update(destination).digest('hex').slice(0, 32),
          provider_method_reference: `pm_${crypto.randomBytes(6).toString('hex')}`,
          country_code: resolvedCountry,
          currency_code: countryInfo.currency,
          account_holder_name: cleanFullName,
          masked_account_reference: maskedDest,
          mobile_money_network: providerName === 'Stripe' ? null : providerName,
          method_status: 'active',
          verification_status: 'pending',
          is_default: true,
          metadata: { phone: destination },
          created_at: nowIso,
          updated_at: nowIso,
        });
        if (pmErr) throw pmErr;
      }

      const token = generateArtistToken({
        id: artistProfileId,
        user_id: userId,
        channel_id: channelId,
        email: cleanEmail,
        artist_name: cleanFullName,
        country_code: resolvedCountry,
        currency_code: countryInfo.currency,
      });

      const formattedArtist = formatArtistPayload({
        artistProfile: insertedArtist,
        channel: insertedChannel,
        userId,
        email: cleanEmail,
        phone: formattedPhone,
        countryCode: resolvedCountry,
        currencyCode: countryInfo.currency,
        momoCode: maskedDest,
        momoProvider: destination ? providerName : null,
      });

      return res.status(201).json({
        success: true,
        message: 'Artist account created and Creator Studio provisioned.',
        token,
        artist: formattedArtist,
        artistId: artistProfileId,
        channelId,
        userId,
        phone: formattedPhone || null,
        is_approved: autoApprove,
        approval_status: approvalStatus,
        country_code: resolvedCountry,
        currency_code: countryInfo.currency,
        country_name: geo.country_name,
        redirectTo: '/artist/dashboard',
        user: {
          id: userId,
          email: cleanEmail,
          fullName: cleanFullName,
          role: 'artist',
        },
      });
    } catch (provisionErr: any) {
      // Atomic rollback so no orphan auth user or partial artist records persist
      await Promise.allSettled([
        client.from('creator_payout_methods').delete().eq('owner_user_id', userId),
        client.from('creator_channel_members').delete().eq('user_id', userId),
        client.from('creator_channels').delete().eq('owner_user_id', userId),
        client.from('artist_members').delete().eq('user_id', userId),
        client.from('artist_profiles').delete().eq('created_by_user_id', userId),
        client.from('user_role_assignments').delete().eq('user_id', userId),
        client.from('profiles').delete().eq('user_id', userId),
      ]);
      await client.auth.admin.deleteUser(userId).catch(() => {});

      if (provisionErr?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'duplicate_artist',
          message: 'Artist handle or artist profile already exists.',
        });
      }
      throw provisionErr;
    }
  } catch (err: any) {
    console.error('[ARTIST-REGISTER] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: err?.message || 'Failed to complete artist registration.',
    });
  }
};

/**
 * POST /api/artist/login & POST /api/auth/artist/login
 */
export const loginArtist = async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'service_unavailable',
      message: 'Supabase authentication is not configured.',
    });
  }

  try {
    const { email, password, google_token, provider } = req.body || {};

    if (google_token || provider === 'google') {
      return res.status(403).json({
        success: false,
        error: 'google_auth_forbidden_for_artists',
        message: 'Google Sign-In is only available for listeners. Artists must sign in with email and password.',
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Email and password are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: String(password),
    });

    if (signInErr || !signInData?.user) {
      const msg = signInErr?.message || 'Invalid email or password.';
      const isUnconfirmed = msg.toLowerCase().includes('email not confirmed');
      return res.status(401).json({
        success: false,
        error: isUnconfirmed ? 'email_not_confirmed' : 'invalid_credentials',
        message: isUnconfirmed
          ? 'Your email address has not been confirmed. Check your inbox before signing in.'
          : 'Invalid email or password. Please try again.',
      });
    }

    const authUser = signInData.user;
    const client = db();
    const { artistProfile, channel, profile } = await resolveArtistContextByUser(authUser.id);

    if (!artistProfile && !channel) {
      return res.status(404).json({
        success: false,
        error: 'artist_profile_not_found',
        message: 'No artist profile or creator channel is linked to this account. Register as an artist first.',
      });
    }

    if (
      artistProfile?.record_status === 'suspended' ||
      channel?.record_status === 'suspended' ||
      profile?.account_status === 'suspended'
    ) {
      return res.status(403).json({
        success: false,
        error: 'account_blocked',
        message: 'Your artist account has been suspended. Please contact PAYTUNE support.',
      });
    }

    const geo = await detectCountryFromRequest(req);
    const meta = authUser.user_metadata || {};
    const countryCode = artistProfile?.country_code || channel?.country_code || geo.country_code || 'RW';
    const currencyCode = meta.currency_code || geo.currency_code || 'RWF';
    const artistId = artistProfile?.id || channel?.id;
    const channelId = channel?.id || null;
    const artistName =
      artistProfile?.artist_name ||
      channel?.channel_name ||
      profile?.display_name ||
      cleanEmail.split('@')[0];
    const phone = meta.phone || authUser.phone || '';

    const { data: payoutMethod } = await client
      .from('creator_payout_methods')
      .select('provider_name, masked_account_reference, is_default')
      .eq('owner_user_id', authUser.id)
      .eq('is_default', true)
      .maybeSingle();

    const token = generateArtistToken({
      id: artistId,
      user_id: authUser.id,
      channel_id: channelId,
      email: cleanEmail,
      artist_name: artistName,
      country_code: countryCode,
      currency_code: currencyCode,
    });

    const formattedArtist = formatArtistPayload({
      artistProfile,
      channel,
      profile,
      userId: authUser.id,
      email: cleanEmail,
      phone,
      countryCode,
      currencyCode,
      momoCode: payoutMethod?.masked_account_reference || phone,
      momoProvider: payoutMethod?.provider_name || null,
    });

    return res.json({
      success: true,
      token,
      userId: authUser.id,
      role: 'artist',
      artistId,
      channelId,
      is_approved: formattedArtist.is_approved,
      approval_status: formattedArtist.approval_status,
      country_code: countryCode,
      currency_code: currencyCode,
      redirectTo: '/artist/dashboard',
      message: 'Login successful.',
      artist: formattedArtist,
      user: {
        id: authUser.id,
        email: cleanEmail,
        fullName: artistName,
        role: 'artist',
      },
    });
  } catch (err: any) {
    console.error('[ARTIST-LOGIN] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: err?.message || 'An unexpected error occurred during artist login.',
    });
  }
};

/**
 * GET /api/artist/geo/detect
 */
export const detectArtistCountry = async (req: Request, res: Response) => {
  try {
    const geo = await detectCountryFromRequest(req);
    return res.json({ success: true, ...geo });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'geo_detection_failed',
      message: err?.message || 'Country detection failed',
    });
  }
};

/**
 * GET /api/auth/artist/me
 */
export const getArtistMe = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const client = db();
    const { artistProfile, channel, profile } = await resolveArtistContextByUser(user.id);
    if (!artistProfile && !channel) {
      return res.status(404).json({ success: false, error: 'artist_profile_not_found' });
    }

    const { data: userRes } = await client.auth.admin.getUserById(user.id);
    const meta = userRes?.user?.user_metadata || {};
    const { data: payoutMethod } = await client
      .from('creator_payout_methods')
      .select('provider_name, masked_account_reference, is_default')
      .eq('owner_user_id', user.id)
      .eq('is_default', true)
      .maybeSingle();

    const phone = meta.phone || userRes?.user?.phone || '';
    const formattedArtist = formatArtistPayload({
      artistProfile,
      channel,
      profile,
      userId: user.id,
      email: userRes?.user?.email || user.email || '',
      phone,
      countryCode: artistProfile?.country_code || channel?.country_code || 'RW',
      currencyCode: meta.currency_code || 'RWF',
      momoCode: payoutMethod?.masked_account_reference || phone,
      momoProvider: payoutMethod?.provider_name || null,
    });

    return res.json({
      success: true,
      artist: formattedArtist,
    });
  } catch (err: any) {
    console.error('[ARTIST-ME] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: err?.message || 'Failed to load artist profile.',
    });
  }
};

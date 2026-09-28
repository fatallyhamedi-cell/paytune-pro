import { mysqlTable, serial, varchar, text, decimal, boolean, timestamp, int, json } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').default(false),
  googleId: varchar('google_id', { length: 255 }),
  isActive: boolean('is_active').default(true),
  isBlocked: boolean('is_blocked').default(false),
  referralCode: varchar('referral_code', { length: 50 }),
  totalSpent: decimal('total_spent', { precision: 15, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login'),
});

export const userPaymentPhones = mysqlTable('user_payment_phones', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  phone: varchar('phone', { length: 20 }).notNull(),
  isDefault: boolean('is_default').default(false),
});

export const artists = mysqlTable('artists', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  phoneVerified: boolean('phone_verified').default(false),
  phoneVerificationCode: varchar('phone_verification_code', { length: 6 }),
  phoneVerificationExpires: timestamp('phone_verification_expires'),
  countryCode: varchar('country_code', { length: 2 }),
  currencyCode: varchar('currency_code', { length: 3 }).default('RWF'),
  lastOtpSentAt: timestamp('last_otp_sent_at'),
  momoCode: varchar('momo_code', { length: 50 }),
  momoProvider: varchar('momo_provider', { length: 50 }), // MTN or Airtel
  fullName: varchar('full_name', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  profileImage: text('profile_image'),
  bio: text('bio'),
  isApproved: boolean('is_approved').default(false),
  isBlocked: boolean('is_blocked').default(false),
  totalEarnings: decimal('total_earnings', { precision: 15, scale: 2 }).default('0.00'),
  pendingBalance: decimal('pending_balance', { precision: 15, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login'),
});

export const videos = mysqlTable('videos', {
  id: serial('id').primaryKey(),
  artistId: int('artist_id').references(() => artists.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priceRwf: int('price_rwf').default(0),
  priceUsd: decimal('price_usd', { precision: 10, scale: 2 }).default('0.00'),
  isFree: boolean('is_free').default(false),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  previewUrl: text('preview_url'),
  duration: int('duration'), // seconds
  category: varchar('category', { length: 100 }),
  visibility: varchar('visibility', { length: 20 }).default('public'), // public, unlisted, private
  uniqueLink: varchar('unique_link', { length: 64 }).unique(),
  views: int('views').default(0),
  likes: int('likes').default(0),
  ratingAvg: decimal('rating_avg', { precision: 3, scale: 2 }).default('0.00'),
  ratingCount: int('rating_count').default(0),
  isActive: boolean('is_active').default(true),
  isApproved: boolean('is_approved').default(true),
  scheduledRelease: timestamp('scheduled_release'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

export const purchases = mysqlTable('purchases', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  videoId: int('video_id').references(() => videos.id),
  paymentPhone: varchar('payment_phone', { length: 20 }),
  amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }),
  vatAmount: decimal('vat_amount', { precision: 15, scale: 2 }),
  afterVat: decimal('after_vat', { precision: 15, scale: 2 }),
  artistShare: decimal('artist_share', { precision: 15, scale: 2 }),
  ownerShare: decimal('owner_share', { precision: 15, scale: 2 }),
  transactionId: varchar('transaction_id', { length: 255 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  receiptNumber: varchar('receipt_number', { length: 100 }),
  purchasedAt: timestamp('purchased_at').defaultNow(),
});

export const userLikes = mysqlTable('user_likes', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  videoId: int('video_id').references(() => videos.id),
});

export const subscriptions = mysqlTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  artistId: int('artist_id').references(() => artists.id),
});

export const userComments = mysqlTable('user_comments', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  videoId: int('video_id').references(() => videos.id),
  parentCommentId: int('parent_comment_id'),
  commentText: text('comment_text').notNull(),
  likes: int('likes').default(0),
  isHidden: boolean('is_hidden').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const withdrawals = mysqlTable('withdrawals', {
  id: serial('id').primaryKey(),
  artistId: int('artist_id').references(() => artists.id),
  amount: decimal('amount', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 20 }).default('pending'), // pending, processed, rejected
  transactionId: varchar('transaction_id', { length: 255 }),
  requestedAt: timestamp('requested_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

export const notifications = mysqlTable('notifications', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  artistId: int('artist_id').references(() => artists.id),
  recipientType: varchar('recipient_type', { length: 20 }).notNull(), // user, artist, master
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  link: varchar('link', { length: 255 }).notNull(),
  isRead: boolean('is_read').default(false),
  relatedId: varchar('related_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notificationPreferences = mysqlTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  artistId: int('artist_id').references(() => artists.id),
  emailNewVideo: boolean('email_new_video').default(true),
  emailNewFollower: boolean('email_new_follower').default(true),
  emailNewPurchase: boolean('email_new_purchase').default(true),
  emailNewComment: boolean('email_new_comment').default(true),
  emailSuperThanks: boolean('email_super_thanks').default(true),
  emailMembership: boolean('email_membership').default(true),
  emailWithdrawal: boolean('email_withdrawal').default(true),
  emailMarketing: boolean('email_marketing').default(false),
  pushEnabled: boolean('push_enabled').default(true),
});


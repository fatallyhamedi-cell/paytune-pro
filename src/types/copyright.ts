export type CopyrightClaimStatus = 'pending' | 'active' | 'disputed' | 'released' | 'rejected';
export type CopyrightPolicy = 'monetize' | 'block';
export type ClaimantType = 'artist' | 'external';
export type DMCARequestStatus = 'pending' | 'approved' | 'rejected' | 'counter_notice';
export type DisputeReason = 
  | 'I own the copyright' 
  | 'I have a license' 
  | 'Fair use' 
  | 'Public domain';
export type DisputeStatus = 
  | 'pending' 
  | 'claimant_response' 
  | 'resolved_uploader' 
  | 'resolved_claimant' 
  | 'expired';

export interface CopyrightClaim {
  id: string;
  video_id: string;
  video_title?: string;
  video_thumbnail?: string;
  uploader_id: string;
  uploader_name?: string;
  claimant_id: string;
  claimant_type: ClaimantType;
  claimant_name: string;
  external_claimant_name?: string;
  external_claimant_email?: string;
  external_claimant_phone?: string;
  match_confidence: number; // e.g., 98.5
  detected_track_title: string;
  detected_artist_name: string;
  detected_label?: string;
  detected_isrc?: string;
  match_start_seconds?: number;
  match_end_seconds?: number;
  original_work_url?: string;
  status: CopyrightClaimStatus;
  policy: CopyrightPolicy; // 'monetize' (70% goes to claimant) or 'block' (video hidden)
  revenue_split_artist: number; // 0% if claimed
  revenue_split_claimant: number; // 70%
  revenue_split_platform: number; // 30%
  dispute_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DMCARequest {
  id: string;
  video_id: string;
  video_title?: string;
  video_url?: string;
  uploader_id?: string;
  uploader_name?: string;
  claimant_name: string;
  claimant_email: string;
  claimant_phone?: string;
  claimant_company?: string;
  original_work_url: string;
  infringement_description: string;
  digital_signature: string;
  sworn_statement_agreed: boolean;
  status: DMCARequestStatus;
  counter_notice_reason?: string;
  counter_notice_uploader_id?: string;
  counter_notice_at?: string;
  counter_notice_signature?: string;
  created_at: string;
  resolved_at?: string;
  approved_by?: string;
}

export interface CopyrightDispute {
  id: string;
  claim_id: string;
  video_id: string;
  video_title?: string;
  uploader_id: string;
  uploader_name?: string;
  claimant_name: string;
  reason: DisputeReason;
  evidence: string;
  status: DisputeStatus;
  created_at: string;
  expires_at: string; // 7 days from created_at
  claimant_response_at?: string;
  resolved_at?: string;
  resolution_note?: string;
}

export interface VideoWatermark {
  id: string;
  video_id: string;
  video_title?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  watermark_token: string;
  watermark_data: {
    userId: string;
    videoId: string;
    timestamp: string;
    userIp?: string;
    device?: string;
    forensicHash?: string;
  };
  embedded_at: string;
}

export interface CopyrightHolder {
  id: string;
  profile_id: string;
  organization_name: string;
  contact_email: string;
  contact_phone?: string;
  representative_name: string;
  catalog_size: number;
  verified: boolean;
  verification_documents?: any;
  created_at: string;
}

export interface CopyrightRevenue {
  id: string;
  claim_id: string;
  video_id: string;
  purchase_id: string;
  amount: number;
  claimant_share: number;
  platform_share: number;
  status: 'pending' | 'paid' | 'released_to_uploader';
  created_at: string;
  paid_at?: string;
}

export interface InfringementStrike {
  id: string;
  artist_id: string;
  artist_name?: string;
  artist_email?: string;
  strike_count: number;
  last_strike_at?: string;
  is_banned: boolean;
  reasons: Array<{
    date: string;
    video_id: string;
    video_title: string;
    reason: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ContentIdScanResult {
  hasMatch: boolean;
  confidence: number;
  detectedTrack?: string;
  detectedArtist?: string;
  detectedLabel?: string;
  detectedIsrc?: string;
  claimantName?: string;
  claimantId?: string;
  claimantType?: ClaimantType;
  suggestedPolicy?: CopyrightPolicy;
  matchDurationSec?: number;
}

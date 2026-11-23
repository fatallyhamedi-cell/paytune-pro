import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { notifyFollowingChanged } from '../lib/followingEvents';

export interface FollowButtonProps {
  artistId: string;
  initialFollowed?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  artistId,
  initialFollowed = false,
  onFollowChange,
  className = '',
  size = 'md'
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(initialFollowed);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsFollowing(initialFollowed);
  }, [initialFollowed]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    try {
      setLoading(true);
      const res = isFollowing
        ? await api.delete(`/api/artists/${artistId}/follow`)
        : await api.post(`/api/artists/${artistId}/follow`, { action: 'follow' });
      const nextState =
        typeof res.data?.following === 'boolean'
          ? res.data.following
          : typeof res.data?.followed === 'boolean'
          ? res.data.followed
          : !isFollowing;
      setIsFollowing(nextState);
      notifyFollowingChanged(user.id);
      if (onFollowChange) onFollowChange(nextState);
    } catch (err) {
      console.error('Follow toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-2.5 text-base gap-2'
  }[size];

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 cursor-pointer ${
        isFollowing
          ? 'bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-zinc-700'
          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-purple-600/20'
      } ${sizeClasses} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="w-4 h-4" />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          <span>Follow</span>
        </>
      )}
    </button>
  );
};

export default FollowButton;

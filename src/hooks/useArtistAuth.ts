import { useContext } from 'react';
import { ArtistAuthContext } from '../contexts/ArtistAuthContext';

export function useArtistAuth() {
  const ctx = useContext(ArtistAuthContext);
  if (!ctx) throw new Error('useArtistAuth must be used inside ArtistAuthProvider');
  return ctx;
}

export default useArtistAuth;

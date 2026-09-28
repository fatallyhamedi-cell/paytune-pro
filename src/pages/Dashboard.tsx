import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout, DashboardTab } from '../components/dashboard/DashboardLayout';
import { Library } from '../components/dashboard/Library';
import { History } from '../components/dashboard/History';
import { Playlists } from '../components/dashboard/Playlists';
import { Following } from '../components/dashboard/Following';
import { Wishlist } from '../components/dashboard/Wishlist';
import { PaymentPhones } from '../components/dashboard/PaymentPhones';
import { Settings } from '../components/dashboard/Settings';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read tab from query or default to 'library'
  const tabFromQuery = (searchParams.get('tab') as DashboardTab) || 'library';
  const validTabs: DashboardTab[] = [
    'library',
    'history',
    'playlists',
    'following',
    'wishlist',
    'phones',
    'settings'
  ];

  const initialTab = validTabs.includes(tabFromQuery) ? tabFromQuery : 'library';
  const [currentTab, setCurrentTab] = useState<DashboardTab>(initialTab);

  useEffect(() => {
    const qTab = searchParams.get('tab') as DashboardTab;
    if (qTab && validTabs.includes(qTab) && qTab !== currentTab) {
      setCurrentTab(qTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: DashboardTab) => {
    setCurrentTab(tab);
    setSearchParams({ tab });
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'library':
        return <Library />;
      case 'history':
        return <History />;
      case 'playlists':
        return <Playlists />;
      case 'following':
        return <Following />;
      case 'wishlist':
        return <Wishlist />;
      case 'phones':
        return <PaymentPhones />;
      case 'settings':
        return <Settings />;
      default:
        return <Library />;
    }
  };

  return (
    <DashboardLayout currentTab={currentTab} onTabChange={handleTabChange}>
      {renderContent()}
    </DashboardLayout>
  );
}

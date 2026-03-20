import { useQuery } from '@tanstack/react-query';
import { getServers } from '../api/servers';
import { getOverview } from '../api/analytics';

export interface SetupStatus {
  isLoading: boolean;
  hasServers: boolean;
  hasProfiles: boolean;
  hasVideos: boolean;
  isSetupComplete: boolean;
  currentStep: 0 | 1 | 2 | 3;
  serverCount: number;
  profileCount: number;
  videoCount: number;
}

export function useSetupStatus(): SetupStatus {
  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: getServers,
    staleTime: 30000,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: getOverview,
    staleTime: 30000,
  });

  const isLoading = serversLoading || overviewLoading;
  const serverCount = servers?.length ?? 0;
  const profileCount = overview?.total_profiles ?? 0;
  const videoCount = overview?.total_videos ?? 0;

  const hasServers = serverCount > 0;
  const hasProfiles = profileCount > 0;
  const hasVideos = videoCount > 0;
  const isSetupComplete = hasServers && hasProfiles && hasVideos;

  let currentStep: 0 | 1 | 2 | 3 = 0;
  if (hasServers && hasProfiles && hasVideos) currentStep = 3;
  else if (hasServers && hasProfiles) currentStep = 2;
  else if (hasServers) currentStep = 1;

  return {
    isLoading,
    hasServers,
    hasProfiles,
    hasVideos,
    isSetupComplete,
    currentStep,
    serverCount,
    profileCount,
    videoCount,
  };
}

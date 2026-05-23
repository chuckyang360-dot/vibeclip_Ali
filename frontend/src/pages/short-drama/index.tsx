import { LandingFooter } from '../../components/LandingFooter';
import { useAuth } from '../../contexts/AuthContext';
import { SDCapabilities } from './components/SDCapabilities';
import { SDCases } from './components/SDCases';
import { SDTargetAudience } from './components/SDTargetAudience';
import { SDWorkflow } from './components/SDWorkflow';
import { MobileLandingHome } from './components/MobileLandingHome';
import { PublicCinematicLanding } from './components/PublicCinematicLanding';
import { ShortDramaHero } from './components/ShortDramaHero';
import { ShortDramaLayout } from './components/ShortDramaLayout';

export default function ShortDramaLandingPage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <ShortDramaLayout headerMode="landing">
        <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#0B0B0D] text-white">
          <i className="ri-loader-4-line animate-spin text-2xl text-white/70" />
        </div>
      </ShortDramaLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <ShortDramaLayout headerMode="landing">
        <PublicCinematicLanding />
      </ShortDramaLayout>
    );
  }

  return (
    <ShortDramaLayout headerMode="landing">
      <MobileLandingHome />
      <div className="hidden md:block">
        <ShortDramaHero />
        <SDCapabilities />
        <SDWorkflow />
        <SDTargetAudience />
        <SDCases />

        <LandingFooter />
      </div>
    </ShortDramaLayout>
  );
}

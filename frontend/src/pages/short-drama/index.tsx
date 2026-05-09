import { LandingFooter } from '../../components/LandingFooter';
import { SDCapabilities } from './components/SDCapabilities';
import { SDCases } from './components/SDCases';
import { SDTargetAudience } from './components/SDTargetAudience';
import { SDWorkflow } from './components/SDWorkflow';
import { ShortDramaHero } from './components/ShortDramaHero';
import { ShortDramaLayout } from './components/ShortDramaLayout';

export default function ShortDramaLandingPage() {
  return (
    <ShortDramaLayout headerMode="landing">
      <ShortDramaHero />
      <SDCapabilities />
      <SDWorkflow />
      <SDTargetAudience />
      <SDCases />

      <LandingFooter />
    </ShortDramaLayout>
  );
}

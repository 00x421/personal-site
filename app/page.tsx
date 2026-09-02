import { About } from '@/components/site/about';
import { Cta } from '@/components/site/cta';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { Hero } from '@/components/site/hero';
import { Projects } from '@/components/site/projects';
import { Stack } from '@/components/site/stack';
import { Writing } from '@/components/site/writing';

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <Projects />
      <Writing />
      <About />
      <Stack />
      <Cta />
      <SiteFooter />
    </main>
  );
}

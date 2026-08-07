import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Footer } from '@/components/footer';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    // Match home content / footer (`max-w-6xl` = 72rem)
    <HomeLayout {...baseOptions()} className="[--fd-layout-width:72rem]">
      {children}
      <Footer />
    </HomeLayout>
  );
}

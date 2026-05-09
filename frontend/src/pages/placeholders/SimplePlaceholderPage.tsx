import { Link } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

type SimplePlaceholderPageProps = {
  title: string;
  description?: string;
};

export function SimplePlaceholderPage({ title, description = '内容建设中' }: SimplePlaceholderPageProps) {
  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#EAEAEA] bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-black text-[#1D1D1F]">{title}</h1>
          <p className="mt-4 text-[14px] text-[#6E6E73]">{description}</p>
          <Link
            to="/"
            className="mt-8 inline-flex rounded-xl bg-[#1D1D1F] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#374151]"
          >
            返回首页
          </Link>
        </div>
      </div>
    </ShortDramaLayout>
  );
}

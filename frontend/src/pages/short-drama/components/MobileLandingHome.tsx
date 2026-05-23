import { Link, useNavigate } from 'react-router-dom';
import { ri } from '../utils/shortDramaHelpers';

const QUICK_ACTIONS = [
  {
    title: '新建视频项目',
    desc: '拍照上传商品，先让 AI 理解卖点',
    icon: 'ri-add-circle-line',
    to: '/short-drama/create',
    primary: true,
  },
  {
    title: '继续已有项目',
    desc: '查看生成进度，处理失败或继续下一步',
    icon: 'ri-folder-3-line',
    to: '/short-drama/projects',
    primary: false,
  },
  {
    title: '查看行业样例',
    desc: '快速判断适不适合你的商品场景',
    icon: 'ri-play-circle-line',
    to: '/cases',
    primary: false,
  },
] as const;

const MOBILE_FLOW = [
  { label: '上传商品', icon: 'ri-image-add-line' },
  { label: '确认剧本', icon: 'ri-file-text-line' },
  { label: '生成资产', icon: 'ri-user-star-line' },
  { label: '预览成片', icon: 'ri-movie-2-line' },
] as const;

export function MobileLandingHome() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#F7F8FA] px-4 pb-8 pt-5 md:hidden">
      <section className="rounded-[28px] bg-[#111111] px-5 pb-5 pt-6 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/72">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          手机端创作入口
        </div>
        <h1 className="max-w-[13rem] text-[34px] font-black leading-[1.04] tracking-normal">
          从商品照片到短片初稿
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-white/64">
          在手机上完成创建、上传、生成和预览；需要精修分镜时，再回到电脑继续。
        </p>
        <button
          type="button"
          onClick={() => navigate('/short-drama/create')}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-bold text-[#111111]"
        >
          <i className={ri('ri-add-circle-line', 'text-[15px]')} aria-hidden />
          开始创建
        </button>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
          <p className="text-[22px] font-black text-[#1D1D1F]">5步</p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">从商品到成片</p>
        </div>
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
          <p className="text-[22px] font-black text-[#1D1D1F]">9:16</p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">优先适配短视频</p>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1D1D1F]">你现在可以做什么</h2>
          <Link to="/short-drama/projects" className="text-[12px] font-semibold text-[#6E6E73]">
            项目管理
          </Link>
        </div>
        <div className="space-y-3">
          {QUICK_ACTIONS.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="flex items-center gap-3 rounded-2xl border border-[#EAEAEA] bg-white p-4"
              style={{ textDecoration: 'none' }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: item.primary ? '#1D1D1F' : '#F5F5F7', color: item.primary ? '#ffffff' : '#444444' }}
              >
                <i className={ri(item.icon, 'text-[19px]')} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-[#1D1D1F]">{item.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-[#8E8E93]">{item.desc}</span>
              </span>
              <i className={ri('ri-arrow-right-s-line', 'text-[18px] text-[#C7C7CC]')} aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <h2 className="text-[15px] font-bold text-[#1D1D1F]">移动端工作流</h2>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {MOBILE_FLOW.map((step, index) => (
            <div key={step.label} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#444444]">
                <i className={ri(step.icon, 'text-[17px]')} aria-hidden />
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-snug text-[#6E6E73]">{step.label}</p>
              <p className="mt-0.5 text-[10px] text-[#C7C7CC]">0{index + 1}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

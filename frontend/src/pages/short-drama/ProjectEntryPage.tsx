import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getShortDramaProjectEntry } from '@/services/shortDramaApi';

export function ShortDramaProjectEntryPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  useEffect(() => {
    const idNum = Number(projectId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      navigate('/short-drama/projects', { replace: true });
      return;
    }
    void (async () => {
      try {
        const res = await getShortDramaProjectEntry(idNum);
        console.info('[FRONT_PROJECT_ENTRY_REDIRECT]', {
          project_id: idNum,
          redirect_to: res.redirect_to,
          reason: res.reason,
        });
        navigate(res.redirect_to, { replace: true });
      } catch {
        navigate(`/short-drama/projects/${idNum}/step-1`, { replace: true });
      }
    })();
  }, [navigate, projectId]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[13px] text-[#8E8E93]">
      正在进入项目...
    </div>
  );
}

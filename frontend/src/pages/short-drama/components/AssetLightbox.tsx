import { useEffect, useRef, useState } from 'react';
export type LightboxItem = {
  img: string;
  name?: string;
};

type Props = {
  item: LightboxItem | null;
  onClose: () => void;
};

/** Framer `AssetLightbox.tsx` 映射 */
export function AssetLightbox({ item, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [item]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (item) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [item]);

  if (!item) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex h-screen items-center justify-center p-4 md:p-8"
      style={{
        background: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(12px)' : 'blur(0px)',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative flex w-full items-center justify-center overflow-hidden"
        style={{
          maxWidth: '1200px',
          maxHeight: '90vh',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(16px)',
          transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200"
          style={{ background: 'rgba(0,0,0,0.06)', color: '#444444' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.14)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)';
          }}
        >
          <i className="ri-close-line text-[18px]" aria-hidden />
        </button>

        <div
          className="flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-[#EAEAEA] bg-[#F5F5F7]"
          style={{
            maxHeight: '90vh',
            minHeight: '220px',
          }}
        >
          <img
            src={item.img}
            alt={item.name ?? 'asset-preview'}
            className="h-auto w-auto"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  );
}

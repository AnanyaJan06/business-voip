import { createElement } from 'react';
import toast from 'react-hot-toast';

const toastOptions = {
  duration: 3000,
  style: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '12px',
    color: '#F9FAFB',
    fontSize: '14px'
  },
  success: {
    iconTheme: {
      primary: '#059669',
      secondary: '#FFFFFF'
    }
  },
  error: {
    iconTheme: {
      primary: '#DC2626',
      secondary: '#FFFFFF'
    }
  }
};

const showSuccessToast = (message) => toast.success(message, toastOptions);
const showErrorToast = (message) => toast.error(message, toastOptions);
const showIncomingSmsToast = ({ from, body, onClick }) => toast.custom((t) => createElement(
  'button',
  {
    type: 'button',
    onClick: () => {
      toast.dismiss(t.id);
      onClick?.();
    },
    className: `w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-emerald-500/25 bg-[#151B28] p-4 text-left text-white shadow-2xl transition hover:border-emerald-400 ${
      t.visible ? 'opacity-100' : 'opacity-0'
    }`
  },
  createElement('span', { className: 'mb-1 block text-sm font-semibold' }, 'New SMS'),
  createElement('span', { className: 'block truncate text-xs text-gray-400' }, from || 'Unknown number'),
  createElement(
    'span',
    { className: 'mt-2 block line-clamp-2 text-sm text-gray-300' },
    body || 'New message received'
  )
), {
  duration: 5000,
  position: 'top-right'
});
const showTeamMessageToast = ({ senderName, onClick }) => toast.custom((t) => createElement(
  'button',
  {
    type: 'button',
    onClick: () => {
      toast.dismiss(t.id);
      onClick?.();
    },
    className: `w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-sky-500/25 bg-[#151B28] p-4 text-left text-white shadow-2xl transition hover:border-sky-400 ${
      t.visible ? 'opacity-100' : 'opacity-0'
    }`
  },
  createElement('span', { className: 'mb-1 block text-sm font-semibold' }, 'New team message'),
  createElement('span', { className: 'block truncate text-xs text-gray-400' }, senderName || 'Team member')
), {
  duration: 5000,
  position: 'top-right'
});

export { showErrorToast, showIncomingSmsToast, showSuccessToast, showTeamMessageToast, toastOptions };

function InlineLoader({ label, size = 'sm' }) {
  const sizeClass = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-5 w-5'
  }[size];

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <svg
        className={`${sizeClass} animate-spin`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export default InlineLoader;

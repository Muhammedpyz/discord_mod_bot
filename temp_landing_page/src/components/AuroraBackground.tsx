export const AuroraBackground = () => {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-mesh opacity-70" />
      <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-secondary/20 blur-3xl" />
      <svg className="absolute bottom-0 left-0 w-full opacity-25 dark:opacity-15" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          fill="hsl(var(--primary))"
          fillOpacity="0.4"
          d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,165.3C672,171,768,213,864,213.3C960,213,1056,171,1152,154.7C1248,139,1344,149,1392,154.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        />
      </svg>
    </div>
  );
};

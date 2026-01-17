// ============================================================
// LOADING SKELETON COMPONENT
// ============================================================

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseClasses = "bg-slate-700";

  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "",
    rounded: "rounded-lg",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

// ============================================================
// LOADING SPINNER
// ============================================================

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
    xl: "w-16 h-16 border-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-slate-600 border-t-green-500 rounded-full animate-spin ${className}`}
    />
  );
}

// ============================================================
// FULL PAGE LOADER
// ============================================================

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Loading..." }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-slate-400">{message}</p>
    </div>
  );
}

// ============================================================
// GAME BOARD SKELETON
// ============================================================

export function GameBoardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width={200} height={32} />
        <div className="flex gap-2">
          <Skeleton variant="rounded" width={80} height={36} />
          <Skeleton variant="rounded" width={80} height={36} />
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-4">
        {/* Board area */}
        <div className="col-span-8">
          <Skeleton variant="rounded" className="aspect-square" />
        </div>

        {/* Sidebar */}
        <div className="col-span-4 space-y-4">
          {/* Players */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1">
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="40%" height={16} className="mt-1" />
                </div>
              </div>
            </div>
          ))}

          {/* Actions */}
          <Skeleton variant="rounded" height={120} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LEADERBOARD SKELETON
// ============================================================

export function LeaderboardSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Skeleton variant="text" width={150} height={28} />
        <Skeleton variant="rounded" width={100} height={32} />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg"
        >
          <Skeleton variant="circular" width={32} height={32} />
          <div className="flex-1">
            <Skeleton variant="text" width="50%" height={20} />
            <Skeleton variant="text" width="30%" height={16} className="mt-1" />
          </div>
          <Skeleton variant="text" width={60} height={24} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ANALYTICS CARD SKELETON
// ============================================================

export function AnalyticsCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <Skeleton variant="text" width={120} height={16} />
          <Skeleton variant="text" width={80} height={32} className="mt-2" />
        </div>
        <Skeleton variant="circular" width={40} height={40} />
      </div>
      <Skeleton variant="rounded" height={100} />
    </div>
  );
}

// ============================================================
// CHART SKELETON
// ============================================================

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="bg-slate-800 rounded-lg p-4 flex flex-col"
      style={{ height }}
    >
      <Skeleton variant="text" width={150} height={24} className="mb-4" />
      <div className="flex-1 flex items-end gap-2 px-4">
        {[0.6, 0.8, 0.4, 0.9, 0.5, 0.7, 0.3, 0.85].map((h, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            className="flex-1"
            height={`${h * 100}%`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4 px-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} variant="text" width={30} height={12} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TABLE SKELETON
// ============================================================

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-slate-800 rounded-t-lg">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={`${100 / columns}%`}
            height={20}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-3 border-b border-slate-700/50"
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              width={`${100 / columns}%`}
              height={16}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// EMPTY STATE COMPONENT
// ============================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="text-5xl mb-4">
        <span role="img" aria-label="Empty">{icon}</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && (
        <p className="text-slate-400 text-sm mb-4 max-w-md">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================
// INLINE LOADING
// ============================================================

interface InlineLoadingProps {
  message?: string;
  size?: "sm" | "md";
}

export function InlineLoading({
  message = "Loading...",
  size = "md",
}: InlineLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <Spinner size={size === "sm" ? "sm" : "md"} />
      <span className={size === "sm" ? "text-sm" : ""}>{message}</span>
    </div>
  );
}

// ============================================================
// BUTTON LOADING STATE
// ============================================================

interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
}

export function LoadingButton({
  loading = false,
  disabled = false,
  children,
  onClick,
  className = "",
  variant = "primary",
}: LoadingButtonProps) {
  const variantClasses = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

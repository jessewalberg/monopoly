import { useState, useEffect } from "react";

// ============================================================
// TYPES
// ============================================================

export interface DiceDisplayProps {
  dice?: [number, number];
  isRolling?: boolean;
  size?: "sm" | "md" | "lg";
}

// ============================================================
// SIZE STYLES
// ============================================================

const sizeStyles = {
  sm: {
    container: "w-8 h-8",
    dotSize: "w-1 h-1",
    gap: "gap-0.5",
  },
  md: {
    container: "w-12 h-12",
    dotSize: "w-1.5 h-1.5",
    gap: "gap-1",
  },
  lg: {
    container: "w-16 h-16",
    dotSize: "w-2 h-2",
    gap: "gap-1.5",
  },
};

// ============================================================
// DICE DOT PATTERNS
// Maps face value to dot positions
// Using a 3x3 grid: TL, TC, TR, ML, MC, MR, BL, BC, BR
// ============================================================

const dotPatterns: Record<number, number[]> = {
  1: [4], // center only (MC)
  2: [0, 8], // TL, BR
  3: [0, 4, 8], // TL, MC, BR
  4: [0, 2, 6, 8], // corners
  5: [0, 2, 4, 6, 8], // corners + center
  6: [0, 2, 3, 5, 6, 8], // left + right columns
};

// ============================================================
// SINGLE DIE COMPONENT
// ============================================================

function Die({
  value,
  size = "md",
  isRolling = false,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  isRolling?: boolean;
}) {
  const styles = sizeStyles[size];
  const dots = dotPatterns[value] || [];

  // Grid positions for 3x3 layout
  // 0=TL, 1=TC, 2=TR, 3=ML, 4=MC, 5=MR, 6=BL, 7=BC, 8=BR

  return (
    <div
      className={`
        ${styles.container}
        bg-white rounded-lg shadow-md
        grid grid-cols-3 grid-rows-3
        p-1.5
        ${isRolling ? "animate-bounce" : ""}
      `}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-center"
        >
          {dots.includes(index) && (
            <div
              className={`
                ${styles.dotSize}
                bg-slate-900 rounded-full
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// DICE DISPLAY COMPONENT
// ============================================================

export function DiceDisplay({
  dice,
  isRolling = false,
  size = "md",
}: DiceDisplayProps) {
  const [animatedDice, setAnimatedDice] = useState<[number, number]>([1, 1]);

  // Animate random values while rolling
  useEffect(() => {
    if (!isRolling) {
      if (dice) {
        setAnimatedDice(dice);
      }
      return;
    }

    const interval = setInterval(() => {
      setAnimatedDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    return () => clearInterval(interval);
  }, [isRolling, dice]);

  const displayDice = dice || animatedDice;
  const total = displayDice[0] + displayDice[1];
  const isDoubles = displayDice[0] === displayDice[1];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Die
          value={displayDice[0]}
          size={size}
          isRolling={isRolling}
        />
        <Die
          value={displayDice[1]}
          size={size}
          isRolling={isRolling}
        />
      </div>
      {!isRolling && dice && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            {total}
          </span>
          {isDoubles && (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
              DOUBLES!
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPACT DICE DISPLAY
// For showing in logs or small spaces
// ============================================================

export function DiceCompact({
  dice,
}: {
  dice: [number, number];
}) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-700 rounded text-sm font-mono">
      <span className="text-white">{dice[0]}</span>
      <span className="text-slate-400">+</span>
      <span className="text-white">{dice[1]}</span>
      <span className="text-slate-400">=</span>
      <span className="text-green-400 font-bold">{dice[0] + dice[1]}</span>
    </span>
  );
}

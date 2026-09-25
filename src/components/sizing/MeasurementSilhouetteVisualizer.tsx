import React from 'react';

interface MeasurementSilhouetteVisualizerProps {
  activePointKey: string | null;
  onSelectPoint: (key: string) => void;
  selectedCategory: string;
}

export const MeasurementSilhouetteVisualizer: React.FC<MeasurementSilhouetteVisualizerProps> = ({
  activePointKey,
  onSelectPoint,
  selectedCategory,
}) => {
  // SVG Body Outline & Measurement Markers coordinates
  // ViewBox: 0 0 400 620

  const markers: Array<{
    key: string;
    label: string;
    category: string;
    type: 'line' | 'horizontal' | 'vertical' | 'curve';
    // Line coords: x1, y1, x2, y2
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    markerX: number;
    markerY: number;
  }> = [
    // Head
    { key: 'HEAD_CIRCUMFERENCE', label: 'Head', category: 'ACCESSORIES', type: 'horizontal', x1: 175, y1: 45, x2: 225, y2: 45, markerX: 235, markerY: 45 },

    // Neck & Shoulders
    { key: 'NECK', label: 'Neck', category: 'UPPER_BODY', type: 'horizontal', x1: 185, y1: 85, x2: 215, y2: 85, markerX: 225, markerY: 85 },
    { key: 'SHOULDER_WIDTH', label: 'Shoulders', category: 'UPPER_BODY', type: 'horizontal', x1: 130, y1: 105, x2: 270, y2: 105, markerX: 280, markerY: 105 },
    { key: 'ACROSS_FRONT', label: 'Across Front', category: 'UPPER_BODY', type: 'horizontal', x1: 145, y1: 125, x2: 255, y2: 125, markerX: 265, markerY: 125 },

    // Chest & Bust
    { key: 'HIGH_BUST', label: 'High Bust', category: 'UPPER_BODY', type: 'horizontal', x1: 140, y1: 145, x2: 260, y2: 145, markerX: 270, markerY: 145 },
    { key: 'CHEST_BUST', label: 'Chest / Bust', category: 'UPPER_BODY', type: 'horizontal', x1: 135, y1: 168, x2: 265, y2: 168, markerX: 275, markerY: 168 },
    { key: 'BUST_POINT_TO_BUST_POINT', label: 'Apex Distance', category: 'UPPER_BODY', type: 'horizontal', x1: 175, y1: 168, x2: 225, y2: 168, markerX: 200, markerY: 160 },
    { key: 'UNDERBUST', label: 'Underbust', category: 'UPPER_BODY', type: 'horizontal', x1: 145, y1: 195, x2: 255, y2: 195, markerX: 265, markerY: 195 },

    // Waist & Abdomen
    { key: 'WAIST', label: 'Natural Waist', category: 'UPPER_BODY', type: 'horizontal', x1: 152, y1: 235, x2: 248, y2: 235, markerX: 258, markerY: 235 },
    { key: 'STOMACH', label: 'Stomach', category: 'UPPER_BODY', type: 'horizontal', x1: 148, y1: 265, x2: 252, y2: 265, markerX: 262, markerY: 265 },
    { key: 'UPPER_HIP', label: 'Upper Hip', category: 'UPPER_BODY', type: 'horizontal', x1: 145, y1: 290, x2: 255, y2: 290, markerX: 265, markerY: 290 },

    // Arms
    { key: 'ARMHOLE', label: 'Armhole', category: 'ARMS', type: 'curve', x1: 130, y1: 110, x2: 120, y2: 160, markerX: 105, markerY: 135 },
    { key: 'BICEP', label: 'Bicep', category: 'ARMS', type: 'horizontal', x1: 95, y1: 180, x2: 125, y2: 180, markerX: 85, markerY: 180 },
    { key: 'ELBOW', label: 'Elbow', category: 'ARMS', type: 'horizontal', x1: 85, y1: 230, x2: 115, y2: 230, markerX: 75, markerY: 230 },
    { key: 'WRIST', label: 'Wrist', category: 'ARMS', type: 'horizontal', x1: 75, y1: 295, x2: 98, y2: 295, markerX: 65, markerY: 295 },
    { key: 'SLEEVE_LENGTH_LONG', label: 'Sleeve Length', category: 'ARMS', type: 'vertical', x1: 125, y1: 110, x2: 85, y2: 295, markerX: 70, markerY: 200 },

    // Lower Body
    { key: 'HIP_SEAT', label: 'Hips / Seat', category: 'LOWER_BODY', type: 'horizontal', x1: 140, y1: 320, x2: 260, y2: 320, markerX: 270, markerY: 320 },
    { key: 'THIGH', label: 'Thigh', category: 'LOWER_BODY', type: 'horizontal', x1: 148, y1: 370, x2: 198, y2: 370, markerX: 208, markerY: 370 },
    { key: 'KNEE', label: 'Knee', category: 'LOWER_BODY', type: 'horizontal', x1: 155, y1: 440, x2: 192, y2: 440, markerX: 202, markerY: 440 },
    { key: 'CALF', label: 'Calf', category: 'LOWER_BODY', type: 'horizontal', x1: 158, y1: 505, x2: 194, y2: 505, markerX: 204, markerY: 505 },
    { key: 'ANKLE', label: 'Ankle', category: 'LOWER_BODY', type: 'horizontal', x1: 165, y1: 570, x2: 190, y2: 570, markerX: 200, markerY: 570 },
    { key: 'INSEAM', label: 'Inseam', category: 'LOWER_BODY', type: 'vertical', x1: 195, y1: 340, x2: 180, y2: 570, markerX: 188, markerY: 450 },
    { key: 'OUTSEAM', label: 'Outseam', category: 'LOWER_BODY', type: 'vertical', x1: 140, y1: 235, x2: 160, y2: 570, markerX: 130, markerY: 400 },

    // Lengths
    { key: 'TOP_LENGTH', label: 'Top Length', category: 'LENGTH', type: 'vertical', x1: 215, y1: 90, x2: 215, y2: 310, markerX: 225, markerY: 200 },
    { key: 'DRESS_LENGTH', label: 'Dress Length', category: 'LENGTH', type: 'vertical', x1: 215, y1: 90, x2: 215, y2: 450, markerX: 225, markerY: 270 },
    { key: 'SKIRT_LENGTH', label: 'Skirt Length', category: 'LENGTH', type: 'vertical', x1: 240, y1: 235, x2: 240, y2: 450, markerX: 250, markerY: 340 },
  ];

  const visibleMarkers = markers.filter(
    (m) => selectedCategory === 'ALL' || m.category === selectedCategory,
  );

  return (
    <div className="relative flex flex-col items-center justify-center rounded-3xl border border-black/10 bg-gradient-to-b from-slate-50 via-white to-purple-50/30 p-6 shadow-sm dark:border-white/10 dark:from-[#16121f] dark:via-[#110d18] dark:to-[#1a1228]">
      <div className="mb-3 flex items-center justify-between w-full px-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Interactive Body Anatomy Guide
          </span>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Tap any marker on the silhouette to inspect
        </span>
      </div>

      <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-[400/620]">
        <svg
          viewBox="0 0 400 620"
          className="h-full w-full select-none"
          aria-label="Human body measurement anatomical silhouette"
        >
          <defs>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.04" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Minimal Human Silhouette Vector Path (Clean Couture Mannequin) */}
          <g className="text-slate-900 dark:text-white transition-colors">
            {/* Head & Neck */}
            <path
              d="
                M 185 85
                C 175 75, 172 55, 175 35
                C 178 15, 222 15, 225 35
                C 228 55, 225 75, 215 85
                L 215 95
                L 185 95
                Z
              "
              fill="url(#bodyGrad)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-40"
            />

            {/* Torso & Shoulders */}
            <path
              d="
                M 185 95
                L 130 110
                C 120 120, 115 150, 125 180
                L 135 210
                C 142 225, 150 235, 152 245
                C 150 260, 142 280, 140 310
                C 138 335, 142 350, 148 360
                L 195 360
                L 195 340
                L 205 340
                L 205 360
                L 252 360
                C 258 350, 262 335, 260 310
                C 258 280, 250 260, 248 245
                C 250 235, 258 225, 265 210
                L 275 180
                C 285 150, 280 120, 270 110
                L 215 95
                Z
              "
              fill="url(#bodyGrad)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-40"
            />

            {/* Left Arm */}
            <path
              d="
                M 125 112
                C 110 125, 95 160, 92 195
                C 88 230, 85 260, 75 300
                C 72 315, 68 330, 72 340
                C 76 345, 82 342, 85 330
                C 92 295, 100 250, 108 210
                L 125 170
              "
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-35"
            />

            {/* Right Arm */}
            <path
              d="
                M 275 112
                C 290 125, 305 160, 308 195
                C 312 230, 315 260, 325 300
                C 328 315, 332 330, 328 340
                C 324 345, 318 342, 315 330
                C 308 295, 300 250, 292 210
                L 275 170
              "
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="opacity-35"
            />

            {/* Left Leg */}
            <path
              d="
                M 148 360
                C 145 400, 150 450, 155 480
                C 158 510, 155 540, 160 575
                C 162 585, 150 595, 160 600
                L 185 600
                C 188 590, 185 575, 185 570
                C 185 540, 192 510, 190 480
                C 188 450, 195 400, 195 360
              "
              fill="url(#bodyGrad)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-40"
            />

            {/* Right Leg */}
            <path
              d="
                M 252 360
                C 255 400, 250 450, 245 480
                C 242 510, 245 540, 240 575
                C 238 585, 250 595, 240 600
                L 215 600
                C 212 590, 215 575, 215 570
                C 215 540, 208 510, 210 480
                C 212 450, 205 400, 205 360
              "
              fill="url(#bodyGrad)"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className="opacity-40"
            />
          </g>

          {/* Dynamic Measurement Guideline Layers */}
          {visibleMarkers.map((marker) => {
            const isActive = activePointKey === marker.key;
            return (
              <g
                key={marker.key}
                className="cursor-pointer group"
                onClick={() => onSelectPoint(marker.key)}
              >
                {/* Measurement Guideline Line */}
                <line
                  x1={marker.x1}
                  y1={marker.y1}
                  x2={marker.x2}
                  y2={marker.y2}
                  stroke={isActive ? '#9333ea' : '#a855f7'}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeDasharray={isActive ? 'none' : '4 3'}
                  strokeOpacity={isActive ? 1 : 0.45}
                  filter={isActive ? 'url(#glow)' : undefined}
                  className="transition-all duration-200 group-hover:stroke-purple-600 group-hover:stroke-opacity-100 group-hover:stroke-[2.5]"
                />

                {/* Caliper Endcaps */}
                {marker.type === 'horizontal' && (
                  <>
                    <line
                      x1={marker.x1}
                      y1={marker.y1 - 4}
                      x2={marker.x1}
                      y2={marker.y1 + 4}
                      stroke={isActive ? '#9333ea' : '#a855f7'}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeOpacity={isActive ? 1 : 0.6}
                    />
                    <line
                      x1={marker.x2}
                      y1={marker.y2 - 4}
                      x2={marker.x2}
                      y2={marker.y2 + 4}
                      stroke={isActive ? '#9333ea' : '#a855f7'}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeOpacity={isActive ? 1 : 0.6}
                    />
                  </>
                )}

                {/* Interactive Marker Pin */}
                <circle
                  cx={marker.markerX}
                  cy={marker.markerY}
                  r={isActive ? 6 : 4}
                  fill={isActive ? '#9333ea' : '#a855f7'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-200 group-hover:scale-125 group-hover:fill-purple-600"
                />

                {/* Label Pill on Hover / Active */}
                {isActive ? (
                  <g>
                    <rect
                      x={marker.markerX > 200 ? marker.markerX + 8 : marker.markerX - 100}
                      y={marker.markerY - 11}
                      width={marker.label.length * 6.5 + 16}
                      height="20"
                      rx="10"
                      fill="#9333ea"
                      className="shadow-md"
                    />
                    <text
                      x={marker.markerX > 200 ? marker.markerX + 16 : marker.markerX - 92}
                      y={marker.markerY + 3}
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                    >
                      {marker.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-4 border-b border-dashed border-purple-500" />
          <span>Measuring Path</span>
        </span>
        <span className="inline-flex items-center gap-1 ml-3">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
          <span>Selected Landmark</span>
        </span>
      </div>
    </div>
  );
};

export default MeasurementSilhouetteVisualizer;

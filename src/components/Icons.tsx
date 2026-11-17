// Vector icons used in the design. They are redrawn as inline SVG so they stay sharp at any
// scale: material-symbols (timer-outline, settings, info, edit-outline), lets-icons
// (message-alt-fill), noto (up-arrow, used rotated as a "go" chip) and mingcute (check-fill).

type IconProps = { size?: number; color?: string; className?: string };

export function TimerIcon({ size = 16, color = '#fff' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M9 3V1h6v2H9Zm2 11h2V8h-2v6Zm1 8q-1.85 0-3.488-.712T5.65 19.35q-1.225-1.225-1.937-2.863T3 13q0-1.85.713-3.488T5.65 6.65q1.225-1.225 2.863-1.937T12 4q1.55 0 2.975.5t2.675 1.45l1.4-1.4 1.4 1.4-1.4 1.4Q20 8.6 20.5 10.025T21 13q0 1.85-.713 3.488T18.35 19.35q-1.225 1.225-2.863 1.938T12 22Zm0-2q2.9 0 4.95-2.05T19 13q0-2.9-2.05-4.95T12 6Q9.1 6 7.05 8.05T5 13q0 2.9 2.05 4.95T12 20Z"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 20, color = '#6b402b' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="m9.25 22-.4-3.2q-.325-.125-.612-.3t-.563-.375L4.7 19.375l-2.75-4.75 2.575-1.95Q4.5 12.5 4.5 12.338v-.675q0-.163.025-.338L1.95 9.375l2.75-4.75 2.975 1.25q.275-.2.575-.375t.6-.3l.4-3.2h5.5l.4 3.2q.325.125.613.3t.562.375l2.975-1.25 2.75 4.75-2.575 1.95q.025.175.025.338v.674q0 .163-.05.338l2.575 1.95-2.75 4.75-2.95-1.25q-.275.2-.575.375t-.6.3l-.4 3.2h-5.5Zm2.8-6.5q1.45 0 2.475-1.025T15.55 12q0-1.45-1.025-2.475T12.05 8.5q-1.475 0-2.488 1.025T8.55 12q0 1.45 1.012 2.475T12.05 15.5Z"
      />
    </svg>
  );
}

export function MailIcon({ size = 20, color = '#6b402b' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="m4.5 8 7.5 5 7.5-5" fill="none" stroke="#ffce7e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** noto:up-arrow, shown rotated to point right — the "go to task" chip. */
export function GoArrow({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="go-arrow">
      <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" fill="#f5a524" stroke="#c77a12" />
      <path d="M3.5 8h7.2M8 4.8 11.3 8 8 11.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoDot({ size = 10, color = '#6b402b' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={color} />
      <path d="M12 10.5v6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="7.3" r="1.5" fill="#fff" />
    </svg>
  );
}

export function EditIcon({ size = 20, color = '#6b402b' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M5 19h1.425L16.2 9.225 14.775 7.8 5 17.575V19Zm-2 2v-4.25L16.2 3.575q.3-.275.663-.425t.762-.15q.4 0 .775.15t.65.45L20.425 5q.3.275.437.65T21 6.4q0 .4-.138.763t-.437.662L7.25 21H3ZM15.475 8.525l-.7-.725L16.2 9.225l-.725-.7Z"
      />
    </svg>
  );
}

export function CheckBadge({ size = 12 }: IconProps) {
  return (
    <span className="side-check" style={{ width: size, height: size }} aria-label="Completed">
      <svg width={size * 0.5} height={size * 0.4} viewBox="0 0 12 10" aria-hidden="true">
        <path d="M1.5 5.2 4.6 8.2 10.5 1.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function StarIcon({ size = 10, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2.6 2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8L12 2.6Z"
        fill={filled ? '#ffc21a' : '#e4dcd2'}
        stroke={filled ? '#e69a00' : '#cfc6bb'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The Climate button: the earth with a leaf. */
export function ClimateIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} aria-hidden="true">
      <circle cx={12} cy={14} r={10} fill="#4fb3e8" stroke="#fff" strokeWidth={1.4} />
      <path d="M5 9.5c2.5.5 3.5 2 3 4s1 3 2.5 3.5-.5 3.5-1.5 4.5M14 4.5c-.5 2 1 3 3 3s3 1.5 2.5 3.5" fill="#6cc04a" stroke="#3f8f2c" strokeWidth={0.8} />
      <path d="M8 8.5c1.5 1 2 2.5 1.6 4.2-.4 1.8.8 2.6 2 3.1 1.3.6.8 2.6-.4 4.4L6.4 18C4.6 15 4.6 11.4 8 8.5ZM14.2 5c-.3 1.6.9 2.5 2.6 2.6 1.9.1 2.9 1.4 2.5 3.4l2.4.6c-.4-3.4-3.2-6.3-7.5-6.6Z" fill="#6cc04a" />
      <path d="M19 2.5c3.5-.5 5.5 1.5 5 5-3.5.5-5.5-1.5-5-5Z" fill="#9be05e" stroke="#2f7a24" strokeWidth={0.9} />
      <path d="M19.4 7.2l3-3" stroke="#2f7a24" strokeWidth={0.8} strokeLinecap="round" />
    </svg>
  );
}

/** Partnerships: two hands shaking. */
export function PartnersIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="-14 -14 28 28" width={size} height={size} aria-hidden="true">
      {/* the two sleeves */}
      <path d="M-13,-3 L-7,-7 L-4,-2 L-10,3 Z" fill="#2b7fb8" stroke="#fff" strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M13,-3 L7,-7 L4,-2 L10,3 Z" fill="#e0892b" stroke="#fff" strokeWidth={1.1} strokeLinejoin="round" />
      {/* the hands, clasped */}
      <path d="M-6,-4 C-3,-7 1,-7 4,-4 L8,0 C9,1 8,3 6.5,2.5 L5,4 C5.5,5.5 3.8,6.8 2.6,5.8 L1.6,6.8 C1.6,8.2 -0.4,8.8 -1.4,7.6 L-6.5,2.5 Z" fill="#c98a5a" stroke="#fff" strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M-1,-4.5 L3,-1 M1.4,1.2 L4.4,3.8 M-0.6,3.4 L2,5.8" stroke="#8a5530" strokeWidth={0.9} strokeLinecap="round" fill="none" />
    </svg>
  );
}

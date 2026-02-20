import React from "react";

type Props = React.SVGProps<SVGSVGElement>;

export function IconHome(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUser(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconPlus(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconBuilding(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 10h4a1 1 0 0 1 1 1v10"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 7h4M8 11h4M8 15h4M7 21v-4h6v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMic(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconFile(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLogout(props: Props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m16 12-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 4v16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.25"
      />
    </svg>
  );
}
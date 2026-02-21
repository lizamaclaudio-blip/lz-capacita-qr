// src/components/app/icons.tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21.5V14h5v7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 20.2c1.7-4 13.3-4 15 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.5 21V6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 8h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 12h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 21v-4h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconList(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 7h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 3.5h7l3.5 3.5V20A1.5 1.5 0 0 1 16 21.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V7h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 8l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
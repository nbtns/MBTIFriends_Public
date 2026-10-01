import type { Zodiac } from "../lib/tomotype-model";

const ZODIAC_SYMBOLS: Record<Zodiac, string> = {
  aries: "♈︎",
  taurus: "♉︎",
  gemini: "♊︎",
  cancer: "♋︎",
  leo: "♌︎",
  virgo: "♍︎",
  libra: "♎︎",
  scorpio: "♏︎",
  sagittarius: "♐︎",
  capricorn: "♑︎",
  aquarius: "♒︎",
  pisces: "♓︎",
};

export function ZodiacIcon({ zodiac, className = "" }: { zodiac: Zodiac; className?: string }) {
  return (
    <span className={`zodiac-icon ${className}`.trim()} aria-hidden="true">
      {ZODIAC_SYMBOLS[zodiac]}
    </span>
  );
}

export function BirthdayIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`app-line-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 11.5h14v7.25c0 .69-.56 1.25-1.25 1.25H6.25C5.56 20 5 19.44 5 18.75V11.5Z" />
      <path d="M5 15c1.3 0 1.55 1.15 2.8 1.15S9.3 15 10.55 15s1.5 1.15 2.75 1.15S14.8 15 16.05 15s1.5 1.15 2.95 1.15M8 11.5V9.25h8v2.25M12 9.25V6.7" />
      <path d="M12 3.5c1.15 1.2 1.25 2.15 0 3.2-1.25-1.05-1.15-2 0-3.2Z" />
    </svg>
  );
}

export function PeopleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`app-line-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.75 19c.35-3.15 2.1-5 5.25-5s4.9 1.85 5.25 5M15.5 6.25a2.75 2.75 0 0 1 0 5.5M16 14c2.45.1 3.9 1.75 4.25 4.25" />
    </svg>
  );
}

export function ProfileIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`app-line-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5.5 20c.35-4.1 2.55-6.25 6.5-6.25s6.15 2.15 6.5 6.25" />
    </svg>
  );
}

export function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`app-line-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.25 5.1 13.6C1.25 9.9 3.55 4.25 8 4.25c1.85 0 3.15 1 4 2.25.85-1.25 2.15-2.25 4-2.25 4.45 0 6.75 5.65 2.9 9.35L12 20.25Z" />
    </svg>
  );
}

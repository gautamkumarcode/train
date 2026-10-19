/**
 * Monochrome HUD icons.
 *
 * These replace the colourful emoji that used to label the sound chips. Every
 * icon is drawn with `currentColor` (stroke or fill) so it inherits the chip's
 * text colour and stays crisp and consistent across platforms — one of the
 * biggest contributors to the "professional" feel of the top HUD. Size them
 * with the "ico" class (14px) or a Tailwind sizing utility override.
 */

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PlayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" fill="currentColor" />
  </svg>
);

export const HeadphonesIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect {...stroke} x="3" y="13.5" width="4" height="7" rx="1.6" />
    <rect {...stroke} x="17" y="13.5" width="4" height="7" rx="1.6" />
  </svg>
);

export const CoffeeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M5 9.5h11V14a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14z" />
    <path {...stroke} d="M16 10.5h2.2a2.3 2.3 0 0 1 0 4.6H16" />
    <path {...stroke} d="M8 3c-.6 1 .6 1.6 0 3M11.5 3c-.6 1 .6 1.6 0 3" />
  </svg>
);

export const HornIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M4 10v4h3l7 3.5v-14L7 10z" />
    <path {...stroke} d="M17.5 8.5a5 5 0 0 1 0 7M20.5 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const WhistleIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <circle {...stroke} cx="9" cy="14" r="5.2" />
    <path {...stroke} d="M13 11.5 21 7" />
    <circle cx="9" cy="14" r="1.1" fill="currentColor" />
    <path {...stroke} d="M16.5 12.5a3 3 0 0 1 0 4" />
  </svg>
);

export const TrainIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <rect {...stroke} x="5" y="3.5" width="14" height="13" rx="3" />
    <path {...stroke} d="M5 10h14" />
    <circle cx="9" cy="13.5" r="1.1" fill="currentColor" />
    <circle cx="15" cy="13.5" r="1.1" fill="currentColor" />
    <path {...stroke} d="M8 16.5 6.5 20.5M16 16.5 17.5 20.5M8.5 20.5h7" />
  </svg>
);

export const MegaphoneIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M4 10.5v3a1 1 0 0 0 1 1h2.5l9 4.5v-14l-9 4.5H5a1 1 0 0 0-1 1z" />
    <path {...stroke} d="M8 14.5V18a1.6 1.6 0 0 0 3.2 0v-.8" />
    <path {...stroke} d="M19.5 9.5a4 4 0 0 1 0 5" />
  </svg>
);

export const ChainIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M9.5 14.5 14.5 9.5" />
    <path {...stroke} d="M11 6.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5L15.5 11" />
    <path {...stroke} d="M13 17.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5L8.5 13" />
  </svg>
);

export const MusicIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
    <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
  </svg>
);

export const VolumeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M4 10v4h3l5 4V6L7 10z" />
    <path {...stroke} d="M15.5 9a4 4 0 0 1 0 6" />
  </svg>
);

export const MuteIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M4 10v4h3l5 4V6L7 10z" />
    <path {...stroke} d="M16 10l4 4M20 10l-4 4" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path {...stroke} d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Pick the right glyph for an SFX tile id. */
export function SfxIcon({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "chai":
      return <CoffeeIcon className={className} />;
    case "horn":
      return <HornIcon className={className} />;
    case "whistle":
      return <WhistleIcon className={className} />;
    case "track":
      return <TrainIcon className={className} />;
    case "announcer":
      return <MegaphoneIcon className={className} />;
    case "chain":
      return <ChainIcon className={className} />;
    default:
      return <MusicIcon className={className} />;
  }
}

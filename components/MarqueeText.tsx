"use client";

interface MarqueeTextProps {
  text: string;
  className?: string;
  scrollAfter?: number;
}

export default function MarqueeText({
  text,
  className = "",
  scrollAfter = 32,
}: MarqueeTextProps) {
  const shouldScroll = text.length > scrollAfter;

  return (
    <div className={`marquee ${className}`.trim()} title={text}>
      <div
        className={`marquee-track ${
          shouldScroll ? "marquee-track-scrolling" : ""
        }`}
      >
        <span>{text}</span>
        {shouldScroll ? <span aria-hidden>{text}</span> : null}
      </div>
    </div>
  );
}

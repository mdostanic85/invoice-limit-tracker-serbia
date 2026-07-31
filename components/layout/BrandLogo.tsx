import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
}

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  const classes = [
    "brand-logo",
    compact ? "brand-logo--compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="img" aria-label="LimitRadar">
      <Image
        className="brand-logo__asset brand-logo__asset--on-light"
        src="/limitradar-logo-on-light.svg"
        width={1339}
        height={287}
        alt=""
        unoptimized
      />
      <Image
        className="brand-logo__asset brand-logo__asset--on-dark"
        src="/limitradar-logo-on-dark.svg"
        width={1340}
        height={289}
        alt=""
        unoptimized
      />
    </span>
  );
}

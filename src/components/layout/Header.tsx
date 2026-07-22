import type { Category } from "@spree/sdk";
import { User } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CartButton } from "@/components/layout/CartButton";
import { SearchToggle } from "@/components/layout/SearchToggle";
import { Button } from "@/components/ui/button";
import { isWholesaleEnabled } from "@/lib/spree";
import { getStoreName } from "@/lib/store";

const LazyMobileMenu = dynamic(
  () =>
    import("@/components/layout/MobileMenu").then((mod) => ({
      default: mod.MobileMenu,
    })),
  {
    loading: () => (
      <div className="inline-flex items-center justify-center h-10 w-10" />
    ),
  },
);

const LazyCountrySwitcher = dynamic(
  () =>
    import("@/components/layout/CountrySwitcher").then((mod) => ({
      default: mod.CountrySwitcher,
    })),
  {
    loading: () => (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

const storeName = getStoreName();

interface HeaderProps {
  rootCategories: Category[];
  basePath: string;
  locale: Locale;
}

export async function Header({
  rootCategories,
  basePath,
  locale,
}: HeaderProps) {
  const t = await getTranslations({ locale, namespace: "header" });
  const wholesaleEnabled = isWholesaleEnabled();

  return (
    <SearchToggle
      basePath={basePath}
      left={
        <LazyMobileMenu
          rootCategories={rootCategories}
          basePath={basePath}
          wholesaleEnabled={wholesaleEnabled}
        />
      }
      center={
        <Link href={basePath || "/"} className="flex items-center min-w-0">
          <Image
            src="/spree.png"
            alt={storeName}
            width={90}
            height={32}
            className="max-w-full object-contain"
            style={{ width: "auto", height: "auto" }}
            fetchPriority="high"
            loading="eager"
          />
        </Link>
      }
      rightStart={
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          {/* Trade portal entry point — understated, secondary to the catalog nav.
              Only shown when the wholesale addon is enabled. */}
          {wholesaleEnabled && (
            <Link
              href={`${basePath}/wholesale`}
              className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              {t("wholesale")}
            </Link>
          )}
          <LazyCountrySwitcher />
        </div>
      }
      rightEnd={
        <>
          {/* Account - desktop only */}
          <div className="hidden md:block">
            <Button variant="ghost" size="icon-lg" asChild>
              <Link href={`${basePath}/account`} aria-label={t("account")}>
                <User className="size-5" />
              </Link>
            </Button>
          </div>

          {/* Cart */}
          <CartButton />
        </>
      }
    />
  );
}

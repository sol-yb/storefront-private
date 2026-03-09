import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { PriceBucket } from "@/lib/utils/price-buckets";
import { findMatchingBucket } from "@/lib/utils/price-buckets";
import type { ActiveFilters } from "@/types/filters";

interface PriceDropdownContentProps {
  priceBuckets: PriceBucket[];
  activeFilters: ActiveFilters;
  onPriceChange: (min?: number, max?: number) => void;
}

export function PriceDropdownContent({
  priceBuckets,
  activeFilters,
  onPriceChange,
}: PriceDropdownContentProps) {
  const selectedBucket = findMatchingBucket(
    priceBuckets,
    activeFilters.priceMin,
    activeFilters.priceMax,
  );

  return (
    <>
      <DropdownMenuLabel>Price Range</DropdownMenuLabel>
      {priceBuckets.map((bucket) => {
        const isSelected = selectedBucket?.id === bucket.id;
        return (
          <DropdownMenuCheckboxItem
            key={bucket.id}
            checked={isSelected}
            onCheckedChange={() => {
              if (isSelected) {
                onPriceChange(undefined, undefined);
              } else {
                onPriceChange(bucket.min, bucket.max);
              }
            }}
            onSelect={(e) => e.preventDefault()}
          >
            {bucket.label}
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );
}

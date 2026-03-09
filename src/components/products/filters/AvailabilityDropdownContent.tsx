import type { AvailabilityFilter } from "@spree/sdk";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AVAILABILITY_LABELS } from "@/lib/utils/filters";
import { type AvailabilityStatus, isAvailabilityStatus } from "@/types/filters";

interface AvailabilityDropdownContentProps {
  filter: AvailabilityFilter;
  selected?: AvailabilityStatus;
  onChange: (value?: AvailabilityStatus) => void;
}

export function AvailabilityDropdownContent({
  filter,
  selected,
  onChange,
}: AvailabilityDropdownContentProps) {
  return (
    <>
      <DropdownMenuLabel>Availability</DropdownMenuLabel>
      {filter.options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={isSelected}
            onCheckedChange={() => {
              if (isSelected) {
                onChange(undefined);
              } else if (isAvailabilityStatus(option.id)) {
                onChange(option.id);
              }
            }}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="flex-1">
              {AVAILABILITY_LABELS[option.id] || option.id}
            </span>
            <span className="text-xs text-muted-foreground">
              ({option.count})
            </span>
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UTILITY_LIST } from "@/types/utility";
import { UtilityIcon } from "@/components/shared/utility-icon";
import type { UtilityType } from "@/types/utility";

interface UtilitySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function UtilitySelector({ value, onValueChange }: UtilitySelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Select utility" />
      </SelectTrigger>
      <SelectContent>
        {UTILITY_LIST.map((utility) => (
          <SelectItem key={utility.type} value={utility.type}>
            <UtilityIcon utility={utility.type as UtilityType} className="size-4" />
            <span>{utility.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

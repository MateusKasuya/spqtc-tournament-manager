"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
}

export function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedHour = value ? format(value, "HH") : "20";
  const selectedMinute = value ? format(value, "mm") : "00";

  function applyTime(base: Date, hour: string, minute: string): Date {
    const next = new Date(base);
    next.setHours(Number(hour), Number(minute), 0, 0);
    return next;
  }

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    onChange(applyTime(day, selectedHour, selectedMinute));
    setOpen(false);
  }

  function handleHourChange(hour: string) {
    const base = value ?? new Date();
    onChange(applyTime(base, hour, selectedMinute));
  }

  function handleMinuteChange(minute: string) {
    const base = value ?? new Date();
    onChange(applyTime(base, selectedHour, minute));
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "flex-1 justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value
            ? format(value, "d 'de' MMMM yyyy", { locale: ptBR })
            : "Selecionar data"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDaySelect}
            locale={ptBR}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>

      <Select value={selectedHour} onValueChange={(v) => handleHourChange(v ?? "")}>
        <SelectTrigger className="w-16">
          <SelectValue>{selectedHour}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="flex items-center text-muted-foreground font-medium">:</span>

      <Select value={selectedMinute} onValueChange={(v) => handleMinuteChange(v ?? "")}>
        <SelectTrigger className="w-16">
          <SelectValue>{selectedMinute}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

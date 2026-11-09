import { parseDecimal } from "@apex/core";
import { useState, type ComponentProps } from "react";
import { WheelInput } from "./motion";
import { useUnits } from "./prefs";

/**
 * A text box shown in the person's unit while the value underneath stays metric. Keeps what they
 * are typing ("22." on the way to "22.5") instead of snapping it back after each key. With no
 * conversion (kg, cm) it passes straight through.
 */
export function useConvertedText(value: string, onChange: (v: string) => void, toStored: (n: number) => number, fromStored: (n: number) => number, identity: boolean): [string, (s: string) => void] {
  const show = (v: string) => (v.trim() === "" || !Number.isFinite(parseDecimal(v)) ? v : String(fromStored(parseDecimal(v))));
  const [text, setText] = useState(() => show(value));
  if (identity) return [value, onChange];
  const t = parseDecimal(text);
  const v = parseDecimal(value);
  const inStep = text.trim() === "" ? value.trim() === "" : Number.isFinite(t) && Number.isFinite(v) ? toStored(t) === v : text === value;
  const change = (s: string) => {
    setText(s);
    const n = parseDecimal(s);
    onChange(s.trim() === "" || !Number.isFinite(n) ? s : String(toStored(n)));
  };
  return [inStep ? text : show(value), change];
}

type WheelProps = ComponentProps<typeof WheelInput>;

/** WheelInput for a weight held in kg, shown and typed in kg or lb. */
export function WeightWheel({ value, onChange, min, max, step, fallback, ...rest }: WheelProps) {
  const u = useUnits();
  const lb = u.weight === "lb";
  const [text, change] = useConvertedText(value, onChange, u.toKg, (kg) => u.w(kg), !lb);
  return (
    <WheelInput {...rest} value={text} onChange={change} unit={u.weight}
      min={lb ? Math.floor(u.w(min)) : min} max={lb ? Math.ceil(u.w(max)) : max} step={lb ? Math.max(0.5, step) : step}
      fallback={fallback === undefined ? undefined : lb ? Math.round(u.w(fallback)) : fallback} />
  );
}

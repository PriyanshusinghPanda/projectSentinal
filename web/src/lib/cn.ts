import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merge — usable from both server and client components. */
export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

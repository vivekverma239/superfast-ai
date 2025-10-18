"use client";

import Link from "next/link";
import { Zap } from "lucide-react";

export function Logo() {
  return (
    <Link
      href="/folders"
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <div className="relative">
        <Zap className="h-6 w-6 text-blue-600" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          SuperFast AI
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          Lightning Fast AI
        </span>
      </div>
    </Link>
  );
}

"use client";

import React from "react";
import Link from "next/link";

export function CoreFooter() {
  return (
    <footer className="w-full bg-[#f0f3ff] py-6 border-t border-[#dee2ef]/40 mt-auto select-none">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[#45474c] text-xs font-medium">
        <div>© 2025 CORE ATS Inc. AI-assisted recruitment workspace.</div>
        <div className="flex items-center gap-6">
          <Link
            href="/audit-log"
            className="text-[#45474c] hover:text-[#171c25] transition-colors"
          >
            Audit Log
          </Link>
          <Link
            href="/taxonomy"
            className="text-[#45474c] hover:text-[#171c25] transition-colors"
          >
            Skills Library
          </Link>
          <Link
            href="/settings"
            className="text-[#45474c] hover:text-[#171c25] transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/upload"
            className="text-[#45474c] hover:text-[#171c25] transition-colors"
          >
            Imports
          </Link>
        </div>
      </div>
    </footer>
  );
}

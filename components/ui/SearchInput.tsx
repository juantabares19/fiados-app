'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, placeholder = 'Buscar...', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'w-full h-12 pl-12 pr-4 text-lg rounded-xl border-2 border-gray-200',
            'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200',
            'transition-colors placeholder:text-gray-400',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
import React, { useState, useRef } from 'react';
import { MoreVertical } from 'lucide-react';

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
};

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleBlur = (event: React.FocusEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} onBlur={handleBlur}>
      <div onClick={toggleMenu} tabIndex={0}>
        {trigger}
      </div>
      {isOpen && (
        <div className="absolute right-0 z-10 w-56 mt-2 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          {children}
        </div>
      )}
    </div>
  );
};

type DropdownTriggerProps = {
  label: string;
};

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({ label }) => (
  <button
    className="p-1 text-gray-700 bg-white rounded-full hover:bg-gray-100 focus:outline-none focus:ring-offset-gray-100 focus:ring-indigo-500"
    aria-label={label}
  >
    <MoreVertical className="w-4 h-4" />
  </button>
);
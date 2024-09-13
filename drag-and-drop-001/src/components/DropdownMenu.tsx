import React, { useState, useCallback, ForwardedRef } from 'react';

/**
 * Props for the DropdownTrigger component.
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 */
type DropdownTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: ForwardedRef<HTMLButtonElement>;
};

/**
 * Props for the DropdownItem component.
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 */
type DropdownItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClose?: () => void;
};

/**
 * Props for the DropdownMenu component.
 */
type DropdownProps = {
  id: string;
  children: React.ReactNode;
};

// Tracks the currently active dropdown
let activeDropdown: string | null = null;

// Global click event listener to close dropdown when clicking outside
document.addEventListener('click', (event) => {
  if (activeDropdown && !document.getElementById(activeDropdown)?.contains(event.target as Node)) {
    document.dispatchEvent(new CustomEvent('closeDropdown'));
  }
});

/**
 * DropdownMenu component that manages the state and behavior of a dropdown.
 * @param {DropdownProps} props - The props for the DropdownMenu component.
 * @returns {JSX.Element} The rendered DropdownMenu component.
 */
export function DropdownMenu({ id, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    activeDropdown = null;
    document.removeEventListener('closeDropdown', closeMenu);
  }, []);

  const toggleMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isOpen) {
      if (activeDropdown) {
        document.dispatchEvent(new CustomEvent('closeDropdown'));
      }
      activeDropdown = id;
      document.addEventListener('closeDropdown', closeMenu);
    } else {
      closeMenu();
    }
    setIsOpen(!isOpen);
  }, [isOpen, id, closeMenu]);

  return (
    <div className="relative inline-block text-left">
      {React.Children.map(children, child => {
        if (React.isValidElement<DropdownTriggerProps>(child) && child.type === DropdownTrigger) {
          return React.cloneElement(child, { 
            onClick: toggleMenu, 
            'aria-haspopup': true,
            'aria-expanded': isOpen
          });
        }
        return null;
      })}

      {isOpen && (
        <div 
          id={id} 
          className="absolute right-0 z-10 w-56 mt-2 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{
            top: '100%',
            right: 0,
          }}
        >
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            {React.Children.map(children, child => {
              if (React.isValidElement<DropdownItemProps>(child) && child.type !== DropdownTrigger) {
                return React.cloneElement(child, { onClose: closeMenu });
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DropdownTrigger component that renders the button to toggle the dropdown.
 */
export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className="inline-flex items-center justify-center w-8 h-8 text-gray-700 bg-white rounded-full hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-100 focus:ring-indigo-200"
      {...props}
    >
      {children}
    </button>
  )
);

/**
 * DropdownItem component that renders an item within the dropdown menu.
 */
export const DropdownItem = React.memo<DropdownItemProps>(
  ({ onClick, onClose, children, disabled, ...props }) => {
    const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        onClick?.(event);
        onClose?.();
      }
    }, [onClick, onClose, disabled]);

    return (
      <button
        onClick={handleClick}
        className={`block w-full px-4 py-2 text-sm text-left ${
          disabled 
            ? 'text-gray-400 cursor-not-allowed' 
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
        role="menuitem"
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';
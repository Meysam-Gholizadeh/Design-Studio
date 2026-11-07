import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & CommonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`${styles.button} ${className ?? ''}`} data-variant={variant} data-size={size} {...rest}>
      {icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
});

/** A router link styled as a button. */
export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconRight, className, children, ...rest }: LinkProps & CommonProps) {
  return (
    <Link className={`${styles.button} ${className ?? ''}`} data-variant={variant} data-size={size} {...rest}>
      {icon}
      {children && <span>{children}</span>}
      {iconRight}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name; also used as the tooltip. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', active, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`${styles.button} ${styles.iconOnly} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      data-active={active || undefined}
      {...rest}
    >
      {icon}
    </button>
  );
});

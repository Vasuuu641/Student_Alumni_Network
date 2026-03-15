import React from 'react';

type ButtonVariant = 'submit' | 'get-started' | 'already-have-account' | 'create-account';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  type?: 'button' | 'submit' | 'reset';
}

const variantClasses: Record<ButtonVariant, string> = {
  submit: 'submit-button',
  'get-started': 'hero-button hero-button--primary',
  'already-have-account': 'hero-button hero-button--secondary',
  'create-account': 'submit-button submit-button--soft',
};

const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  disabled = false,
  type = 'button',
  variant = 'submit',
  ...props
}) => {
  const classes = `${variantClasses[variant]} ${className}`.trim();

  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
};

export default Button;
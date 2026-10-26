import React, { useState } from 'react';
import { PRODUCT_MARK } from '../config/brand';
import { useInstitution } from '../hooks/useInstitution';

/**
 * The college's logo from Admin > Settings, or the product mark when no logo is set
 * (or the uploaded one fails to load).
 */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 36, className }) => {
  const { logoUrl, name } = useInstitution();
  const [broken, setBroken] = useState(false);
  const src = logoUrl && !broken ? logoUrl : PRODUCT_MARK;
  return (
    <img
      className={className}
      src={src}
      alt={logoUrl && !broken ? `${name} logo` : ''}
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      onError={() => setBroken(true)}
    />
  );
};

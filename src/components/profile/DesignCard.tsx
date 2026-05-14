import React from 'react';
import CollectionCard, { type CollectionCardProps } from './CollectionCard';

export type DesignCardProps = Omit<CollectionCardProps, 'cardKind'>;

const DesignCard: React.FC<DesignCardProps> = (props) => (
  <CollectionCard {...props} cardKind="design" />
);

export default React.memo(DesignCard);

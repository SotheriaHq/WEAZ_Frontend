// This file is deprecated. The edit functionality has been merged into CreateCollection.tsx.
// You can safely delete this file.
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildDesignRoute } from '@/utils/catalogRoutes';

const EditCollection: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(buildDesignRoute({ designId: id, legacyCollectionId: id, mode: 'edit' }), { replace: true });
    } else {
      navigate('/profile', { replace: true });
    }
  }, [id, navigate]);

  return null;
};

export default EditCollection;

import { useEffect, useState } from 'react';
import type { LibraryRepository } from '../../lib/library/types';
import type { ReactNode } from 'react';
import { sourceBlob } from '../../lib/library/asset-cache';
export default function CollectionThumbnail({
  id,
  repository,
  color,
  fallback,
}: {
  id: string;
  repository: LibraryRepository;
  color: string;
  fallback?: ReactNode;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      source = '';
    sourceBlob(repository, id)
      .then((blob) => {
        source = URL.createObjectURL(blob);
        if (active) setUrl(source);
        else URL.revokeObjectURL(source);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (source) URL.revokeObjectURL(source);
    };
  }, [id, repository]);
  return url ? (
    <img className="collection-thumbnail" src={url} alt="" />
  ) : (
    fallback || <i style={{ background: color }} />
  );
}

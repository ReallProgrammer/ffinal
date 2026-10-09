import { useEffect, useState } from 'react';
import type { LibraryRepository } from '../../lib/library/types';
export default function CollectionThumbnail({
  id,
  repository,
  color,
}: {
  id: string;
  repository: LibraryRepository;
  color: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true,
      source = '';
    repository
      .texture(id)
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
    <i style={{ background: color }} />
  );
}

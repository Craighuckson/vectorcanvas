
import type { ImageMetadata } from 'next/dist/lib/metadata/types/metadata-types';

export const contentType = 'image/svg+xml';

export default function Icon(): ImageMetadata {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#46B3AC"/>
      <path d="M9 23L14.0278 12L19.0556 19L23 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 9L23 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

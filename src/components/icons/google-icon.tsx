import type { SVGProps } from 'react';

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>Google</title>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.3 1.62-3.92 1.62-3.2 0-5.82-2.62-5.82-5.82s2.62-5.82 5.82-5.82c1.73 0 2.95.66 3.84 1.48l2.84-2.78C18.4 1.84 15.9.8 12.48.8 7.2.8 3.2 4.8 3.2 10s4 9.2 9.28 9.2c2.8 0 5.16-1 6.88-2.76.8-.84 1.36-2.04 1.36-3.88 0-.6-.05-1.16-.16-1.68z" />
    </svg>
  );
}

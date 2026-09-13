'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, DrawSVGPlugin);
  gsap.defaults({ ease: 'power3.out' });
}

export { gsap, useGSAP };

'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, DrawSVGPlugin, ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
}

export { gsap, useGSAP, ScrollTrigger };

export const INTRO_STORAGE_KEY = 'leemia-intro-v1';
export const INTRO_DURATION_MS = 4000;

export const introBootstrapScript = `(function(){try{var force=/(?:^|[?&])intro=1(?:&|$)/.test(location.search);var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var seen=sessionStorage.getItem('${INTRO_STORAGE_KEY}')==='1';if(force||(!reduce&&!seen)){document.documentElement.dataset.leemiaIntro='1'}}catch(e){}})();`;

export function clearIntroPlaceholder() {
  document.documentElement.removeAttribute('data-leemia-intro');
}

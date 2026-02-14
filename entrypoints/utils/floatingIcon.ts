import { SVG_STRING } from '../assets/floatingIcon';
import tailwindStyles from '../content-styles.css?inline';

interface CreateFloatingIconOptions {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: (e: MouseEvent) => void;
}

export const createFloatingIcon = ({
  onMouseEnter,
  onMouseLeave,
  onClick,
}: CreateFloatingIconOptions): HTMLDivElement => {
  const container = document.createElement('div');
  container.id = 'ai-proofduck-icon-container';
  const shadowRootNode = container.attachShadow({ mode: 'open' });

  // Tailwind styles
  const twStyle = document.createElement('style');
  twStyle.textContent = tailwindStyles;
  shadowRootNode.appendChild(twStyle);

  // Custom resets & Host styles
  const resetStyle = document.createElement('style');
  resetStyle.textContent = `
    :host {
      position: absolute;
      z-index: 2147483647;
      top: 0;
      left: 0;
      cursor: pointer;
      display: none;
      pointer-events: auto;
      width: 24px;
      height: 24px;
    }
  `;
  shadowRootNode.appendChild(resetStyle);

  const icon = document.createElement('div');
  icon.innerHTML = SVG_STRING;
  // Using Tailwind for dimensions, transition, hover scale, and drop shadow
  icon.className = 'w-6 h-6 flex drop-shadow-md transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.15]';

  shadowRootNode.appendChild(icon);

  container.addEventListener('mouseenter', onMouseEnter);
  container.addEventListener('mouseleave', onMouseLeave);

  icon.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  });

  icon.addEventListener('click', onClick);

  document.body.appendChild(container);
  return container;
};

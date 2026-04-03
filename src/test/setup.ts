import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// Reset URL between tests so drillState URL-sync doesn't bleed across tests
afterEach(() => {
  window.history.replaceState(null, '', '/');
});

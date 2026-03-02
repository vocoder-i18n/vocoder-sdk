import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

beforeEach(() => {
  document.cookie = 'vocoder_locale=; Path=/; Max-Age=0';
});

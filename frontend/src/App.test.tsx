// FIX: The default Create React App test looked for "learn react"
// which doesn't exist in our app — it would fail every time.
// Replaced with a simple smoke test that just checks the app renders.

import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('app renders without crashing', () => {
    // If this line doesn't throw an error, the test passes
    render(<App />);
});
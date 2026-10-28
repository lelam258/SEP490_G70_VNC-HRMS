import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { createServer } from 'vite';

// Rendering with a cleared session used to throw while React unmounted the protected pages.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  for (const file of ['/src/layouts/AppLayout.tsx', '/src/pages/DashboardPage.tsx']) {
    const { default: Component } = await server.ssrLoadModule(file);
    assert.doesNotThrow(() => renderToString(React.createElement(StaticRouter, { location: '/login' }, React.createElement(Component))), `${file} must tolerate a cleared session`);
  }
  console.log('PASS: layout and dashboard render safely after session is cleared.');
} finally {
  await server.close();
}

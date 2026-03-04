import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as admin from 'firebase-admin';

dotenv.config();

admin.initializeApp();

const execAsync = promisify(exec);

async function getIdToken(targetUrl: string): Promise<string | null> {
  try {
    // Try accessing the Google Cloud Metadata server first
    const response = await fetch(`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(targetUrl)}`, {
      headers: { 'Metadata-Flavor': 'Google' },
      // Use a short timeout so local development doesn't hang waiting for metadata server
      signal: AbortSignal.timeout(1000)
    });
    if (response.ok) {
      return (await response.text()).trim();
    }
  } catch (error) {
    // Ignore error (metadata server likely unreachable) and fallback to gcloud CLI
  }

  // Fallback to gcloud
  try {
    const { stdout } = await execAsync('gcloud auth print-identity-token');
    return stdout.trim();
  } catch (error) {
    console.error('Failed to get id token:', error);
    return null;
  }
}

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

// Parse ALLOWED_HOSTS env variable
const allowedHosts = process.env['ALLOWED_HOSTS']
  ? process.env['ALLOWED_HOSTS'].split(',').map(host => host.trim())
  : ['localhost', '127.0.0.1'];

const angularApp = new AngularNodeAppEngine({
  allowedHosts: allowedHosts
});

app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env['FIREBASE_API_KEY'],
    authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
    projectId: process.env['FIREBASE_PROJECT_ID'],
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
    messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'],
    appId: process.env['FIREBASE_APP_ID'],
    allowedDomainsEmails: process.env['ALLOWED_DOMAINS_EMAILS'] || '',
  });
});

app.use('/api/proxy', express.json(), async (req, res) => {
  const targetUrl = req.query['url'] as string;
  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const idToken = await getIdToken(targetUrl);
    const targetAuthHeader = idToken ? `Bearer ${idToken}` : undefined;

    // Get current user's email (as authenticated with Firebase Auth)
    const originalAuthToken = req.headers.authorization?.split('Bearer ')[1];
    if (!originalAuthToken) {
      res.status(401).send('Missing authorization token');
      return;
    }
    let userEmail = "";
    try {
      const decodedToken = await admin.auth().verifyIdToken(originalAuthToken);
      userEmail = decodedToken.email || "";
    } catch (error) {
      console.error('Failed to verify id token:', error);
      res.status(401).send('Invalid authorization token');
      return;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'X-Goog-Authenticated-User-Email': userEmail,
        ...(targetAuthHeader ? { 'Authorization': targetAuthHeader } : {}),
        ...(req.headers['x-a2a-extensions'] ? { 'X-A2A-Extensions': req.headers['x-a2a-extensions'] as string } : {})
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error: unknown) {
    console.error('Proxy error:', error);
    const err = error as Error;
    res.status(500).send(err.message || 'Proxy error');
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || "4000";
  app.listen(parseInt(port), "0.0.0.0", (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

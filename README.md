# Talk to Agents in A2A Chat Hub 💬

**The single easiest way to interact with traditional (chat-like) AI agents that support the [Agent2Agent (A2A)](https://a2a-protocol.org/) and [A2UI](https://a2ui.org/) protocols.**

Chat Hub is a lightweight, modern web application (built with Angular) tailored for AI agent developers who prioritize **interoperability**, seamless integration, and building rich interactive experiences using open standards.

🚀 Deploy in a few steps to [Google Cloud Run](https://cloud.google.com/run)!

## Vibe-coding alert!

This whole project is **95% vibe-coded** in [Antigravity with Gemini 3.1 Pro](https://antigravity.google/).

## What about it?

For developers building the next generation of AI agents, standardizing communication is key. This app serves as a ready-to-use frontend for your agents:

- **Agent2Agent (A2A) Interoperability**: Out-of-the-box support for the A2A protocol with streaming.
- **Agent-to-UI (A2UI) Powered**: Go beyond plain text. Render rich, agent-driven UI components directly in the chat using the native `@a2ui/angular` SDK integration.
- **Plug-and-Play**: Simply provide the URL of your A2A-compatible agent endpoint, and start interacting immediately.

As of today, the app uses [A2A **v0.3.0**](https://a2a-protocol.org/v0.3.0/) and [A2UI **v0.8**](https://a2ui.org/specification/v0.8-a2ui).

## Development

```bash
# Install dependencies and setup local A2UI libs
npm install

# Start the development server
npm run dev
```

## Configuration and Deployment

Deploying Chat Hub to Google Cloud Run is fully automated via the included deployment script: `npm run deploy` (which executes `scripts/deploy.sh`).

### Prerequisites

You need to have the following tools installed:
- [`gcloud` (Google Cloud SDK)](https://cloud.google.com/sdk)
- [`node` and `npm` (Node.js and its package manager)](https://nodejs.org/)


### Deployment

At first, you need to create a Firebase project:

1. In you web browser, go to [console.firebase.google.com](https://console.firebase.google.com/).
2. Create or select a Google Cloud project.
3. One created, switch to **Authentication** (in *Build* product category) and enable **Google** sign-in method.
4. If you want to try this app locally, while in *Authentication*, switch to **Settings** then **Authorized domains** and add `localhost` and `127.0.0.1` to the list of authorized domains.
5. Navigate to **Project Settings** (gear icon) -> **General**, find **Your apps** section and add a new web app.
6. When configuring the app, at **Add Firebase SDK** step, copy **firebaseConfig** (Firebase configuration) value:

   It looks like this:

   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

7. Paste the copied values one by one into `.env` file (use `.env.example` as a template):

   ```env
   FIREBASE_API_KEY=YOUR_API_KEY
   FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
   FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
   FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
   FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
   FIREBASE_APP_ID=YOUR_APP_ID
   ```

Before deploying, ensure you have the appropriate Firebase and Google Cloud configurations set.

If you are limiting access by email domain, you can also set `ALLOWED_DOMAINS_EMAILS` variable in `.env` file (e.g., `user@example.com, mycompany.com`).

Now, deploy the configured appto Cloud Run:

```bash
npm run deploy
```

Enjoy! 🎉

> Note 1: If it doesn't already exist, the script automatically provisions a dedicated service account (`a2a-chat-hub-sa@<PROJECT_ID>.iam.gserviceaccount.com`).

> Note 2: If A2A agent is deployed to Cloud Run, this app's service account needs to be granted the **Cloud Run Invoker** (`roles/run.invoker`) role on the agent's Cloud Run service or project. Every request to an A2A agent includes an `Authorization` header populated with this app's Cloud Run service account ID token. Requests also pass the `X-Goog-Authenticated-User-Email` header, representing the email of the authenticated app user.

> Note 3: `.gcloudignore` file allows `dist` and `node_modules` to be _included_ in uploaded sources.
This is necessary for deploying the app [to Cloud Run without building a container](https://docs.cloud.google.com/run/docs/deploying-source-code#deploy_without_build).


Have fun!


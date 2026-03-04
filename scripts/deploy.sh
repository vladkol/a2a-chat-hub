#!/bin/bash
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# End-to-end Deployment Script

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "${SCRIPT_DIR}/.." # to project root

# Load .env file if it exists.
# Optionally, use a custom .env file path via ENV_FILE environment variable.
if [[ "$ENV_FILE" == "" ]]; then
    export ENV_FILE=".env"
fi
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
elif [[ "${BUILD_ID}" == "" ]]; then
    # Warn the user that the .env file is not found, unless we are running in a Cloud Build pipeline.
    echo "⚠️ WARNING: $ENV_FILE file not found. Using current or default values."
fi

if [[ "${GOOGLE_CLOUD_REGION}" == "" ]]; then
    GOOGLE_CLOUD_REGION="us-west1"
    echo "⚠️ WARNING: GOOGLE_CLOUD_REGION not set. Using default value: ${GOOGLE_CLOUD_REGION}"
fi

if [[ "${CLOUD_RUN_SERVICE_NAME}" == "" ]]; then
    CLOUD_RUN_SERVICE_NAME="a2a-chat-hub"
    echo "⚠️ WARNING: CLOUD_RUN_SERVICE_NAME not set. Using default value: ${CLOUD_RUN_SERVICE_NAME}"
fi

# Check requred variables:
# FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID

if [[ "${FIREBASE_API_KEY}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_API_KEY not set."
    exit 1
fi

if [[ "${FIREBASE_AUTH_DOMAIN}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_AUTH_DOMAIN not set."
    exit 1
fi

if [[ "${FIREBASE_PROJECT_ID}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_PROJECT_ID not set."
    exit 1
fi

if [[ "${FIREBASE_STORAGE_BUCKET}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_STORAGE_BUCKET not set."
    exit 1
fi

if [[ "${FIREBASE_MESSAGING_SENDER_ID}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_MESSAGING_SENDER_ID not set."
    exit 1
fi

if [[ "${FIREBASE_APP_ID}" == "" ]]; then
    echo "🛑 ERROR: FIREBASE_APP_ID not set."
    exit 1
fi

if [[ "${GOOGLE_CLOUD_PROJECT}" != "" && "${GOOGLE_CLOUD_PROJECT}" != ${FIREBASE_PROJECT_ID} ]]; then
    echo "⚠️ WARNING: GOOGLE_CLOUD_PROJECT and FIREBASE_PROJECT_ID are set to different values. Using FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}"
fi

echo "🚀 Deploying to Cloud Run service ${CLOUD_RUN_SERVICE_NAME} with Firebase App ID ${FIREBASE_APP_ID}"

GOOGLE_CLOUD_PROJECT=${FIREBASE_PROJECT_ID}

# Enable APIs
echo "Configuring Google APIs..."
gcloud services enable \
    --project "${GOOGLE_CLOUD_PROJECT}" \
    run.googleapis.com \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com \
    identitytoolkit.googleapis.com

if [[ "${CLOUD_RUN_SERVICE_ACCOUNT}" == "" ]]; then
    CLOUD_RUN_SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_NAME}-sa"
fi
CR_SA_EMAIL="${CLOUD_RUN_SERVICE_ACCOUNT}@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"

# Creating service account for Cloud Build. Granting necessary roles to it.
if ! gcloud iam service-accounts describe "${CR_SA_EMAIL}" --project "${GOOGLE_CLOUD_PROJECT}" &> /dev/null; then
    echo "🔐 Creating service account ${CLOUD_RUN_SERVICE_ACCOUNT} (${CR_SA_EMAIL})."
    gcloud iam service-accounts create ${CLOUD_RUN_SERVICE_ACCOUNT} --project "${GOOGLE_CLOUD_PROJECT}" --display-name "${CLOUD_RUN_SERVICE_NAME} Service Account"
    sleep 10 # Sometimes needed to let the service account "show up"
fi

export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT}"
export GOOGLE_CLOUD_REGION="${GOOGLE_CLOUD_REGION}"

# Installing dependencies and building the app locally
echo "📦 Installing dependencies and building the app locally..."
npm install
npm run build

echo "🚀 Configuring and deploying Cloud Run service..."

# Taking care of ALLOWED_HOSTS
PROJECT_NUMBER=$(gcloud projects describe "${GOOGLE_CLOUD_PROJECT}" --format="value(projectNumber)" -q)
# Default service hostname is of the form: <service-name>-<project-number>.<region>.run.app
DEFAULT_SERVICE_HOSTNAME="${CLOUD_RUN_SERVICE_NAME}-${PROJECT_NUMBER}.${GOOGLE_CLOUD_REGION}.run.app"

# Get existing ALLOWED_HOSTS from Cloud Run service (if it already exists)
EXISTING_ALLOWED_HOSTS=$(gcloud run services describe "${CLOUD_RUN_SERVICE_NAME}" \
  --format=json \
  --project "${GOOGLE_CLOUD_PROJECT}" \
  --region "${GOOGLE_CLOUD_REGION}" 2>/dev/null | \
  python3 -c "import sys, json; print(next(env['value'] for env in json.load(sys.stdin)['spec']['template']['spec']['containers'][0]['env'] if env['name'] == 'ALLOWED_HOSTS'))" 2>/dev/null || echo "")
# If no existing ALLOWED_HOSTS, use the default service hostname
if [[ "${EXISTING_ALLOWED_HOSTS}" != "" ]]; then
    export ALLOWED_HOSTS="${EXISTING_ALLOWED_HOSTS}"
else
    export ALLOWED_HOSTS="${DEFAULT_SERVICE_HOSTNAME}"
fi

# Deploying to Cloud Run from source code without building a container
gcloud beta run deploy "${CLOUD_RUN_SERVICE_NAME}" \
  --source . \
  --no-build \
  --base-image=nodejs24 \
  --command="npm" \
  --args="run" \
  --args="serve:ssr:app" \
  --project "${GOOGLE_CLOUD_PROJECT}" \
  --region "${GOOGLE_CLOUD_REGION}" \
  --service-account="${CR_SA_EMAIL}" \
  --set-env-vars NODE_ENV=production \
  --set-env-vars GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT}" \
  --set-env-vars GOOGLE_CLOUD_REGION="${GOOGLE_CLOUD_REGION}" \
  --set-env-vars FIREBASE_API_KEY="${FIREBASE_API_KEY}" \
  --set-env-vars FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}" \
  --set-env-vars FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
  --set-env-vars FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET}" \
  --set-env-vars FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}" \
  --set-env-vars FIREBASE_APP_ID="${FIREBASE_APP_ID}" \
  --set-env-vars ^:^ALLOWED_HOSTS="${ALLOWED_HOSTS}" \
  --set-env-vars ^:^ALLOWED_DOMAINS_EMAILS="${ALLOWED_DOMAINS_EMAILS}" \
  --no-allow-unauthenticated \
  --no-invoker-iam-check

echo "✔️ Cloud Run service has been deployed."

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe "${CLOUD_RUN_SERVICE_NAME}" \
  --project "${GOOGLE_CLOUD_PROJECT}" \
  --region "${GOOGLE_CLOUD_REGION}" \
  --format 'value(status.url)' -q)

# If no existing ALLOWED_HOSTS, update the service configuration with more hostnames
if [[ "${EXISTING_ALLOWED_HOSTS}" == "" ]]; then
    echo "Updating service configuration..."

    # Get host from URL
    # - Remove the https:// prefix
    SERVICE_HOST="${SERVICE_URL#https://}"
    # - Remove the trailing slash (if it exists)
    SERVICE_HOST="${SERVICE_HOST%/}"

    # List all mapped domains
    DOMAIN_MAPPINGS=$(gcloud beta run domain-mappings list --filter="spec.routeName=${CLOUD_RUN_SERVICE_NAME}" --project "${GOOGLE_CLOUD_PROJECT}" --format="value(metadata.name)" | paste -sd "," -)

    # ALLOWED_HOSTS
    ALLOWED_HOSTS="${SERVICE_HOST},${DEFAULT_SERVICE_HOSTNAME}"
    if [[ "${DOMAIN_MAPPINGS}" != "" ]]; then
        ALLOWED_HOSTS="${ALLOWED_HOSTS},${DOMAIN_MAPPINGS}"
    fi

    # Set ALLOWED_HOSTS env variable
    gcloud run services update "${CLOUD_RUN_SERVICE_NAME}" \
    --project "${GOOGLE_CLOUD_PROJECT}" \
    --region "${GOOGLE_CLOUD_REGION}" \
    --update-env-vars "^:^ALLOWED_HOSTS=${ALLOWED_HOSTS}"
fi

source ./scripts/update_auth_domains.sh

echo "✅ Deployment completed successfully."
echo "👉 Service URL: ${SERVICE_URL}"

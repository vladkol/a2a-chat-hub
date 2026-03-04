
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

echo "🚀 Updating Firebase Authentication Configuration..."

if [ -z "${ALLOWED_HOSTS}" ]; then
  echo "❌ ALLOWED_HOSTS is not set."
  exit 1
fi

PROJECT_ID=$GOOGLE_CLOUD_PROJECT
DOMAINS="${ALLOWED_HOSTS}"

ACCESS_TOKEN=$(gcloud auth print-access-token -q)

CONFIG=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config")

# Handle configuration not found or other errors
ERROR_MSG=$(echo "$CONFIG" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', {}).get('message', ''))")
if [ -z "$ERROR_MSG" ]; then
    IS_ERROR=$(echo "$CONFIG" | python3 -c "import sys, json; print('error' in json.load(sys.stdin))")
    if [ "$IS_ERROR" == "True" ] && [ -z "$ERROR_MSG" ]; then
        ERROR_MSG="Unknown error"
    fi
fi

if [ -n "$ERROR_MSG" ]; then
  echo "❌ Error retrieving Identity Toolkit configuration: $ERROR_MSG"
  echo "👉 Please perform configuration on https://console.firebase.google.com/project/$PROJECT_ID/authentication"
  echo "👉 Make sure you add Google Authentication provider."
  echo "👉 Then run this script again."
  exit 1
fi

PYTHON_OUT=$(echo "$CONFIG" | python3 -c "
import sys, json
config = json.load(sys.stdin)
domains = config.get('authorizedDomains', [])
new_domains = sys.argv[1]
api_key = config.get('client', {}).get('apiKey', '')
result = {'api_key': api_key}
added = False
for new_domain in new_domains.split(','):
  new_domain = new_domain.strip()
  if new_domain and new_domain not in domains:
    domains.append(new_domain)
    added = True
if added:
  result['patch'] = {'authorizedDomains': domains}
print(json.dumps(result))
" "$DOMAINS")

NEW_PAYLOAD=$(echo "$PYTHON_OUT" | python3 -c "import sys, json; out = json.load(sys.stdin).get('patch'); print(json.dumps(out)) if out else print('')")

if [ -n "$NEW_PAYLOAD" ]; then
  echo "📦 Patching authorized domains..."
  curl -X PATCH \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -d "$NEW_PAYLOAD" \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains" > /dev/null
  echo "✔️ Patched authorized domains"
else
  echo "✔️ Domain(s) $DOMAINS are already in authorizedDomains."
fi

echo "✔️ Updated Authentication Configuration."
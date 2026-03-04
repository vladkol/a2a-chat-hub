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

# Automates the building and installation of @a2ui/web_core directly from GitHub

set -e

WEB_CORE_PACKAGE_FILE="a2ui-web_core.tgz"
WEB_CORE_COMMIT="e865988d4345be5962c0795ba87d94dd4b4c8ca3"

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "${SCRIPT_DIR}"

PROJECT_ROOT="${SCRIPT_DIR}/.."

if [ -f "$PROJECT_ROOT/lib/$WEB_CORE_PACKAGE_FILE" ]; then
  echo "A2UI web_core package already exists at lib/$WEB_CORE_PACKAGE_FILE. Skipping build."
  # It's already built, so we just exit successfully!
  exit 0
fi

echo "Setting up A2UI web_core from GitHub..."

# Create lib folder to hold the generated package
mkdir -p "$PROJECT_ROOT/lib"
TMP_DIR=$(mktemp -d)

# Cleanup on exit
trap "rm -rf $TMP_DIR" EXIT

cd "$TMP_DIR"
echo "Cloning A2UI repository..."
git clone --depth 1 --revision $WEB_CORE_COMMIT https://github.com/google/A2UI.git A2UI

echo "Building web_core..."
cd A2UI/renderers/web_core
npm install

# The build script in web_core might need some schemas copied, which wireit usually handles.
# Wireit runs the build.
npm run build

echo "Packing web_core package..."
npm pack

# Find the generated tgz and move it to our project's lib folder
TGZ_FILE=$(ls a2ui*web_core*.tgz | head -n 1)

mv "$TGZ_FILE" "$PROJECT_ROOT/lib/$WEB_CORE_PACKAGE_FILE"

echo "Package moved to lib/$WEB_CORE_PACKAGE_FILE"

cd "$PROJECT_ROOT"

echo "Installing package..."
npm install ./lib/$WEB_CORE_PACKAGE_FILE

echo "Setup complete! You can safely delete any local a2ui_web_core source folder."

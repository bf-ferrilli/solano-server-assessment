#!/usr/bin/env bash
set -euo pipefail

# Path to your existing HTML file
html_file="index.html"

# Update Environment column:
# Convert "PROD" to "Prod", "TEST" to "Test", "PPRD" to "Pprd", and "DEVL" to "Devl"
# and wrap each in a span with the Red Hat blue tag style.
sed -i 's#<td>PROD</td>#<td><span class="rh-tag rh-tag--filled rh-tag--blue">prod</span></td>#g' "$html_file"
sed -i 's#<td>TEST</td>#<td><span class="rh-tag rh-tag--filled rh-tag--blue">test</span></td>#g' "$html_file"
sed -i 's#<td>PPRD</td>#<td><span class="rh-tag rh-tag--filled rh-tag--blue">pprd</span></td>#g' "$html_file"
sed -i 's#<td>DEVL</td>#<td><span class="rh-tag rh-tag--filled rh-tag--blue">devl</span></td>#g' "$html_file"

# Update Firewall column:
# Wrap Y in a green tag and N in a red tag.
sed -i 's#<td>Y</td>#<td><span class="rh-tag rh-tag--filled rh-tag--green">Y</span></td>#g' "$html_file"
sed -i 's#<td>N</td>#<td><span class="rh-tag rh-tag--filled rh-tag--red">N</span></td>#g' "$html_file"

echo "Updated $html_file with tag styles for Environment and Firewall."
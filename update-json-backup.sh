#!/bin/bash

# Script to update server-mappings.json to add backup property to all roles

# Check if file exists
if [ ! -f "server-mappings.json" ]; then
    echo "Error: server-mappings.json file not found in current directory"
    exit 1
fi

# Check if jq is installed (required for JSON processing)
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    echo "On Ubuntu/Debian: sudo apt-get install jq"
    echo "On CentOS/RHEL: sudo yum install jq"
    echo "On macOS with Homebrew: brew install jq"
    exit 1
fi

# Create a backup
echo "Creating backup of server-mappings.json as server-mappings.json.bak"
cp server-mappings.json server-mappings.json.bak

echo "Updating server-mappings.json to add backup property to all roles..."

# Process the JSON file using jq to add backup: false where it's missing
jq '
# Function to add backup property if missing
def add_backup_if_missing:
  if type == "object" and (.backup | not) then
    . + {backup: false}
  else
    .
  end;

# Process servers section
.servers |= (
  with_entries(.value |= (
    if type == "array" then
      map(add_backup_if_missing)
    else
      add_backup_if_missing
    end
  ))
) |

# Process environments section
.environments |= (
  with_entries(.value.applications |= (
    with_entries(.value |= (
      map(add_backup_if_missing)
    ))
  ))
)
' server-mappings.json > server-mappings.json.new

# Replace the original file with the new one
mv server-mappings.json.new server-mappings.json

echo "Update complete. Original file saved as server-mappings.json.bak"
echo "Review the changes and test the application."

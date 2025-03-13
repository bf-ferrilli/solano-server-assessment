#!/bin/bash

# Script to update server-manager.js to support backup column at position 6

# Check if file exists
if [ ! -f "server-manager.js" ]; then
    echo "Error: server-manager.js file not found in current directory"
    exit 1
fi

# Create a backup
echo "Creating backup of server-manager.js as server-manager.js.bak"
cp server-manager.js server-manager.js.bak

echo "Updating server-manager.js to support backup column at position 6..."

# 1. Replace backup cell index from 9 to 6 in various functions
sed -i 's/const backupCell = row\.cells\[9\];/const backupCell = row\.cells\[6\];/g' server-manager.js
sed -i 's/if (row\.dataset\.originalBackup && row\.cells\[9\]) {/if (row\.dataset\.originalBackup \&\& row\.cells\[6\]) {/g' server-manager.js
sed -i 's/row\.cells\[9\]\.innerHTML = row\.dataset\.originalBackup;/row\.cells\[6\]\.innerHTML = row\.dataset\.originalBackup;/g' server-manager.js

# 2. Update row length checks for existing backup cell
sed -i 's/} else if (row\.cells\.length === 10) { \/\/ Already has backup cell/} else if (row\.cells\.length >= 10) { \/\/ Already has backup cell/g' server-manager.js
sed -i 's/const backupCell = row\.cells\[9\]; \/\/ Backup is at index 9/const backupCell = row\.cells\[6\]; \/\/ Backup is at index 6/g' server-manager.js

# 3. Update the actions cell index (from 9 to 10)
sed -i 's/const actionsCell = row\.cells\[9\]; \/\/ The actions cell/const actionsCell = row\.cells\[10\]; \/\/ The actions cell/g' server-manager.js
sed -i 's/const editCell = currentEditingRow\.cells\[9\];/const editCell = currentEditingRow\.cells\[10\];/g' server-manager.js

# 4. Update row length checks for adding actions column
sed -i 's/if (row\.cells\.length === 9) { \/\/ If there are exactly 9 columns (without actions)/if (row\.cells\.length === 10) { \/\/ If there are exactly 10 columns (without actions)/g' server-manager.js

# 5. Update header length check for adding actions column
sed -i 's/if (headerRow && headerRow\.cells\.length === 9) {/if (headerRow \&\& headerRow\.cells\.length === 10) {/g' server-manager.js

# 6. Comment out adding backup header - fixed the problem with backreferences
sed -i '/\/\/ Add backup header/i\/\/ Backup header already exists in HTML' server-manager.js
sed -i 's/\/\/ Add backup header/\/\/ COMMENTED OUT: Add backup header/g' server-manager.js
sed -i '/const backupHeader = document\.createElement/s/^/\/\//g' server-manager.js
sed -i '/backupHeader\.textContent = /s/^/\/\//g' server-manager.js
sed -i '/headerRow\.appendChild(backupHeader);/s/^/\/\//g' server-manager.js

# 7. Update JSON structure - add default backup property
# This adds a line after the variable declarations to set default backup property
sed -i '/let isAddingNewServer = false;/a\\n\/\/ Set default backup status to false for backward compatibility\nconst DEFAULT_BACKUP_STATUS = false;' server-manager.js

# 8. Update role creation to include backup property
sed -i 's/os: \x27\x27 \/\/ Add default OS field/os: \x27\x27, \/\/ Add default OS field\n      backup: DEFAULT_BACKUP_STATUS \/\/ Default backup status/g' server-manager.js
sed -i 's/os: \x27\x27 \/\/ Add default OS field/os: \x27\x27, \/\/ Add default OS field\n        backup: DEFAULT_BACKUP_STATUS \/\/ Default backup status/g' server-manager.js

# 9. Make sure existing roles have backup property
cat >> server-manager.js << 'EOF'

// Add function to ensure all roles have backup property
function ensureBackupProperty(roles) {
  // If roles is a single object (not array), convert to array
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  // Ensure each role has backup property
  roleArray.forEach(role => {
    if (role && typeof role === 'object' && role.backup === undefined) {
      role.backup = DEFAULT_BACKUP_STATUS;
    }
  });
  
  return roleArray;
}
EOF

# 10. Update updateServerMapping function to call ensureBackupProperty
sed -i '/const validRoles = roles.filter/i\\n    // Ensure all roles have backup property\n    roles = ensureBackupProperty(roles);' server-manager.js

echo "Update complete. Original file saved as server-manager.js.bak"
echo "Review the changes and test the application."

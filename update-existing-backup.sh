#!/bin/bash

# Script to update server-manager.js to work with existing backup column

# Check if file exists
if [ ! -f "server-manager.js" ]; then
    echo "Error: server-manager.js file not found in current directory"
    exit 1
fi

# Create a backup
echo "Creating backup of server-manager.js as server-manager.js.backup-fix.bak"
cp server-manager.js server-manager.js.backup-fix.bak

echo "Updating server-manager.js to work with your existing backup column..."

# 1. Add DEFAULT_BACKUP_STATUS constant
sed -i '/let isAddingNewServer = false;/a\\n\/\/ Set default backup status to false for backward compatibility\nconst DEFAULT_BACKUP_STATUS = false;' server-manager.js

# 2. Add backup property to the defaultRole object in multiple places
sed -i 's/os: \x27\x27 \/\/ Add default OS field/os: \x27\x27, \/\/ Add default OS field\n      backup: DEFAULT_BACKUP_STATUS \/\/ Default backup status/g' server-manager.js

# 3. Add function to update existing backup cell
cat >> server-manager.js << 'EOF'

// Function to update the backup cell to reflect the backup status
function updateBackupCell(backupCell, hasBackup) {
  if (!backupCell) return;
  
  backupCell.innerHTML = '';
  const backupTag = document.createElement('span');
  backupTag.className = hasBackup ? 'tag tag-success' : 'tag tag-danger';
  backupTag.textContent = hasBackup ? 'Y' : 'N';
  backupCell.appendChild(backupTag);
}

// Function to ensure all roles have backup property
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

# 4. Modify updateExistingTags function to update backup cells using your existing style
sed -i '/updateExistingTags/,/^}/s/const backupIndicator = document\.createElement(.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/updateExistingTags/,/^}/s/backupIndicator\.className = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/updateExistingTags/,/^}/s/backupIndicator\.textContent = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/updateExistingTags/,/^}/s/backupCell\.appendChild(backupIndicator);/updateBackupCell(backupCell, hasBackup);/g' server-manager.js

# 5. Modify convertNewRowToNormal to use the new function for backup cell
sed -i '/convertNewRowToNormal/,/^}/s/const backupIndicator = document\.createElement(.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/convertNewRowToNormal/,/^}/s/backupIndicator\.className = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/convertNewRowToNormal/,/^}/s/backupIndicator\.textContent = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/convertNewRowToNormal/,/^}/s/backupCell\.appendChild(backupIndicator);/updateBackupCell(backupCell, hasBackup);/g' server-manager.js

# 6. Modify exitEditMode to use the new function for backup cell
sed -i '/exitEditMode/,/^}/s/const backupIndicator = document\.createElement(.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/exitEditMode/,/^}/s/backupIndicator\.className = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/exitEditMode/,/^}/s/backupIndicator\.textContent = (.*)$/  \/\/ Use updateBackupCell function instead/g' server-manager.js
sed -i '/exitEditMode/,/^}/s/backupCell\.appendChild(backupIndicator);/updateBackupCell(backupCell, hasBackup);/g' server-manager.js

# 7. Update updateServerMapping function to call ensureBackupProperty
sed -i '/const validRoles = roles.filter/i\\n    // Ensure all roles have backup property\n    roles = ensureBackupProperty(roles);' server-manager.js

# 8. Remove any code that tries to add a backup column since it already exists
sed -i '/\/\/ Add backup cell if it doesn.t exist/,/row.appendChild(backupCell);/s/^/\/\/ EXISTING COLUMN: /' server-manager.js
sed -i 's/if (row\.cells\.length === 9) { \/\/ If there are exactly 9 columns (without backup & actions)/if (row.cells.length === 10) { \/\/ If there are exactly 10 columns (without actions)/g' server-manager.js
sed -i '/if (headerRow && headerRow.cells.length === 9)/,/headerRow.appendChild(backupHeader);/s/^/\/\/ EXISTING COLUMN: /' server-manager.js

echo "Update complete. Original file saved as server-manager.js.backup-fix.bak"
echo "This script now works with your existing backup column and uses your tag-success/tag-danger styles."
echo "It will update the Y/N status in the backup column based on the data in server-mappings.json."

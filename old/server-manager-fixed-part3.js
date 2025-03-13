// Save changes for multiple roles
function saveMultiRoleChanges(row, serverName) {
  // Collect all role entries
  const roleEntries = row.cells[COLUMN.ROLE].querySelectorAll('.role-entry');
  if (roleEntries.length === 0) {
    showNotification('Error: No roles found', 'error');
    return;
  }
  
  // Build array of roles
  const roles = [];
  
  roleEntries.forEach(entry => {
    const envSelect = entry.querySelector('.environment-select');
    const roleSelect = entry.querySelector('.role-select');
    const descInput = entry.querySelector('.description-input');
    
    // OS information fields
    const osTypeSelect = entry.querySelector('.os-type-select');
    const osVersionSelect = entry.querySelector('.os-version-select');
    const osCustomInput = entry.querySelector('.os-custom-input');
    
    if (!envSelect || !roleSelect) {
      return;
    }
    
    const environment = envSelect.value;
    const role = roleSelect.value;
    const description = descInput ? descInput.value.trim() : '';
    
    // Get OS value based on the selected controls
    let os = '';
    if (osTypeSelect) {
      const osType = osTypeSelect.value;
      
      if (osType === 'other' && osCustomInput) {
        os = osCustomInput.value.trim();
      } else if (osType !== '' && osVersionSelect && osVersionSelect.value) {
        os = osVersionSelect.value;
      }
    }
    
    // Validate
    if (!environment || !role) {
      return;
    }
    
    roles.push({
      environment,
      role,
      description,
      os  // Include OS information
    });
  });
  
  if (roles.length === 0) {
    showNotification('Error: At least one valid role is required', 'error');
    return;
  }
  
  // Update server mapping in JSON
  updateMultiRoleServerMapping(serverName, roles)
    .then(success => {
      if (success) {
        // Exit edit mode and update UI
        exitEditMode(row, roles);
      }
    });
}

// Update server mapping for multiple roles
async function updateMultiRoleServerMapping(serverName, roles) {
  if (!serverMappings) {
    showNotification('Server mappings not loaded', 'error');
    return false;
  }
  
  try {
    // Validate roles before proceeding
    // Ensure all roles have backup property
    roles = ensureBackupProperty(roles);
    
    const validRoles = roles.filter(role => 
      role && 
      typeof role === 'object' && 
      role.environment && 
      role.role && 
      role.role.trim() !== ''
    );
    
    if (validRoles.length === 0) {
      showNotification('Error: No valid roles to save', 'error');
      return false;
    }
    
    // Ensure the environments structure exists
    if (!serverMappings.environments) {
      serverMappings.environments = {};
    }
    
    // Ensure all environments exist
    validRoles.forEach(role => {
      if (!serverMappings.environments[role.environment]) {
        serverMappings.environments[role.environment] = {
          applications: {}
        };
        console.log(`Created missing environment: ${role.environment}`);
      }
    });
    
    // Remove server from all existing roles in all environments
    Object.values(serverMappings.environments).forEach(env => {
      if (env && env.applications) {
        Object.entries(env.applications).forEach(([roleName, servers]) => {
          if (Array.isArray(servers)) {
            const index = servers.findIndex(s => s && s.server === serverName);
            if (index >= 0) {
              servers.splice(index, 1);
            }
          }
        });
      }
    });
    
    // Add server to each role in each environment
    validRoles.forEach(roleData => {
      const { environment, role, description, os } = roleData;
      
      // Ensure this environment has an applications object
      if (!serverMappings.environments[environment].applications) {
        serverMappings.environments[environment].applications = {};
      }
      
      // Ensure role exists in environment
      if (!serverMappings.environments[environment].applications[role]) {
        serverMappings.environments[environment].applications[role] = [];
      }
      
      // Add server to role
      serverMappings.environments[environment].applications[role].push({
        server: serverName,
        description: description || '',
        os: os || '' // Include OS information
      });
    });
    
    // Ensure servers section exists
    if (!serverMappings.servers) {
      serverMappings.servers = {};
    }
    
    // Update servers section - use array for multiple roles, single object for one role
    if (validRoles.length === 1) {
      serverMappings.servers[serverName] = validRoles[0];
    } else {
      serverMappings.servers[serverName] = validRoles;
    }
    
    // Save to server via API
    return await saveServerMappings();
  } catch (error) {
    console.error('Error updating server mapping:', error.message);
    showNotification('Failed to update server mapping: ' + error.message, 'error');
    return false;
  }
}

// Save server mappings to the server via API
async function saveServerMappings() {
  try {
    // Create a deep copy to avoid reference issues
    const mappingsToSave = JSON.parse(JSON.stringify(serverMappings));
    
    // Save to server via API endpoint
    const response = await fetch('/api/save-mappings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mappingsToSave),
    });
    
    if (!response.ok) {
      let errorMessage = 'Failed to save mappings';
      try {
        const errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.warn('Warning: Could not parse success response as JSON', parseError);
    }
    
    // Show success message
    showNotification('Server mappings saved successfully to server', 'success');
    
    return true;
  } catch (error) {
    console.error('Error saving server mappings:', error.message);
    showNotification('Failed to save to server: ' + error.message + '. Downloading file instead.', 'error');
    
    try {
      // Fallback to downloading if server save fails
      downloadJson();
    } catch (downloadError) {
      console.error('Error downloading JSON:', downloadError);
      showNotification('Failed to download JSON file', 'error');
    }
    
    return false;
  }
}

// Download JSON file (fallback if server save fails)
function downloadJson() {
  try {
    const jsonString = JSON.stringify(serverMappings, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server-mappings.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    showNotification('Downloaded server-mappings.json file. Please upload this file to the server.', 'info');
  } catch (error) {
    console.error('Error in downloadJson:', error);
    throw error; // Re-throw to be handled by the caller
  }
}

// Exit edit mode and update UI
function exitEditMode(row, roles) {
  // Create environment tags for unique environments
  const envCell = row.cells[COLUMN.ENVIRONMENT];
  envCell.innerHTML = '';
  
  // Get unique environments from roles
  const uniqueEnvironments = new Set(roles.map(role => role.environment));
  
  // Add each unique environment
  Array.from(uniqueEnvironments).forEach((env, index) => {
    // Add line break for subsequent environments
    if (index > 0) {
      envCell.appendChild(document.createElement('br'));
    }
    
    // Create environment tag
    const envTag = document.createElement('span');
    envTag.className = `env-tag env-tag-${env.toLowerCase()}`;
    envTag.textContent = env.toUpperCase();
    envCell.appendChild(envTag);
  });
  
  // Create role tag for all roles
  const roleCell = row.cells[COLUMN.ROLE];
  roleCell.innerHTML = '';
  
  roles.forEach((roleData, index) => {
    // Create role tag
    const roleTag = document.createElement('span');
    roleTag.className = `app-tag env-tag-${roleData.environment.toLowerCase()}`;
    roleTag.textContent = roleData.role;
    
    if (roleData.description) {
      roleTag.textContent += ` (${roleData.description})`;
    }
    
    // Add multiple roles with line breaks
    if (index > 0) {
      roleCell.appendChild(document.createElement('br'));
    }
    
    roleCell.appendChild(roleTag);
  });
  
  // Update OS information if the cell exists
  const osCell = row.cells[COLUMN.OS];
  if (osCell) {
    osCell.innerHTML = '';
    
    // Get all unique OS values
    const osValues = new Set();
    roles.forEach(roleData => {
      if (roleData.os) osValues.add(roleData.os);
    });
    
    Array.from(osValues).forEach((os, index) => {
      if (index > 0) {
        osCell.appendChild(document.createElement('br'));
      }
      
      const osSpan = document.createElement('span');
      
      // Get lifecycle status
      const lifecycleStatus = getLifecycleStatus(os);
      
      // Add appropriate class based on lifecycle status
      switch (lifecycleStatus) {
        case 0: // Supported
          osSpan.className = 'os-tag os-tag-supported';
          break;
        case 1: // ELS
          osSpan.className = 'os-tag os-tag-els';
          osSpan.title = 'Extended Lifecycle Support';
          break;
        case 2: // EOL
          osSpan.className = 'os-tag os-tag-eol';
          osSpan.title = 'End of Life';
          break;
        default:
          osSpan.className = 'os-tag os-tag-unknown';
      }
      
      osSpan.textContent = os;
      
      // Add status indicator for ELS and EOL
      if (lifecycleStatus === 1) {
        const elsIndicator = document.createElement('sup');
        elsIndicator.className = 'els-indicator';
        elsIndicator.textContent = 'ELS';
        osSpan.appendChild(elsIndicator);
      } else if (lifecycleStatus === 2) {
        const eolIndicator = document.createElement('sup');
        eolIndicator.className = 'eol-indicator';
        eolIndicator.textContent = 'EOL';
        osSpan.appendChild(eolIndicator);
      }
      
      osCell.appendChild(osSpan);
    });
    
    // If no OS value found, display a placeholder
    if (osValues.size === 0) {
      const osSpan = document.createElement('span');
      osSpan.className = 'os-tag os-tag-unknown';
      osSpan.textContent = 'Unknown';
      osCell.appendChild(osSpan);
    }
  }
  
  // Restore edit button
  const editCell = row.cells[COLUMN.ACTIONS];
  editCell.innerHTML = '';
  
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.classList.add('edit-button');
  
  editButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    toggleEditMode(row);
  });
  
  editCell.appendChild(editButton);
  
  // Reset editing state
  isEditing = false;
  currentEditingRow = null;
  
  // Hide reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'none';
  }
  
  // Clear stored original content
  delete row.dataset.originalEnv;
  delete row.dataset.originalRole;
  delete row.dataset.originalOs;
  
  // Show success notification
  showNotification('Server updated successfully', 'success');
}

// Cancel editing
function cancelEditing(row) {
  // Restore original content
  if (row.dataset.originalEnv) {
    row.cells[COLUMN.ENVIRONMENT].innerHTML = row.dataset.originalEnv;
  }
  
  if (row.dataset.originalRole) {
    row.cells[COLUMN.ROLE].innerHTML = row.dataset.originalRole;
  }
  
  // Restore original OS if available
  if (row.dataset.originalOs && row.cells[COLUMN.OS]) {
    row.cells[COLUMN.OS].innerHTML = row.dataset.originalOs;
  }
  
  // Restore edit button
  const editCell = row.cells[COLUMN.ACTIONS];
  editCell.innerHTML = '';
  
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.classList.add('edit-button');
  
  editButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    toggleEditMode(row);
  });
  
  editCell.appendChild(editButton);
  
  // Reset editing state
  isEditing = false;
  currentEditingRow = null;
  
  // Hide reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'none';
  }
  
  // Clear stored original content
  delete row.dataset.originalEnv;
  delete row.dataset.originalRole;
  delete row.dataset.originalOs;
}

// Show notification
function showNotification(message, type) {
  // Create notification if it doesn't exist
  let notification = document.getElementById('server-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'server-notification';
    document.body.appendChild(notification);
  }
  
  // Set notification style based on type
  notification.className = `server-notification server-notification-${type}`;
  
  // Set message and show notification
  notification.textContent = message;
  notification.classList.add('server-show');
  
  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove('server-show');
  }, 3000);
}

// Add editor styles to the document
function addEditorStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .server-control-bar {
      margin-bottom: 10px;
      padding: 10px;
      background-color: var(--rh-color-neutral-light);
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .os-legend {
      display: flex;
      gap: 15px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      font-size: 0.85rem;
    }
    
    .legend-color {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      margin-right: 5px;
    }
    
    .legend-color.supported {
      background-color: #3e8635;
    }
    
    .legend-color.els {
      background-color: #f0ab00;
    }
    
    .legend-color.eol {
      background-color: #c9190b;
    }
    
    .reset-edits-button {
      background-color: #c9190b;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .reset-edits-button:hover {
      background-color: #a30000;
    }
    
    .edit-button {
      background-color: var(--rh-color-primary);
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    
    .edit-button:hover {
      background-color: #004c8c;
    }
    
    .save-button {
      background-color: #3e8635;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      margin-right: 5px;
    }
    
    .save-button:hover {
      background-color: #2d632a;
    }
    
    .cancel-button {
      background-color: #c9190b;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    
    .cancel-button:hover {
      background-color: #a30000;
    }
    
    .edit-cell {
      white-space: nowrap;
    }
    
    .environment-select,
    .role-select,
    .description-input,
    .os-type-select,
    .os-version-select,
    .os-custom-input {
      width: 100%;
      padding: 5px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-family: var(--rh-font-body);
      margin-bottom: 5px;
    }
    
    .os-version-select option.els-option {
      background-color: #fff7e6;
    }
    
    .os-version-select option.eol-option {
      background-color: #fff5f5;
    }
    
    .multi-role-container {
      max-width: 300px;
    }
    
    .role-entry {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 10px;
      background-color: var(--rh-color-neutral-extra-light);
    }
    
    .role-label {
      font-weight: bold;
      margin-bottom: 5px;
      color: var(--rh-color-primary);
    }
    
    .add-role-button {
      background-color: #0066cc;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      margin-bottom: 10px;
    }
    
    .add-role-button:hover {
      background-color: #004080;
    }
    
    .remove-role-button {
      background-color: #c9190b;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      margin-top: 5px;
    }
    
    .remove-role-button:hover {
      background-color: #a30000;
    }
    
    label {
      display: block;
      margin-top: 5px;
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    .os-container {
      margin-bottom: 10px;
    }
    
    /* OS tag styling */
    .os-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: bold;
    }
    
    .os-tag-supported {
      background-color: #3e8635;
      color: white;
    }
    
    .os-tag-els {
      background-color: #f0ab00;
      color: black;
    }
    
    .os-tag-eol {
      background-color: #c9190b;
      color: white;
    }
    
    .os-tag-unknown {
      background-color: #8B8D8F;
      color: white;
    }
    
    .els-indicator,
    .eol-indicator {
      background-color: white;
      padding: 1px 3px;
      border-radius: 2px;
      margin-left: 4px;
      font-weight: bold;
      vertical-align: super;
      font-size: 8px;
    }
    
    .els-indicator {
      color: #f0ab00;
    }
    
    .eol-indicator {
      color: #c9190b;
    }
    
    .server-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    
    .server-notification-success {
      background-color: #3e8635;
    }
    
    .server-notification-error {
      background-color: #c9190b;
    }
    
    .server-notification-info {
      background-color: #0066cc;
    }
    
    .server-show {
      opacity: 1;
    }
    
    .backup-toggle {
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: bold;
      border-radius: 50%;
      text-transform: uppercase;
      color: #fff;
      border: none;
      margin: 0 auto;
    }
    .backup-toggle.yes {
      background-color: #3e8635;
    }
    .backup-toggle.no {
      background-color: #c9190b;
    }
  `;
  document.head.appendChild(style);
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

// Function to update the backup cell to reflect the backup status
function updateBackupCell(backupCell, hasBackup) {
  if (!backupCell) return;
  
  backupCell.innerHTML = '';
  const backupTag = document.createElement('span');
  backupTag.className = hasBackup ? 'tag tag-success' : 'tag tag-danger';
  backupTag.textContent = hasBackup ? 'Y' : 'N';
  backupCell.appendChild(backupTag);
}

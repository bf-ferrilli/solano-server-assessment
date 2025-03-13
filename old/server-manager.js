// server-manager.js - With detailed OS lifecycle information support, row deletion/addition, and backup status

// Global variables 
let serverMappings = null;
let isEditing = false;
let currentEditingRow = null; // Track which row is being edited
let isAddingNewServer = false; // Flag to track whether we're adding a new server

// Set default backup status to false for backward compatibility
const DEFAULT_BACKUP_STATUS = false;

// Define lifecycle status for versions (as of 2025)
const osLifecycleStatus = {
  // RHEL version status
  // Status: 0 = Full/Maintenance Support, 1 = Extended Lifecycle Support (ELS), 2 = End of Life
  'RHEL 9.0': 0, // Full Support
  'RHEL 9.1': 0, // Full Support
  'RHEL 9.2': 0, // Full Support
  'RHEL 9.3': 0, // Full Support
  
  'RHEL 8.0': 2, // EOL (ended mainstream support)
  'RHEL 8.1': 2, // EOL (ended mainstream support)
  'RHEL 8.2': 2, // EOL (ended mainstream support)
  'RHEL 8.3': 2, // EOL (ended mainstream support)
  'RHEL 8.4': 2, // EOL (ended mainstream support)
  'RHEL 8.5': 1, // Maintenance support ended May 2024, now in ELS
  'RHEL 8.6': 1, // Maintenance support ended May 2024, now in ELS
  'RHEL 8.7': 1, // Maintenance support ended May 2024, now in ELS
  'RHEL 8.8': 0, // Still in Maintenance support
  'RHEL 8.9': 0, // Still in Maintenance support
  'RHEL 8.10': 0, // Still in Maintenance support
  
  'RHEL 7.0': 2, // EOL
  'RHEL 7.1': 2, // EOL
  'RHEL 7.2': 2, // EOL 
  'RHEL 7.3': 2, // EOL
  'RHEL 7.4': 2, // EOL
  'RHEL 7.5': 2, // EOL
  'RHEL 7.6': 2, // EOL
  'RHEL 7.7': 2, // EOL
  'RHEL 7.8': 2, // EOL
  'RHEL 7.9': 1, // ELS until June 2028
  
  'RHEL 6.0': 2, // EOL
  'RHEL 6.1': 2, // EOL
  'RHEL 6.2': 2, // EOL
  'RHEL 6.3': 2, // EOL
  'RHEL 6.4': 2, // EOL
  'RHEL 6.5': 2, // EOL
  'RHEL 6.6': 2, // EOL
  'RHEL 6.7': 2, // EOL
  'RHEL 6.8': 2, // EOL
  'RHEL 6.9': 2, // EOL
  'RHEL 6.10': 2, // EOL (ELS ended June 2024)
  
  // Updated Ubuntu versions
  'Ubuntu 18.04': 1, // ESM until April 2028 (was marked EOL)
  'Ubuntu 20.04': 1, // ESM until May 2025 (was marked supported)
  'Ubuntu 22.04': 1, // ESM until April 2027 (was marked supported)
  'Ubuntu 24.04': 0, // Full Support until April 2029
  'Ubuntu 24.10': 0, // Full Support until July 2025
  
  'Oracle Linux 7.9': 0, // Currently supported
  'Oracle Linux 8.0': 2, // EOL
  'Oracle Linux 8.1': 2, // EOL
  'Oracle Linux 8.2': 2, // EOL
  'Oracle Linux 8.3': 2, // EOL
  'Oracle Linux 8.4': 2, // EOL
  'Oracle Linux 8.5': 2, // EOL
  'Oracle Linux 8.6': 1, // Premier Support ending
  'Oracle Linux 8.7': 0, // Currently supported
  'Oracle Linux 8.8': 0, // Currently supported
  'Oracle Linux 8.9': 0, // Currently supported
  'Oracle Linux 9.0': 0, // Currently supported
  'Oracle Linux 9.1': 0, // Currently supported
  'Oracle Linux 9.2': 0, // Currently supported
  'Oracle Linux 9.3': 0, // Currently supported
  
  'Windows Server 2012 R2': 2, // EOL as of October 2023
  'Windows Server 2016': 1, // Extended support until January 2027
  'Windows Server 2019': 0, // Mainstream support until January 2024
  'Windows Server 2022': 0, // Mainstream support until October 2026
};

// Main initialization when the page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeServerManager();
  // Add control buttons at the top of the page
  addControlButtons();
});

// Add control buttons at the top of the page
function addControlButtons() {
  const controlBar = document.createElement('div');
  controlBar.className = 'server-control-bar';
  
  // Add legend for OS status
  const legendContainer = document.createElement('div');
  legendContainer.className = 'os-legend';
  
  const supportedLegend = document.createElement('span');
  supportedLegend.className = 'legend-item';
  supportedLegend.innerHTML = '<span class="legend-color supported"></span> Supported';
  
  const elsLegend = document.createElement('span');
  elsLegend.className = 'legend-item';
  elsLegend.innerHTML = '<span class="legend-color els"></span> Extended Lifecycle Support';
  
  const eolLegend = document.createElement('span');
  eolLegend.className = 'legend-item';
  eolLegend.innerHTML = '<span class="legend-color eol"></span> End of Life';
  
  legendContainer.appendChild(supportedLegend);
  legendContainer.appendChild(elsLegend);
  legendContainer.appendChild(eolLegend);
  
  controlBar.appendChild(legendContainer);
  
  // Create buttons container for the right side of the control bar
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'control-buttons-container';
  
  // Add server button
  const addServerButton = document.createElement('button');
  addServerButton.textContent = 'Add New Server';
  addServerButton.className = 'add-server-button';
  
  addServerButton.addEventListener('click', function() {
    addNewServer();
  });
  
  buttonsContainer.appendChild(addServerButton);
  
  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset All Edits';
  resetButton.className = 'reset-edits-button';
  resetButton.style.display = 'none'; // Hidden by default
  
  resetButton.addEventListener('click', function() {
    resetAllEditing();
  });
  
  buttonsContainer.appendChild(resetButton);
  
  controlBar.appendChild(buttonsContainer);
  
  // Insert at the top of the table
  const table = document.getElementById('serverTable');
  if (table) {
    table.parentNode.insertBefore(controlBar, table);
  }
}

// Reset all editing operations
function resetAllEditing() {
  if (isAddingNewServer) {
    // Remove the new server row if we were adding one
    const newServerRow = document.querySelector('tr.new-server-row');
    if (newServerRow) {
      newServerRow.remove();
    }
    isAddingNewServer = false;
  }
  
  if (currentEditingRow) {
    // Restore original content if available
    if (currentEditingRow.dataset.originalEnv) {
      const envCell = currentEditingRow.cells[1];
      envCell.innerHTML = currentEditingRow.dataset.originalEnv;
    }
    
    if (currentEditingRow.dataset.originalRole) {
      const roleCell = currentEditingRow.cells[2];
      roleCell.innerHTML = currentEditingRow.dataset.originalRole;
    }
    
    // Restore original OS if available
    if (currentEditingRow.dataset.originalOs) {
      const osCell = currentEditingRow.cells[3]; // Assuming OS is in column 4
      osCell.innerHTML = currentEditingRow.dataset.originalOs;
    }
    
    // Restore original backup if available
    if (currentEditingRow.dataset.originalBackup) {
      const backupCell = currentEditingRow.cells[9]; // Backup column
      backupCell.innerHTML = currentEditingRow.dataset.originalBackup;
    }
    
    // Restore edit button
    const editCell = currentEditingRow.cells[10]; // Actions cell (moved from 9 to 10)
    if (editCell) {
      editCell.innerHTML = '';
      
      // Add delete button
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.classList.add('delete-button');
      
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent row toggle
        confirmDeleteServer(currentEditingRow);
      });
      
      editCell.appendChild(deleteButton);
      
      // Add edit button
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.classList.add('edit-button');
      
      editButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent row toggle
        toggleEditMode(currentEditingRow);
      });
      
      editCell.appendChild(editButton);
    }
    
    // Clear stored original content
    delete currentEditingRow.dataset.originalEnv;
    delete currentEditingRow.dataset.originalRole;
    delete currentEditingRow.dataset.originalOs;
    delete currentEditingRow.dataset.originalBackup;
  }
  
  // Reset global state
  isEditing = false;
  currentEditingRow = null;
  
  // Hide reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'none';
  }
  
  showNotification('All editing operations have been reset', 'info');
}

// Initialize all functionality
function initializeServerManager() {
  // Load JSON mappings
  loadServerMappings()
    .then(mappings => {
      if (mappings) {
        serverMappings = mappings;
        console.log('Server mappings loaded successfully');
        
        // Update the existing tags 
        updateExistingTags(serverMappings);
        
        // Setup editing functionality
        setupEditButtons();
        addEditorStyles();
        
        console.log('Server manager initialized successfully');
      }
    })
    .catch(error => {
      console.error('Error initializing server manager:', error.message);
    });
}

// Load server mappings from JSON
async function loadServerMappings() {
  try {
    const response = await fetch('server-mappings.json');
    if (!response.ok) {
      throw new Error('Failed to load server mappings');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading server mappings:', error.message);
    showNotification('Failed to load server mappings', 'error');
    return null;
  }
}

// Update existing tags without changing HTML structure
function updateExistingTags(mappings) {
  try {
    // Get all server rows
    const rows = document.querySelectorAll('#serverTable tbody tr.clickable');
    console.log(`Found ${rows.length} server rows to process`);
    
    let updatedCount = 0;
    
    rows.forEach(row => {
      try {
        // Get the server name from the first cell
        const serverCell = row.cells[0];
        if (!serverCell) return;
        
        const serverName = serverCell.textContent.trim().toLowerCase();
        
        // Find the server in our mappings
        if (mappings.servers[serverName]) {
          const serverInfo = mappings.servers[serverName];
          
          // Handle multiple roles
          const serverRoles = Array.isArray(serverInfo) ? serverInfo : [serverInfo];
          
          // Get the environment, role, and OS cells
          const envCell = row.cells[1];
          const roleCell = row.cells[2];
          const osCell = row.cells[3]; // Assuming OS is in column 4
          
          if (!envCell || !roleCell) {
            return;
          }
          
          // Show all unique environments
          envCell.innerHTML = '';
          const uniqueEnvironments = new Set(serverRoles.map(role => role.environment));
          
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
          
          // Clear the role cell to rebuild all role tags
          roleCell.innerHTML = '';
          
          // Create a tag for each role
          serverRoles.forEach((roleData, index) => {
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
          
          // Update OS cell if it exists
          if (osCell) {
            // Display OS information
            osCell.innerHTML = '';
            
            // Get all unique OS values
            const osValues = new Set();
            serverRoles.forEach(roleData => {
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
          
          // Add backup cell if it doesn't exist
          if (row.cells.length === 9) { // If there are exactly 9 columns (without backup & actions)
            // Create backup cell
            const backupCell = document.createElement('td');
            backupCell.style.textAlign = 'center';
            
            // Check if any role has backup=true
            const hasBackup = serverRoles.some(role => role.backup === true);
            
            // Create backup indicator
            const backupIndicator = document.createElement('span');
            backupIndicator.className = hasBackup ? 'backup-indicator backup-yes' : 'backup-indicator backup-no';
            backupIndicator.textContent = hasBackup ? 'Y' : 'N';
            backupCell.appendChild(backupIndicator);
            
            row.appendChild(backupCell);
          } else if (row.cells.length >= 10) { // Already has backup cell
            // Update existing backup cell
            const backupCell = row.cells[6]; // Backup is at index 9
            backupCell.innerHTML = '';
            
            // Check if any role has backup=true
            const hasBackup = serverRoles.some(role => role.backup === true);
            
            // Create backup indicator
            const backupIndicator = document.createElement('span');
            backupIndicator.className = hasBackup ? 'backup-indicator backup-yes' : 'backup-indicator backup-no';
            backupIndicator.textContent = hasBackup ? 'Y' : 'N';
            backupCell.appendChild(backupIndicator);
          }
          
          updatedCount++;
        }
      } catch (rowError) {
        console.error('Error processing row:', rowError.message);
      }
    });
    
    console.log(`Updated ${updatedCount} server entries successfully`);
  } catch (error) {
    console.error('Error in updateExistingTags:', error.message);
  }
}

// Get lifecycle status for an OS version
function getLifecycleStatus(os) {
  if (osLifecycleStatus.hasOwnProperty(os)) {
    return osLifecycleStatus[os];
  }
  
  // Try to determine status for unknown version
  if (os.startsWith('RHEL') || os.startsWith('Oracle Linux') || os.startsWith('Windows') || os.startsWith('Ubuntu')) {
    // If it's a known OS but we don't have specific version info, assume it's EOL
    return 2;
  }
  
  // Unknown OS, return unknown status
  return -1;
}

// Function to toggle process groups
function toggleGroup(groupId) {
  const group = document.getElementById(groupId);
  if (group) {
    group.classList.toggle('hidden');
  }
}

// ===== ADD NEW SERVER FUNCTIONALITY =====

// Function to add a new server
function addNewServer() {
  // Check if we are already in editing mode
  if (isEditing) {
    const editingServerName = currentEditingRow ? currentEditingRow.cells[0].textContent.trim() : "unknown";
    showNotification(`Please save or cancel your edits to ${editingServerName} first. Or use the Reset All Edits button at the top of the page.`, 'error');
    
    // Show reset button
    const resetButton = document.querySelector('.reset-edits-button');
    if (resetButton) {
      resetButton.style.display = 'block';
    }
    
    return;
  }
  
  // Check if we are already adding a new server
  if (isAddingNewServer) {
    showNotification('You are already adding a new server. Please complete or cancel that operation first.', 'error');
    return;
  }
  
  isAddingNewServer = true;
  
  // Show reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'block';
  }
  
  // Create a new row for the server
  const tbody = document.querySelector('#serverTable tbody');
  if (!tbody) {
    showNotification('Could not find table body to add new server', 'error');
    isAddingNewServer = false;
    return;
  }
  
  const newRow = document.createElement('tr');
  newRow.className = 'clickable new-server-row';
  
  // Server name cell
  const serverNameCell = document.createElement('td');
  const serverNameInput = document.createElement('input');
  serverNameInput.type = 'text';
  serverNameInput.className = 'server-name-input';
  serverNameInput.placeholder = 'Enter server name';
  serverNameInput.required = true;
  serverNameCell.appendChild(serverNameInput);
  newRow.appendChild(serverNameCell);
  
  // Create empty cells for other columns
  for (let i = 1; i < 9; i++) {
    const emptyCell = document.createElement('td');
    if (i === 1) { // Environment cell
      emptyCell.innerHTML = '';
    } else if (i === 2) { // Role cell
      // Create a multi-role editor for the new server
      const defaultRole = {
        environment: 'prod',
        role: '',
        description: '',
        os: '',
        backup: false
      };
      
      const multiRoleContainer = document.createElement('div');
      multiRoleContainer.className = 'multi-role-container';
      
      const roleEditor = createRoleEditor(defaultRole, 0);
      multiRoleContainer.appendChild(roleEditor);
      
      // Add button to add a new role
      const addButton = document.createElement('button');
      addButton.textContent = '+ Add Role';
      addButton.className = 'add-role-button';
      addButton.addEventListener('click', function() {
        // Create a new blank role editor
        const newIndex = multiRoleContainer.querySelectorAll('.role-entry').length;
        const blankRole = { environment: 'prod', role: '', description: '', os: '', backup: false };
        const newRoleEditor = createRoleEditor(blankRole, newIndex);
        
        // Insert before the add button
        multiRoleContainer.insertBefore(newRoleEditor, addButton);
      });
      
      multiRoleContainer.appendChild(addButton);
      emptyCell.appendChild(multiRoleContainer);
    }
    newRow.appendChild(emptyCell);
  }
  
  // Create backup cell
  const backupCell = document.createElement('td');
  backupCell.style.textAlign = 'center';
  backupCell.innerHTML = '<span class="backup-indicator backup-no">N</span>';
  newRow.appendChild(backupCell);
  
  // Create actions cell
  const actionsCell = document.createElement('td');
  actionsCell.className = 'edit-cell';
  
  // Add save button
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.className = 'save-button';
  saveButton.addEventListener('click', function() {
    saveNewServer(newRow);
  });
  
  // Add cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';
  cancelButton.addEventListener('click', function() {
    cancelNewServer(newRow);
  });
  
  actionsCell.appendChild(saveButton);
  actionsCell.appendChild(cancelButton);
  newRow.appendChild(actionsCell);
  
  // Add the new row to the table
  tbody.insertBefore(newRow, tbody.firstChild);
  
  // Focus on the server name input
  serverNameInput.focus();
}

// Function to save a new server
function saveNewServer(row) {
  const serverNameInput = row.querySelector('.server-name-input');
  const serverName = serverNameInput.value.trim().toLowerCase();
  
  // Validate server name
  if (!serverName) {
    showNotification('Server name is required', 'error');
    serverNameInput.focus();
    return;
  }
  
  // Check if server name already exists
  if (serverMappings && serverMappings.servers && serverMappings.servers[serverName]) {
    showNotification(`Server "${serverName}" already exists`, 'error');
    serverNameInput.focus();
    return;
  }
  
  // Collect role information
  const roleEntries = row.querySelectorAll('.role-entry');
  if (roleEntries.length === 0) {
    showNotification('At least one role is required', 'error');
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
    
    // Backup checkbox
    const backupCheckbox = entry.querySelector('.backup-checkbox');
    
    if (!envSelect || !roleSelect) {
      return;
    }
    
    const environment = envSelect.value;
    const role = roleSelect.value;
    const description = descInput ? descInput.value.trim() : '';
    const backup = backupCheckbox ? backupCheckbox.checked : false;
    
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
    if (!environment || !role || role === '_new_') {
      return;
    }
    
    roles.push({
      environment,
      role,
      description,
      os,
      backup
    });
  });
  
  if (roles.length === 0) {
    showNotification('Error: At least one valid role is required', 'error');
    return;
  }
  
  // Update server mapping in JSON
  updateServerMapping(serverName, roles)
    .then(success => {
      if (success) {
        // Convert the temporary row to a standard row
        convertNewRowToNormal(row, serverName, roles);
        
        // Reset adding flag
        isAddingNewServer = false;
        
        // Hide reset button
        const resetButton = document.querySelector('.reset-edits-button');
        if (resetButton) {
          resetButton.style.display = 'none';
        }
        
        showNotification(`Server "${serverName}" added successfully`, 'success');
      }
    });
}

// Function to convert a new row to a normal row after saving
function convertNewRowToNormal(row, serverName, roles) {
  // Remove the new-server-row class
  row.classList.remove('new-server-row');
  
  // Update server name cell
  const serverNameCell = row.cells[0];
  serverNameCell.innerHTML = serverName;
  
  // Update environment cell with tags
  const envCell = row.cells[1];
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
  
  // Update role cell with tags
  const roleCell = row.cells[2];
  roleCell.innerHTML = '';
  
  // Create a tag for each role
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
  
  // Update OS cell with tags
  const osCell = row.cells[3];
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
  
  // Update backup cell
  const backupCell = row.cells[6];
  backupCell.innerHTML = '';
  
  // Check if any role has backup=true
  const hasBackup = roles.some(role => role.backup === true);
  
  // Create backup indicator
  const backupIndicator = document.createElement('span');
  backupIndicator.className = hasBackup ? 'backup-indicator backup-yes' : 'backup-indicator backup-no';
  backupIndicator.textContent = hasBackup ? 'Y' : 'N';
  backupCell.appendChild(backupIndicator);
  
  // Update actions cell with edit and delete buttons
  const actionsCell = row.cells[10];
  actionsCell.innerHTML = '';
  
  // Add delete button
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'delete-button';
  deleteButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    confirmDeleteServer(row);
  });
  
  // Add edit button
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.className = 'edit-button';
  
  editButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    toggleEditMode(row);
  });
  
  actionsCell.appendChild(deleteButton);
  actionsCell.appendChild(editButton);
  
  // Make row toggleable like other server rows
  row.addEventListener('click', function() {
    toggleGroup(serverName + '-details');
  });
}

// Function to cancel adding a new server
function cancelNewServer(row) {
  // Remove the row
  row.remove();
  
  // Reset flag
  isAddingNewServer = false;
  
  // Hide reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'none';
  }
  
  showNotification('Add new server cancelled', 'info');
}

// ===== DELETE SERVER FUNCTIONALITY =====

// Function to confirm deletion of a server
function confirmDeleteServer(row) {
  const serverName = row.cells[0].textContent.trim().toLowerCase();
  
  // Create a modal dialog for confirmation
  const modal = document.createElement('div');
  modal.className = 'delete-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'delete-modal-content';
  
  const modalHeader = document.createElement('h3');
  modalHeader.textContent = 'Confirm Deletion';
  modalContent.appendChild(modalHeader);
  
  const modalMessage = document.createElement('p');
  modalMessage.innerHTML = `Are you sure you want to delete server <strong>${serverName}</strong>?<br>This action cannot be undone.`;
  modalContent.appendChild(modalMessage);
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'delete-modal-buttons';
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-delete-button';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(modal);
  });
  
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Delete Server';
  confirmButton.className = 'confirm-delete-button';
  confirmButton.addEventListener('click', function() {
    document.body.removeChild(modal);
    deleteServer(row, serverName);
  });
  
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);
  modalContent.appendChild(buttonContainer);
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// Function to delete a server
function deleteServer(row, serverName) {
  // Remove the server from serverMappings
  if (serverMappings && serverMappings.servers) {
    delete serverMappings.servers[serverName];
    
    // Also remove from environment applications
    if (serverMappings.environments) {
      Object.values(serverMappings.environments).forEach(env => {
        if (env && env.applications) {
          Object.entries(env.applications).forEach(([roleName, servers]) => {
            if (Array.isArray(servers)) {
              const filteredServers = servers.filter(s => s && s.server !== serverName);
              env.applications[roleName] = filteredServers;
            }
          });
          
          // Clean up empty roles
          Object.keys(env.applications).forEach(roleName => {
            if (env.applications[roleName].length === 0) {
              delete env.applications[roleName];
            }
          });
        }
      });
    }
    
    // Save updated mappings
    saveServerMappings()
      .then(success => {
        if (success) {
          // Remove the row from the table
          row.remove();
          
          // Also remove any associated detail rows if they exist
          const detailRow = document.getElementById(serverName + '-details');
          if (detailRow) {
            detailRow.remove();
          }
          
          showNotification(`Server "${serverName}" deleted successfully`, 'success');
        }
      });
  } else {
    showNotification('Server mappings not loaded or invalid', 'error');
  }
}

// ===== EDITOR FUNCTIONALITY =====

// Add edit and delete buttons to each row
function setupEditButtons() {
  const rows = document.querySelectorAll('#serverTable tbody tr.clickable');
  
  // Check the header to see if we need to add the backup column
  const headerRow = document.querySelector('#serverTable thead tr');
  if (headerRow && headerRow.cells.length === 10) {
    // Backup header already exists in HTML
    const backupHeader = document.createElement('th');
    backupHeader.textContent = 'Backup';
    
    // Add actions header
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'Actions';
    
    // Insert backup header before actions
    //headerRow.appendChild(backupHeader);
    headerRow.appendChild(actionsHeader);
  }
  
  rows.forEach(row => {
    // Add backup column if it doesn't exist
    if (row.cells.length === 9) { // If there are exactly 9 columns (without backup & actions)
      // First add backup cell
      const backupCell = document.createElement('td');
      backupCell.style.textAlign = 'center';
      
      // Get server name to check for backup status
      const serverName = row.cells[0].textContent.trim().toLowerCase();
      
      // Check if this server has backup
      let hasBackup = false;
      if (serverMappings && serverMappings.servers && serverMappings.servers[serverName]) {
        const serverInfo = serverMappings.servers[serverName];
        const serverRoles = Array.isArray(serverInfo) ? serverInfo : [serverInfo];
        
        // Check if any role has backup=true
        hasBackup = serverRoles.some(role => role.backup === true);
      }
      
      // Create backup indicator
      const backupIndicator = document.createElement('span');
      backupIndicator.className = hasBackup ? 'backup-indicator backup-yes' : 'backup-indicator backup-no';
      backupIndicator.textContent = hasBackup ? 'Y' : 'N';
      backupCell.appendChild(backupIndicator);
      
      row.appendChild(backupCell);
    }
    
    // Create edit/delete button column if it doesn't exist
    if (row.cells.length === 10) { // If there are exactly 10 columns (with backup, without actions)
      const actionsCell = document.createElement('td');
      actionsCell.style.width = '120px'; // Wider to accommodate both buttons
      actionsCell.classList.add('edit-cell');
      
      // Add delete button
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.classList.add('delete-button');
      
      deleteButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent row toggle
        confirmDeleteServer(row);
      });
      
      // Add edit button
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.classList.add('edit-button');
      
      editButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent row toggle
        toggleEditMode(row);
      });
      
      actionsCell.appendChild(deleteButton);
      actionsCell.appendChild(editButton);
      row.appendChild(actionsCell);
    }
  });
}

// Toggle edit mode for a row
function toggleEditMode(row) {
  const serverName = row.cells[0].textContent.trim().toLowerCase();
  const envCell = row.cells[1];
  const roleCell = row.cells[2];
  const osCell = row.cells[3]; // Assuming OS is in column 4
  const backupCell = row.cells[6]; // Backup cell
  const actionsCell = row.cells[10]; // The actions cell
  
  if (isEditing) {
    // Check if it's the same row - if so, do nothing
    if (currentEditingRow === row) {
      return;
    }
    
    // Get the server name of the currently editing row
    const editingServerName = currentEditingRow ? currentEditingRow.cells[0].textContent.trim() : "unknown";
    
    // Show error message with information about which row is being edited
    showNotification(`Please save or cancel your edits to ${editingServerName} first. Or use the Reset All Edits button at the top of the page.`, 'error');
    
    // Show reset button
    const resetButton = document.querySelector('.reset-edits-button');
    if (resetButton) {
      resetButton.style.display = 'block';
    }
    
    return;
  }
  
  // Enter edit mode
  isEditing = true;
  currentEditingRow = row;
  
  // Show reset button
  const resetButton = document.querySelector('.reset-edits-button');
  if (resetButton) {
    resetButton.style.display = 'block';
  }
  
  // Store original content for potential cancel
  row.dataset.originalEnv = envCell.innerHTML;
  row.dataset.originalRole = roleCell.innerHTML;
  if (osCell) {
    row.dataset.originalOs = osCell.innerHTML;
  }
  if (backupCell) {
    row.dataset.originalBackup = backupCell.innerHTML;
  }
  
  // Get current server info
  const serverInfo = serverMappings.servers[serverName];
  
  // Handle case when server isn't in the mappings yet
  if (!serverInfo) {
    // Create a default role for new servers
    const defaultRole = {
      environment: 'prod',
      role: '',
      description: '',
      os: '', 
      backup: false
    };
    
    // Create multi-role editor with default role
    createMultiRoleEditor(row, serverName, [defaultRole]);
  } else {
    // Convert to array if it's a single object
    const serverRoles = Array.isArray(serverInfo) ? serverInfo : [serverInfo];
    
    // Filter out any undefined roles just to be safe
    const validRoles = serverRoles.filter(role => role !== undefined);
    
    // If we have no valid roles, provide a default one
    if (validRoles.length === 0) {
      validRoles.push({
        environment: 'prod',
        role: '',
        description: '',
        os: '',
        backup: false
      });
    }
    
    // Make sure each role has a backup property
    validRoles.forEach(role => {
      if (role.backup === undefined) {
        role.backup = false;
      }
    });
    
    // Create multi-role editor
    createMultiRoleEditor(row, serverName, validRoles);
  }
  
  // Replace edit button with save/cancel buttons
  actionsCell.innerHTML = '';
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Save';
  saveButton.classList.add('save-button');
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.classList.add('cancel-button');
  
  saveButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    saveMultiRoleChanges(row, serverName);
  });
  
  cancelButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    cancelEditing(row);
  });
  
  actionsCell.appendChild(saveButton);
  actionsCell.appendChild(cancelButton);
}

// Create a multi-role editor for a server
function createMultiRoleEditor(row, serverName, serverRoles) {
  // Create a container for the multi-role editor
  const multiRoleContainer = document.createElement('div');
  multiRoleContainer.className = 'multi-role-container';
  
  // Ensure serverRoles is an array and contains valid roles
  const validServerRoles = Array.isArray(serverRoles) ? 
    serverRoles.filter(role => role !== undefined) : 
    [];
  
  // If no valid roles, add a default empty one
  if (validServerRoles.length === 0) {
    validServerRoles.push({
      environment: 'prod',
      role: '',
      description: '',
      os: '',
      backup: false
    });
  }
  
  // Create an editor for each role
  validServerRoles.forEach((role, index) => {
    try {
      const roleEditor = createRoleEditor(role, index);
      multiRoleContainer.appendChild(roleEditor);
    } catch (error) {
      console.error(`Error creating role editor for index ${index}:`, error);
      // Create a default role editor as fallback
      const defaultEditor = createRoleEditor({ 
        environment: 'prod', 
        role: '', 
        description: '',
        os: '',
        backup: false
      }, index);
      multiRoleContainer.appendChild(defaultEditor);
    }
  });
  
  // Add button to add a new role
  const addButton = document.createElement('button');
  addButton.textContent = '+ Add Role';
  addButton.className = 'add-role-button';
  addButton.addEventListener('click', function() {
    // Create a new blank role editor
    const newIndex = multiRoleContainer.querySelectorAll('.role-entry').length;
    const blankRole = { environment: 'prod', role: '', description: '', os: '', backup: false };
    const newRoleEditor = createRoleEditor(blankRole, newIndex);
    
    // Insert before the add button
    multiRoleContainer.insertBefore(newRoleEditor, addButton);
  });
  
  multiRoleContainer.appendChild(addButton);
  
  // Replace the role cell content
  const roleCell = row.cells[2];
  roleCell.innerHTML = '';
  roleCell.appendChild(multiRoleContainer);
  
  // Also clear the environment and OS cells since we're handling them per role
  row.cells[1].innerHTML = '';
  if (row.cells[3]) { // Clear OS cell if it exists
    row.cells[3].innerHTML = '';
  }
  
  // Clear backup cell since we're now handling backup per role
  if (row.cells[9]) {
    row.cells[9].innerHTML = '';
  }
}

// Create a role editor for a single role
function createRoleEditor(roleData, index) {
  // Safety check - if roleData is undefined, create a default
  if (!roleData) {
    roleData = {
      environment: 'prod',
      role: '',
      description: '',
      os: '',
      backup: false
    };
    console.warn(`Creating default role data for index ${index} because provided data was undefined`);
  }
  
  // Make sure backup is defined
  if (roleData.backup === undefined) {
    roleData.backup = false;
  }
  
  const roleEntry = document.createElement('div');
  roleEntry.className = 'role-entry';
  roleEntry.dataset.index = index;
  
  // Role number label (only show for multiple roles)
  if (index > 0) {
    const roleLabel = document.createElement('div');
    roleLabel.className = 'role-label';
    roleLabel.textContent = `Role ${index + 1}:`;
    roleEntry.appendChild(roleLabel);
  }
  
  // Environment dropdown
  const envLabel = document.createElement('label');
  envLabel.textContent = 'Environment:';
  roleEntry.appendChild(envLabel);
  
  const envSelect = document.createElement('select');
  envSelect.className = 'environment-select';
  
  const environments = [
    { value: 'prod', text: 'Production' },
    { value: 'pprd', text: 'Pre-Production' },
    { value: 'test', text: 'Test' },
    { value: 'devl', text: 'Development' }
  ];
  
  environments.forEach(env => {
    const option = document.createElement('option');
    option.value = env.value;
    option.textContent = env.text;
    envSelect.appendChild(option);
  });
  
  // Safely set environment value
  const environment = roleData.environment || 'prod';
  envSelect.value = environment;
  roleEntry.appendChild(envSelect);
  
  // Role dropdown
  const roleLabel = document.createElement('label');
  roleLabel.textContent = 'Role:';
  roleEntry.appendChild(roleLabel);
  
  const roleSelect = document.createElement('select');
  roleSelect.className = 'role-select';
  
  // Get all unique roles from server mappings
  const roles = new Set();
  
  if (serverMappings && serverMappings.environments) {
    Object.values(serverMappings.environments).forEach(env => {
      if (env && env.applications) {
        Object.keys(env.applications).forEach(role => {
          roles.add(role);
        });
      }
    });
  }
  
  // Add roles to select
  [...roles].sort().forEach(role => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    roleSelect.appendChild(option);
  });
  
  // Add option to create new role
  const newOption = document.createElement('option');
  newOption.value = '_new_';
  newOption.textContent = '-- Create New Role --';
  roleSelect.appendChild(newOption);
  
  // Get the role safely
  const role = roleData.role || '';
  
  // Set current value or add it if it doesn't exist
  if (roles.has(role)) {
    roleSelect.value = role;
  } else if (role) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    roleSelect.insertBefore(option, newOption);
    roleSelect.value = role;
  }
  
  // Add event listener for new role creation
  roleSelect.addEventListener('change', function() {
    if (this.value === '_new_') {
      const newRole = prompt('Enter new role name:');
      if (newRole && newRole.trim()) {
        // Add new option
        const option = document.createElement('option');
        option.value = newRole.trim();
        option.textContent = newRole.trim();
        
        // Insert before the "Create New" option
        roleSelect.insertBefore(option, newOption);
        roleSelect.value = newRole.trim();
      } else {
        // Reset to previous selection
        roleSelect.value = roleData.role || '';
      }
    }
  });
  
  roleEntry.appendChild(roleSelect);
  
  // Description input
  const descLabel = document.createElement('label');
  descLabel.textContent = 'Description:';
  roleEntry.appendChild(descLabel);
  
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'description-input';
  descInput.placeholder = 'Description (optional)';
  descInput.value = roleData.description || '';
  roleEntry.appendChild(descInput);
  
  // OS Selection with two-step process
  const osLabel = document.createElement('label');
  osLabel.textContent = 'Operating System:';
  roleEntry.appendChild(osLabel);
  
  // Create OS type and version selection
  const osContainer = document.createElement('div');
  osContainer.className = 'os-container';
  
  // Create OS Type dropdown
  const osTypeSelect = document.createElement('select');
  osTypeSelect.className = 'os-type-select';
  
  const osTypes = [
    { value: '', text: '-- Select OS Type --' },
    { value: 'rhel', text: 'Red Hat Enterprise Linux' },
    { value: 'ubuntu', text: 'Ubuntu Linux' },
    { value: 'oraclelinux', text: 'Oracle Linux' },
    { value: 'windows', text: 'Windows Server' },
    { value: 'other', text: 'Other OS' }
  ];
  
  osTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type.value;
    option.textContent = type.text;
    osTypeSelect.appendChild(option);
  });
  
  osContainer.appendChild(osTypeSelect);
  
  // Create the version select (initially hidden, will be populated based on type)
  const osVersionSelect = document.createElement('select');
  osVersionSelect.className = 'os-version-select';
  osVersionSelect.style.display = 'none';
  osVersionSelect.style.marginTop = '5px';
  osContainer.appendChild(osVersionSelect);
  
  // Custom OS input for "Other" option
  const osCustomInput = document.createElement('input');
  osCustomInput.type = 'text';
  osCustomInput.className = 'os-custom-input';
  osCustomInput.placeholder = 'Enter custom OS';
  osCustomInput.style.display = 'none';
  osCustomInput.style.marginTop = '5px';
  osContainer.appendChild(osCustomInput);
  
  roleEntry.appendChild(osContainer);
  
  // Add backup checkbox
  const backupLabel = document.createElement('label');
  backupLabel.textContent = 'Backup Required:';
  backupLabel.style.marginTop = '10px';
  roleEntry.appendChild(backupLabel);
  
  const backupContainer = document.createElement('div');
  backupContainer.className = 'backup-container';
  
  const backupCheckbox = document.createElement('input');
  backupCheckbox.type = 'checkbox';
  backupCheckbox.className = 'backup-checkbox';
  backupCheckbox.checked = roleData.backup === true;
  backupContainer.appendChild(backupCheckbox);
  
  const backupText = document.createElement('span');
  backupText.textContent = 'Yes, backup is required';
  backupText.className = 'backup-text';
  backupContainer.appendChild(backupText);
  
  roleEntry.appendChild(backupContainer);
  
  // Process the existing OS value to determine the type and version
  const existingOs = roleData.os || '';
  if (existingOs) {
    if (existingOs.startsWith('RHEL')) {
      osTypeSelect.value = 'rhel';
      populateVersionSelect(osVersionSelect, 'rhel');
      osVersionSelect.style.display = 'block';
      
      // Try to match the existing version
      const versionOptions = Array.from(osVersionSelect.options);
      const matchingOption = versionOptions.find(option => option.value === existingOs);
      if (matchingOption) {
        osVersionSelect.value = existingOs;
      } else {
        // If no match, default to custom
        osTypeSelect.value = 'other';
        osCustomInput.style.display = 'block';
        osVersionSelect.style.display = 'none';
        osCustomInput.value = existingOs;
      }
    } else if (existingOs.startsWith('Ubuntu')) {
      osTypeSelect.value = 'ubuntu';
      populateVersionSelect(osVersionSelect, 'ubuntu');
      osVersionSelect.style.display = 'block';
      
      // Try to match the existing version
      const versionOptions = Array.from(osVersionSelect.options);
      const matchingOption = versionOptions.find(option => option.value === existingOs);
      if (matchingOption) {
        osVersionSelect.value = existingOs;
      } else {
        // If no match, default to custom
        osTypeSelect.value = 'other';
        osCustomInput.style.display = 'block';
        osVersionSelect.style.display = 'none';
        osCustomInput.value = existingOs;
      }
    } else if (existingOs.startsWith('Oracle Linux')) {
      osTypeSelect.value = 'oraclelinux';
      populateVersionSelect(osVersionSelect, 'oraclelinux');
      osVersionSelect.style.display = 'block';
      
      // Try to match the existing version
      const versionOptions = Array.from(osVersionSelect.options);
      const matchingOption = versionOptions.find(option => option.value === existingOs);
      if (matchingOption) {
        osVersionSelect.value = existingOs;
      } else {
        // If no match, default to custom
        osTypeSelect.value = 'other';
        osCustomInput.style.display = 'block';
        osVersionSelect.style.display = 'none';
        osCustomInput.value = existingOs;
      }
    } else if (existingOs.startsWith('Windows')) {
      osTypeSelect.value = 'windows';
      populateVersionSelect(osVersionSelect, 'windows');
      osVersionSelect.style.display = 'block';
      
      // Try to match the existing version
      const versionOptions = Array.from(osVersionSelect.options);
      const matchingOption = versionOptions.find(option => option.value === existingOs);
      if (matchingOption) {
        osVersionSelect.value = existingOs;
      } else {
        // If no match, default to custom
        osTypeSelect.value = 'other';
        osCustomInput.style.display = 'block';
        osVersionSelect.style.display = 'none';
        osCustomInput.value = existingOs;
      }
    } else {
      // Default to "other" for any other OS
      osTypeSelect.value = 'other';
      osCustomInput.style.display = 'block';
      osCustomInput.value = existingOs;
    }
  }
  
  // Add event listener to OS type select
  osTypeSelect.addEventListener('change', function() {
    if (this.value === 'other') {
      osVersionSelect.style.display = 'none';
      osCustomInput.style.display = 'block';
      osCustomInput.focus();
    } else if (this.value === '') {
      osVersionSelect.style.display = 'none';
      osCustomInput.style.display = 'none';
    } else {
      populateVersionSelect(osVersionSelect, this.value);
      osVersionSelect.style.display = 'block';
      osCustomInput.style.display = 'none';
    }
  });
  
  // Add a remove button for roles beyond the first one
  if (index > 0) {
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'remove-role-button';
    removeButton.addEventListener('click', function() {
      roleEntry.remove();
    });
    roleEntry.appendChild(removeButton);
  }
  
  return roleEntry;
}

// Function to populate OS version select based on OS type
function populateVersionSelect(select, osType) {
  // Clear existing options
  select.innerHTML = '';
  
  // Add a default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Select Version --';
  select.appendChild(defaultOption);
  
  // Helper function to add version option with lifecycle status
  function addVersionOption(version, displayText, status) {
    const option = document.createElement('option');
    option.value = version;
    
    // Add lifecycle status indicator if applicable
    if (status === 1) { // ELS
      option.textContent = `${displayText} (ELS)`;
    } else if (status === 2) { // EOL
      option.textContent = `${displayText} (EOL)`;
    } else {
      option.textContent = displayText;
    }
    
    // Add class based on status for styling
    if (status === 1) {
      option.className = 'els-option';
    } else if (status === 2) {
      option.className = 'eol-option';
    }
    
    select.appendChild(option);
  }
  
  // Add options based on OS type
  switch (osType) {
    case 'rhel':
      // RHEL 9 versions
      addVersionOption('RHEL 9.3', 'RHEL 9.3', osLifecycleStatus['RHEL 9.3']);
      addVersionOption('RHEL 9.2', 'RHEL 9.2', osLifecycleStatus['RHEL 9.2']);
      addVersionOption('RHEL 9.1', 'RHEL 9.1', osLifecycleStatus['RHEL 9.1']);
      addVersionOption('RHEL 9.0', 'RHEL 9.0', osLifecycleStatus['RHEL 9.0']);
      
      // Add separator
      const separator1 = document.createElement('option');
      separator1.disabled = true;
      separator1.textContent = '──────────────';
      select.appendChild(separator1);
      
      // RHEL 8 versions
      addVersionOption('RHEL 8.10', 'RHEL 8.10', osLifecycleStatus['RHEL 8.10']);
      addVersionOption('RHEL 8.9', 'RHEL 8.9', osLifecycleStatus['RHEL 8.9']);
      addVersionOption('RHEL 8.8', 'RHEL 8.8', osLifecycleStatus['RHEL 8.8']);
      addVersionOption('RHEL 8.7', 'RHEL 8.7', osLifecycleStatus['RHEL 8.7']);
      addVersionOption('RHEL 8.6', 'RHEL 8.6', osLifecycleStatus['RHEL 8.6']);
      addVersionOption('RHEL 8.5', 'RHEL 8.5', osLifecycleStatus['RHEL 8.5']);
      addVersionOption('RHEL 8.4', 'RHEL 8.4', osLifecycleStatus['RHEL 8.4']);
      addVersionOption('RHEL 8.3', 'RHEL 8.3', osLifecycleStatus['RHEL 8.3']);
      addVersionOption('RHEL 8.2', 'RHEL 8.2', osLifecycleStatus['RHEL 8.2']);
      addVersionOption('RHEL 8.1', 'RHEL 8.1', osLifecycleStatus['RHEL 8.1']);
      addVersionOption('RHEL 8.0', 'RHEL 8.0', osLifecycleStatus['RHEL 8.0']);
      
      // Add separator
      const separator2 = document.createElement('option');
      separator2.disabled = true;
      separator2.textContent = '──────────────';
      select.appendChild(separator2);
      
      // RHEL 7 versions
      addVersionOption('RHEL 7.9', 'RHEL 7.9', osLifecycleStatus['RHEL 7.9']);
      addVersionOption('RHEL 7.8', 'RHEL 7.8', osLifecycleStatus['RHEL 7.8']);
      addVersionOption('RHEL 7.7', 'RHEL 7.7', osLifecycleStatus['RHEL 7.7']);
      addVersionOption('RHEL 7.6', 'RHEL 7.6', osLifecycleStatus['RHEL 7.6']);
      addVersionOption('RHEL 7.5', 'RHEL 7.5', osLifecycleStatus['RHEL 7.5']);
      addVersionOption('RHEL 7.4', 'RHEL 7.4', osLifecycleStatus['RHEL 7.4']);
      addVersionOption('RHEL 7.3', 'RHEL 7.3', osLifecycleStatus['RHEL 7.3']);
      addVersionOption('RHEL 7.2', 'RHEL 7.2', osLifecycleStatus['RHEL 7.2']);
      addVersionOption('RHEL 7.1', 'RHEL 7.1', osLifecycleStatus['RHEL 7.1']);
      addVersionOption('RHEL 7.0', 'RHEL 7.0', osLifecycleStatus['RHEL 7.0']);
      
      // Add separator
      const separator3 = document.createElement('option');
      separator3.disabled = true;
      separator3.textContent = '──────────────';
      select.appendChild(separator3);
      
      // RHEL 6 versions
      addVersionOption('RHEL 6.10', 'RHEL 6.10', osLifecycleStatus['RHEL 6.10']);
      addVersionOption('RHEL 6.9', 'RHEL 6.9', osLifecycleStatus['RHEL 6.9']);
      addVersionOption('RHEL 6.8', 'RHEL 6.8', osLifecycleStatus['RHEL 6.8']);
      addVersionOption('RHEL 6.7', 'RHEL 6.7', osLifecycleStatus['RHEL 6.7']);
      addVersionOption('RHEL 6.6', 'RHEL 6.6', osLifecycleStatus['RHEL 6.6']);
      addVersionOption('RHEL 6.5', 'RHEL 6.5', osLifecycleStatus['RHEL 6.5']);
      addVersionOption('RHEL 6.4', 'RHEL 6.4', osLifecycleStatus['RHEL 6.4']);
      addVersionOption('RHEL 6.3', 'RHEL 6.3', osLifecycleStatus['RHEL 6.3']);
      addVersionOption('RHEL 6.2', 'RHEL 6.2', osLifecycleStatus['RHEL 6.2']);
      addVersionOption('RHEL 6.1', 'RHEL 6.1', osLifecycleStatus['RHEL 6.1']);
      addVersionOption('RHEL 6.0', 'RHEL 6.0', osLifecycleStatus['RHEL 6.0']);
      break;
      
    case 'ubuntu':
      addVersionOption('Ubuntu 24.04', 'Ubuntu 24.04 LTS', osLifecycleStatus['Ubuntu 24.04']);
      addVersionOption('Ubuntu 22.04', 'Ubuntu 22.04 LTS', osLifecycleStatus['Ubuntu 22.04']);
      addVersionOption('Ubuntu 20.04', 'Ubuntu 20.04 LTS', osLifecycleStatus['Ubuntu 20.04']);
      addVersionOption('Ubuntu 18.04', 'Ubuntu 18.04 LTS', osLifecycleStatus['Ubuntu 18.04']);
      break;
      
    case 'oraclelinux':
      // Oracle Linux 9 versions
      addVersionOption('Oracle Linux 9.3', 'Oracle Linux 9.3', osLifecycleStatus['Oracle Linux 9.3']);
      addVersionOption('Oracle Linux 9.2', 'Oracle Linux 9.2', osLifecycleStatus['Oracle Linux 9.2']);
      addVersionOption('Oracle Linux 9.1', 'Oracle Linux 9.1', osLifecycleStatus['Oracle Linux 9.1']);
      addVersionOption('Oracle Linux 9.0', 'Oracle Linux 9.0', osLifecycleStatus['Oracle Linux 9.0']);
      
      // Add separator
      const olSeparator = document.createElement('option');
      olSeparator.disabled = true;
      olSeparator.textContent = '──────────────';
      select.appendChild(olSeparator);
      
      // Oracle Linux 8 versions
      addVersionOption('Oracle Linux 8.9', 'Oracle Linux 8.9', osLifecycleStatus['Oracle Linux 8.9']);
      addVersionOption('Oracle Linux 8.8', 'Oracle Linux 8.8', osLifecycleStatus['Oracle Linux 8.8']);
      addVersionOption('Oracle Linux 8.7', 'Oracle Linux 8.7', osLifecycleStatus['Oracle Linux 8.7']);
      addVersionOption('Oracle Linux 8.6', 'Oracle Linux 8.6', osLifecycleStatus['Oracle Linux 8.6']);
      addVersionOption('Oracle Linux 8.5', 'Oracle Linux 8.5', osLifecycleStatus['Oracle Linux 8.5']);
      addVersionOption('Oracle Linux 8.4', 'Oracle Linux 8.4', osLifecycleStatus['Oracle Linux 8.4']);
      addVersionOption('Oracle Linux 8.3', 'Oracle Linux 8.3', osLifecycleStatus['Oracle Linux 8.3']);
      addVersionOption('Oracle Linux 8.2', 'Oracle Linux 8.2', osLifecycleStatus['Oracle Linux 8.2']);
      addVersionOption('Oracle Linux 8.1', 'Oracle Linux 8.1', osLifecycleStatus['Oracle Linux 8.1']);
      addVersionOption('Oracle Linux 8.0', 'Oracle Linux 8.0', osLifecycleStatus['Oracle Linux 8.0']);
      
      // Add separator
      const olSeparator2 = document.createElement('option');
      olSeparator2.disabled = true;
      olSeparator2.textContent = '──────────────';
      select.appendChild(olSeparator2);
      
      // Oracle Linux 7 versions
      addVersionOption('Oracle Linux 7.9', 'Oracle Linux 7.9', osLifecycleStatus['Oracle Linux 7.9']);
      break;
      
    case 'windows':
      addVersionOption('Windows Server 2022', 'Windows Server 2022', osLifecycleStatus['Windows Server 2022']);
      addVersionOption('Windows Server 2019', 'Windows Server 2019', osLifecycleStatus['Windows Server 2019']);
      addVersionOption('Windows Server 2016', 'Windows Server 2016', osLifecycleStatus['Windows Server 2016']);
      addVersionOption('Windows Server 2012 R2', 'Windows Server 2012 R2', osLifecycleStatus['Windows Server 2012 R2']);
      break;
  }
}

// Save changes for multiple roles
function saveMultiRoleChanges(row, serverName) {
  // Collect all role entries
  const roleEntries = row.cells[2].querySelectorAll('.role-entry');
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
    
    // Backup checkbox
    const backupCheckbox = entry.querySelector('.backup-checkbox');
    
    if (!envSelect || !roleSelect) {
      return;
    }
    
    const environment = envSelect.value;
    const role = roleSelect.value;
    const description = descInput ? descInput.value.trim() : '';
    const backup = backupCheckbox ? backupCheckbox.checked : false;
    
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
    if (!environment || !role || role === '_new_') {
      return;
    }
    
    roles.push({
      environment,
      role,
      description,
      os,
      backup
    });
  });
  
  if (roles.length === 0) {
    showNotification('Error: At least one valid role is required', 'error');
    return;
  }
  
  // Update server mapping in JSON
  updateServerMapping(serverName, roles)
    .then(success => {
      if (success) {
        // Exit edit mode and update UI
        exitEditMode(row, roles);
      }
    });
}

// Update server mapping for multiple roles
async function updateServerMapping(serverName, roles) {
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
      role.role.trim() !== '' &&
      role.role !== '_new_'
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
      const { environment, role, description, os, backup } = roleData;
      
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
        os: os || '',
        backup: backup || false
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
  const envCell = row.cells[1];
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
  const roleCell = row.cells[2];
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
  const osCell = row.cells[3];
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
  
  // Update backup cell
  const backupCell = row.cells[6];
  backupCell.innerHTML = '';
  
  // Check if any role has backup=true
  const hasBackup = roles.some(role => role.backup === true);
  
  // Create backup indicator
  const backupIndicator = document.createElement('span');
  backupIndicator.className = hasBackup ? 'backup-indicator backup-yes' : 'backup-indicator backup-no';
  backupIndicator.textContent = hasBackup ? 'Y' : 'N';
  backupCell.appendChild(backupIndicator);
  
  // Restore edit and delete buttons
  const actionsCell = row.cells[10];
  actionsCell.innerHTML = '';
  
  // Add delete button
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'delete-button';
  
  deleteButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    confirmDeleteServer(row);
  });
  
  // Add edit button
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.className = 'edit-button';
  
  editButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    toggleEditMode(row);
  });
  
  actionsCell.appendChild(deleteButton);
  actionsCell.appendChild(editButton);
  
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
  delete row.dataset.originalBackup;
  
  // Show success notification
  showNotification('Server updated successfully', 'success');
}

// Cancel editing
function cancelEditing(row) {
  // Restore original content
  if (row.dataset.originalEnv) {
    row.cells[1].innerHTML = row.dataset.originalEnv;
  }
  
  if (row.dataset.originalRole) {
    row.cells[2].innerHTML = row.dataset.originalRole;
  }
  
  // Restore original OS if available
  if (row.dataset.originalOs && row.cells[3]) {
    row.cells[3].innerHTML = row.dataset.originalOs;
  }
  
  // Restore original backup if available
  if (row.dataset.originalBackup && row.cells[6]) {
    row.cells[6].innerHTML = row.dataset.originalBackup;
  }
  
  // Restore edit button
  const actionsCell = row.cells[10];
  actionsCell.innerHTML = '';
  
  // Add delete button
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'delete-button';
  
  deleteButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    confirmDeleteServer(row);
  });
  
  // Add edit button
  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.className = 'edit-button';
  
  editButton.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent row toggle
    toggleEditMode(row);
  });
  
  actionsCell.appendChild(deleteButton);
  actionsCell.appendChild(editButton);
  
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
  delete row.dataset.originalBackup;
  
  showNotification('Edit cancelled', 'info');
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

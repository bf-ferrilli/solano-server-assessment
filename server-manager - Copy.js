// server-manager.js - With detailed OS lifecycle information support

// Global variables 
let serverMappings = null;
let isEditing = false;
let currentEditingRow = null; // Track which row is being edited

// Define column indices to ensure consistency
const COLUMN = {
  HOSTNAME: 0,
  ENVIRONMENT: 1,
  ROLE: 2,
  OS: 3,
  CPU: 4,
  MEMORY: 5,
  BACKUP: 6,
  FIREWALL: 7,
  INTERNAL_IP: 8,
  EXTERNAL_IP: 9,
  ACTIONS: 10
};

// Default backup status if not defined
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
  console.log('DOM loaded, initializing server manager');
  initializeServerManager();
  // Add reset button to the top of the page
  addResetEditButton();
});

// Add a reset edit button at the top of the page
function addResetEditButton() {
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
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset All Edits';
  resetButton.className = 'reset-edits-button';
  resetButton.style.display = 'none'; // Hidden by default
  
  resetButton.addEventListener('click', function() {
    resetAllEditing();
  });
  
  controlBar.appendChild(resetButton);
  
  // Insert at the top of the table
  const table = document.getElementById('serverTable');
  if (table) {
    table.parentNode.insertBefore(controlBar, table);
  }
}

// Reset all editing operations
function resetAllEditing() {
  if (currentEditingRow) {
    // Restore original content if available
    if (currentEditingRow.dataset.originalEnv) {
      const envCell = currentEditingRow.cells[COLUMN.ENVIRONMENT];
      envCell.innerHTML = currentEditingRow.dataset.originalEnv;
    }
    
    if (currentEditingRow.dataset.originalRole) {
      const roleCell = currentEditingRow.cells[COLUMN.ROLE];
      roleCell.innerHTML = currentEditingRow.dataset.originalRole;
    }
    
    // Restore original OS if available
    if (currentEditingRow.dataset.originalOs) {
      const osCell = currentEditingRow.cells[COLUMN.OS];
      osCell.innerHTML = currentEditingRow.dataset.originalOs;
    }
    
    // Restore edit button
    const editCell = currentEditingRow.cells[COLUMN.ACTIONS];
    if (editCell) {
      editCell.innerHTML = '';
      
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
        
        // Ensure table structure is correct
        ensureTableStructure();
        
        // Update the existing tags 
        updateExistingTags(serverMappings);
        
        // Setup backup columns
        setupBackupColumns();
        
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

// Ensure table has correct structure
function ensureTableStructure() {
  // Ensure header has all required columns
  const headerRow = document.querySelector('#serverTable thead tr');
  if (headerRow) {
    // Make sure we have 10 columns (before adding Actions)
    if (headerRow.cells.length < 10) {
      console.warn(`Header row has only ${headerRow.cells.length} columns, expected 10`);
      
      // Add missing columns to header
      for (let i = headerRow.cells.length; i < 10; i++) {
        const th = document.createElement('th');
        th.textContent = getColumnName(i);
        headerRow.appendChild(th);
      }
    }
    
    // Add Actions column if needed
    if (headerRow.cells.length === 10) {
      const actionsHeader = document.createElement('th');
      actionsHeader.textContent = 'Actions';
      headerRow.appendChild(actionsHeader);
    }
  }
  
  // Ensure all data rows have correct number of cells
  const rows = document.querySelectorAll('#serverTable tbody tr.clickable');
  rows.forEach(row => {
    // Make sure each row has 10 columns (before adding Actions)
    if (row.cells.length < 10) {
      console.warn(`Row for ${row.cells[0]?.textContent || 'unknown'} has only ${row.cells.length} columns, expected 10`);
      
      // Add missing cells
      for (let i = row.cells.length; i < 10; i++) {
        const td = document.createElement('td');
        row.appendChild(td);
      }
    }
  });
}

// Helper to get column name
function getColumnName(index) {
  switch(index) {
    case COLUMN.HOSTNAME: return 'Hostname';
    case COLUMN.ENVIRONMENT: return 'Environment';
    case COLUMN.ROLE: return 'Role';
    case COLUMN.OS: return 'OS';
    case COLUMN.CPU: return 'CPU';
    case COLUMN.MEMORY: return 'Memory (GB)';
    case COLUMN.BACKUP: return 'Backup';
    case COLUMN.FIREWALL: return 'Firewall';
    case COLUMN.INTERNAL_IP: return 'Internal IP';
    case COLUMN.EXTERNAL_IP: return 'External IP';
    case COLUMN.ACTIONS: return 'Actions';
    default: return `Column ${index}`;
  }
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
        const serverCell = row.cells[COLUMN.HOSTNAME];
        if (!serverCell) return;
        
        const serverName = serverCell.textContent.trim().toLowerCase();
        
        // Find the server in our mappings
        if (mappings.servers[serverName]) {
          const serverInfo = mappings.servers[serverName];
          
          // Handle multiple roles
          const serverRoles = Array.isArray(serverInfo) ? serverInfo : [serverInfo];
          
          // Get the environment, role, and OS cells
          const envCell = row.cells[COLUMN.ENVIRONMENT];
          const roleCell = row.cells[COLUMN.ROLE];
          const osCell = row.cells[COLUMN.OS];
          
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

// Function to set up backup columns
function setupBackupColumns() {
  console.log('Setting up backup columns...');
  
  // Get all server rows
  const rows = document.querySelectorAll('#serverTable tbody tr.clickable');
  
  rows.forEach(row => {
    // Get the server name from the first cell
    const serverCell = row.cells[COLUMN.HOSTNAME];
    if (!serverCell) return;
    
    const serverName = serverCell.textContent.trim().toLowerCase();
    
    // Find the backup cell
    const backupCell = row.cells[COLUMN.BACKUP];
    if (!backupCell) {
      console.warn(`No backup cell found for server ${serverName}`);
      return;
    }
    
    // Clear any existing content
    backupCell.innerHTML = '';
    
    // Get backup status from server mappings
    let backupStatus = false;
    
    if (serverMappings && serverMappings.servers && serverMappings.servers[serverName]) {
      const serverInfo = serverMappings.servers[serverName];
      
      if (Array.isArray(serverInfo)) {
        // If multiple roles, use the first one's backup status (or default to false)
        backupStatus = serverInfo[0]?.backup === true;
      } else {
        // If single role, use its backup status
        backupStatus = serverInfo.backup === true;
      }
    }
    
    // Create toggle button with correct styling
    const backupTag = document.createElement('span');
    backupTag.className = backupStatus ? 'tag tag-success' : 'tag tag-danger';
    backupTag.textContent = backupStatus ? 'Y' : 'N';
    backupTag.dataset.value = backupStatus.toString();
    backupTag.style.cursor = 'pointer';
    
    // Add click event to toggle backup status
    backupTag.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent row toggle
      toggleBackupStatus(e, serverName);
    });
    
    // Add to cell
    backupCell.appendChild(backupTag);
  });
  
  console.log('Backup columns setup complete');
}

// Function to toggle backup status
function toggleBackupStatus(event, serverName) {
  const tag = event.currentTarget;
  const currentValue = tag.dataset.value === 'true';
  const newValue = !currentValue;
  
  console.log(`Toggling backup for ${serverName}: ${currentValue} → ${newValue}`);
  
  // Update tag appearance
  tag.dataset.value = newValue.toString();
  tag.textContent = newValue ? 'Y' : 'N';
  tag.className = newValue ? 'tag tag-success' : 'tag tag-danger';
  
  // Update server mappings
  if (serverMappings && serverMappings.servers && serverMappings.servers[serverName]) {
    const serverInfo = serverMappings.servers[serverName];
    
    if (Array.isArray(serverInfo)) {
      // Update backup status for all roles
      serverInfo.forEach(role => {
        if (role) role.backup = newValue;
      });
    } else {
      // Update backup status for single role
      serverInfo.backup = newValue;
    }
    
    // Save changes to server
    saveServerMappings()
      .then(success => {
        if (success) {
          showNotification(`Backup status for ${serverName} updated to ${newValue ? 'Y' : 'N'}`, 'success');
        }
      })
      .catch(error => {
        console.error('Error saving backup status:', error);
        // Revert tag to previous state on error
        tag.dataset.value = currentValue.toString();
        tag.textContent = currentValue ? 'Y' : 'N';
        tag.className = currentValue ? 'tag tag-success' : 'tag tag-danger';
        
        showNotification('Failed to update backup status', 'error');
      });
  }
}

// ===== EDITOR FUNCTIONALITY =====

// Add edit buttons to each row
function setupEditButtons() {
  const rows = document.querySelectorAll('#serverTable tbody tr.clickable');
  
  rows.forEach(row => {
    // Ensure the row has 11 cells (10 data columns + 1 for actions)
    while (row.cells.length < 11) {
      const td = document.createElement('td');
      row.appendChild(td);
    }
    
    // Setup the action column (last column)
    const editCell = row.cells[COLUMN.ACTIONS];
    editCell.style.width = '80px';
    editCell.classList.add('edit-cell');
    editCell.innerHTML = ''; // Clear any existing content
    
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.classList.add('edit-button');
    
    editButton.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent row toggle
      toggleEditMode(row);
    });
    
    editCell.appendChild(editButton);
  });
  
  // Update the header row to match
  const headerRow = document.querySelector('#serverTable thead tr');
  if (headerRow) {
    // Ensure we have 11 header cells (10 data columns + actions)
    while (headerRow.cells.length < 11) {
      const th = document.createElement('th');
      // Set the header text based on the index
      const index = headerRow.cells.length;
      th.textContent = getColumnName(index);
      headerRow.appendChild(th);
    }
    
    // Make sure the last column is labeled "Actions"
    headerRow.cells[COLUMN.ACTIONS].textContent = 'Actions';
  }
}

// Toggle edit mode for a row
function toggleEditMode(row) {
  const serverName = row.cells[COLUMN.HOSTNAME].textContent.trim().toLowerCase();
  const envCell = row.cells[COLUMN.ENVIRONMENT];
  const roleCell = row.cells[COLUMN.ROLE];
  const osCell = row.cells[COLUMN.OS];
  const editCell = row.cells[COLUMN.ACTIONS];
  
  if (isEditing) {
    // Check if it's the same row - if so, do nothing
    if (currentEditingRow === row) {
      return;
    }
    
    // Get the server name of the currently editing row
    const editingServerName = currentEditingRow ? currentEditingRow.cells[COLUMN.HOSTNAME].textContent.trim() : "unknown";
    
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
  
  // Get current server info
  const serverInfo = serverMappings.servers[serverName];
  
  // Handle case when server isn't in the mappings yet
  if (!serverInfo) {
    // Create a default role for new servers
    const defaultRole = {
      environment: 'prod',
      role: '',
      description: '',
      os: '', // Add default OS field
      backup: DEFAULT_BACKUP_STATUS // Default backup status
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
        os: '', // Add default OS field
        backup: DEFAULT_BACKUP_STATUS // Default backup status
      });
    }
    
    // Create multi-role editor
    createMultiRoleEditor(row, serverName, validRoles);
  }
  
  // Replace edit button with save/cancel buttons
  editCell.innerHTML = '';
  
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
  
  editCell.appendChild(saveButton);
  editCell.appendChild(cancelButton);
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
      os: '', // Add default OS field
      backup: DEFAULT_BACKUP_STATUS // Default backup status
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
        os: '', // Add default OS field
        backup: DEFAULT_BACKUP_STATUS // Default backup status
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
    const blankRole = { environment: 'prod', role: '', description: '', os: '' };
    const newRoleEditor = createRoleEditor(blankRole, newIndex);
    
    // Insert before the add button
    multiRoleContainer.insertBefore(newRoleEditor, addButton);
  });
  
  multiRoleContainer.appendChild(addButton);
  
  // Replace the role cell content
  const roleCell = row.cells[COLUMN.ROLE];
  roleCell.innerHTML = '';
  roleCell.appendChild(multiRoleContainer);
  
  // Also clear the environment and OS cells since we're handling them per role
  row.cells[COLUMN.ENVIRONMENT].innerHTML = '';
  row.cells[COLUMN.OS].innerHTML = '';
}

// Create a role editor for a single role
function createRoleEditor(roleData, index) {
  // Safety check - if roleData is undefined, create a default
  if (!roleData) {
    roleData = {
      environment: 'prod',
      role: '',
      description: '',
      os: '', // Add default OS field
      backup: DEFAULT_BACKUP_STATUS // Default backup status
    };
    console.warn(`Creating default role data for index ${index} because provided data was undefined`);
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

const osLifecycleCache = {};

// Configuration for Extended Lifecycle Support (ELS)
// Only needed for RHEL 7 as RHEL 8 and 9 follow major version lifecycle
const rhel7ElsEnabled = true; // Set to true if customer has purchased ELS for RHEL 7

function getOsType(osString) {
  if (osString.startsWith('RHEL')) return 'rhel';
  if (osString.startsWith('Windows Server')) return 'windows-server';
  if (osString.startsWith('Ubuntu')) return 'ubuntu';
  if (osString.startsWith('Oracle Linux')) return 'oracle-linux';
  return null;
}

function getOsVersion(osString, osType) {
  if (osType === 'rhel') {
    const match = osString.match(/RHEL (\d+)\.(\d+)/);
    return match ? match[1] + '.' + match[2] : null;
  }
  if (osType === 'windows-server') {
    const match = osString.match(/Windows Server (\d+)(?: R2)?/);
    return match ? match[1] : null;
  }
  if (osType === 'ubuntu') {
    const match = osString.match(/Ubuntu (\d+\.\d+)/);
    return match ? match[1] : null;
  }
  if (osType === 'oracle-linux') {
    const match = osString.match(/Oracle Linux (\d+\.\d+)/);
    return match ? match[1] : null;
  }
  return null;
}

// Function to get major version from version string
function getMajorVersion(version) {
  if (!version) return null;
  return version.split('.')[0];
}

// Function to get minor version from version string
function getMinorVersion(version) {
  if (!version) return null;
  const parts = version.split('.');
  return parts.length > 1 ? parts[1] : null;
}

async function getLifecycleStatus(os) {
  // For empty OS strings
  if (!os) return -1;
  
  const osType = getOsType(os);
  if (!osType) return -1; // Unknown OS type
  
  const osVersion = getOsVersion(os, osType);
  if (!osVersion) return -1; // Couldn't parse version

  // Check if we've already cached this OS type
  if (!osLifecycleCache[osType]) {
    try {
      const response = await fetch(`/api/lifecycle/${osType}`);
      if (!response.ok) throw new Error('Failed to fetch lifecycle data');
      
      const data = await response.json();
      osLifecycleCache[osType] = data;
    } catch (error) {
      console.error(`Error fetching lifecycle data for ${osType}:`, error);
      return -1; // Error state
    }
  }
  
  // Special case for Windows Server - treat both Active and Security Support phases as "fully supported"
  if (osType === 'windows-server') {
    const lifecycleData = osLifecycleCache[osType];
    let matchedEntry;
    
    // Windows Server uses specific matching logic
    matchedEntry = lifecycleData.find(entry => {
      if (osVersion === '2012' && entry.cycle === '2012') return true;
      if (osVersion === '2012' && entry.cycle === '2012-R2') return os.includes('R2');
      if (osVersion === '2016' && entry.cycle === '2016') return true;
      if (osVersion === '2019' && entry.cycle === '2019') return true;
      if (osVersion === '2022' && entry.cycle === '2022') return true;
      return false;
    });
    
    if (!matchedEntry) {
      return -1; // No matching entry found
    }
    
    // For Windows Server, we consider both main support and security support as "fully supported"
    // Only show as EOL if it's past the eol date
    const now = new Date();
    const eolDate = matchedEntry.eol ? new Date(matchedEntry.eol) : null;
    
    if (eolDate && now > eolDate) {
      return 2; // End of Life (only when past the EOL date)
    } else if (matchedEntry.extendedSupport) {
      // Check if in extended support phase (after both mainstream and security support)
      const extendedSupportDate = new Date(matchedEntry.extendedSupport);
      if (now > extendedSupportDate) {
        return 1; // Extended support phase
      }
    }
    
    // In all other cases, show as fully supported
    return 0;
  }
  
  // Special case for RHEL
  if (osType === 'rhel') {
    const majorVersion = getMajorVersion(osVersion);
    const minorVersion = getMinorVersion(osVersion);
    
    if (!majorVersion || !minorVersion) return -1;
    
    // Get the data from the cache
    const lifecycleData = osLifecycleCache[osType];
    
    // Find the entry that matches the major version
    const matchedEntry = lifecycleData.find(entry => entry.cycle === majorVersion);
    
    if (!matchedEntry) {
      return -1;
    }
    
    // Today's date
    const now = new Date();
    
    // Get dates from matched entry
    const supportEnd = matchedEntry.support ? new Date(matchedEntry.support) : null;
    const eolDate = matchedEntry.eol ? new Date(matchedEntry.eol) : null;
    const elsDate = matchedEntry.extendedSupport ? new Date(matchedEntry.extendedSupport) : null;
    
    // RHEL 7.x handling - special case due to older minor versions being EOL
    if (majorVersion === '7') {
      // For RHEL 7, versions < 7.9 are EOL
      if (parseInt(minorVersion) < 9) {
        return 2; // EOL for older RHEL 7.x versions
      }
      
      // For RHEL 7.9, check ELS status
      if (now > eolDate) {
        // Past EOL date
        if (rhel7ElsEnabled && elsDate && now < elsDate) {
          return 1; // In ELS period
        } else {
          return 2; // EOL
        }
      } 
      // For RHEL 7.9, show as fully supported even during maintenance support
      return 0; // Fully supported (both Full Support and Maintenance phases)
    }
    
    // RHEL 8.x and 9.x handling - just like Windows, consider both phases as "supported"
    if (majorVersion === '8' || majorVersion === '9') {
      if (now > eolDate) {
        // Only show as EOL if past the EOL date
        return 2; // End of Life
      } else {
        // Show as fully supported during both Full Support and Maintenance phases
        return 0; // Fully supported
      }
    }
    
    // Default RHEL handling for other versions
    if (eolDate && now > eolDate) {
      return 2; // End of Life
    } else {
      return 0; // Fully supported (all phases before EOL)
    }
  }
  
  // Special case for Ubuntu
  if (osType === 'ubuntu') {
    // For Ubuntu 22.04 LTS specifically - hardcoded solution for now
    if (osVersion === "22.04") {
      // Current date
      const now = new Date();
      
      // EOL: April 30, 2032 (all phases before this are considered "supported")
      const eolDate = new Date("2032-04-30");
      
      if (now > eolDate) {
        return 2; // End of Life
      } else {
        return 0; // Fully supported (all phases before EOL)
      }
    }
    
    const lifecycleData = osLifecycleCache[osType];
    const matchedEntry = lifecycleData.find(entry => entry.cycle === osVersion);
    
    if (!matchedEntry) {
      return -1;
    }
    
    // Handle all Ubuntu versions consistently
    const now = new Date();
    const eolDate = matchedEntry.eol ? new Date(matchedEntry.eol) : null;
    
    if (eolDate && now > eolDate) {
      return 2; // End of Life
    } else {
      return 0; // All phases before EOL are considered "supported"
    }
  }
  
  // General case for all other OS types
  if (osType === 'oracle-linux') {
    const lifecycleData = osLifecycleCache[osType];
    
    // Generic matching for other OS types
    const matchedEntry = lifecycleData.find(entry => {
      return entry.cycle === osVersion || entry.cycle.startsWith(osVersion + '.');
    });
    
    if (!matchedEntry) {
      return -1; // No matching entry found
    }
    
    // For consistency, also use the simplified model for Oracle Linux
    const now = new Date();
    const eolDate = matchedEntry.eol ? new Date(matchedEntry.eol) : null;
    
    if (eolDate && now > eolDate) {
      return 2; // End of Life
    } else {
      return 0; // All phases before EOL are considered "supported"
    }
  }
  
  // Default case if we couldn't determine
  return -1;
}

// Create a status tag for Backup and Firewall
function createStatusTag(value) {
  const isYes = (value === true || value === 'Yes' || value === 'yes' || value === 'Y' || value === 'y');
  const isNo = (value === false || value === 'No' || value === 'no' || value === 'N' || value === 'n');
  
  if (isYes) {
    return `<span class="status-tag status-yes">Y</span>`;
  } else if (isNo) {
    return `<span class="status-tag status-no">N</span>`;
  } else {
    return `<span class="status-tag status-unknown">?</span>`;
  }
}

function getStatusTitle(status) {
  switch (status) {
    case 0: return "Supported";
    case 1: return "Extended Support";
    case 2: return "End of Life";
    default: return "Unknown Status";
  }
}

async function processServerOS(server) {
  const os = server.os || '';
  let osHtml = '';
  
  if (os) {
    const status = await getLifecycleStatus(os);
    let statusClass = 'os-tag-unknown';
    let statusIndicator = '';
    
    switch (status) {
      case 0:
        statusClass = 'os-tag-supported';
        break;
      case 1:
        statusClass = 'os-tag-els';
        statusIndicator = '<span class="els-indicator">ELS</span>';
        break;
      case 2:
        statusClass = 'os-tag-eol';
        statusIndicator = '<span class="eol-indicator">EOL</span>';
        break;
    }
    
    osHtml = `<span class="os-tag ${statusClass}" title="${getStatusTitle(status)}">${os}${statusIndicator}</span>`;
  }
  
  return osHtml;
}

async function renderServerList(data) {
  const tbody = document.getElementById('serverList');
  tbody.innerHTML = '';
  
  for (const server of data.servers) {
    const row = document.createElement('tr');
    
    let envsHtml = '';
    let rolesHtml = '';
    
    if (server.environments && server.environments.length > 0) {
      server.environments.forEach(env => {
        envsHtml += `<span class="env-tag env-tag-${env.name}">${env.name}</span> `;
        
        if (env.roles && env.roles.length > 0) {
          env.roles.forEach(role => {
            rolesHtml += `<span class="env-tag env-tag-${env.name}">${role}</span> `;
          });
        }
      });
    }
    
    const osHtml = await processServerOS(server);
    
    // Create status tags for backup and firewall
    const backupTag = createStatusTag(server.backup);
    const firewallTag = createStatusTag(server.firewall);
    
    row.innerHTML = `
      <td class="clickable">${server.hostname || ''}</td>
      <td>${envsHtml}</td>
      <td>${rolesHtml}</td>
      <td>${osHtml}</td>
      <td>${server.cpu || ''}</td>
      <td>${server.memoryGB || ''}</td>
      <td>${backupTag}</td>
      <td>${firewallTag}</td>
      <td>${server.internalIp || ''}</td>
      <td>${server.externalIp || '-'}</td>
    `;

    const detailRow = document.createElement('tr');
    detailRow.classList.add('hidden');
    
    let portsHTML = '';
    if (server.listeningPorts) {
      portsHTML = Object.values(server.listeningPorts)
        .map(p => `<tr>
          <td>${p.Process || ''}</td>
          <td>${p.Port || ''}</td>
          <td>${p.Protocol || ''}</td>
          <td>${p.Address || ''}</td>
        </tr>`)
        .join('');
    }
    
    detailRow.innerHTML = `<td colspan="10">
      <div class="groupHeader">Listening Ports</div>
      <table class="processTable">
        <thead><tr><th>Process</th><th>Port</th><th>Protocol</th><th>Address</th></tr>
        ${portsHTML}
      </table>
    </td>`;

    tbody.appendChild(row);
    tbody.appendChild(detailRow);
    row.addEventListener('click', () => detailRow.classList.toggle('hidden'));
  }
}

fetch('servers.json').then(res => res.json()).then(data => {
  data.servers.sort((a, b) => {
    const hostnameA = (a.hostname || '').toLowerCase();
    const hostnameB = (b.hostname || '').toLowerCase();
    return hostnameA.localeCompare(hostnameB);
  });

  renderServerList(data);
});

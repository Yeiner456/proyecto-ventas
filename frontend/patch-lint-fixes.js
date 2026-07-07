const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = [
  'src/App.jsx',
  'src/components/RequireAuth.jsx',
  'src/components/layout/Sidebar.jsx',
  'src/layouts/AppLayout.jsx',
  'src/views/AuditoriaView.jsx',
  'src/views/CategoriasView.jsx',
  'src/views/DashboardView.jsx',
  'src/views/FacturasView.jsx',
  'src/views/LoginView.jsx',
  'src/views/MetodosPagoView.jsx',
  'src/views/NotificacionesView.jsx',
  'src/views/NuevaVentaView.jsx',
  'src/views/ProductosView.jsx',
  'src/views/RolesView.jsx',
  'src/views/SucursalesView.jsx',
  'src/views/UsuariosView.jsx',
  'src/services/apiClient.js',
];

for (const relPath of files) {
  const filePath = path.join(root, relPath);
  let code = fs.readFileSync(filePath, 'utf8');
  let original = code;

  code = code.replace(/import React, \{([^}]*)\} from "react";/g, 'import {$1} from "react";');
  code = code.replace(/import React, \{([^}]*)\} from 'react';/g, "import {$1} from 'react';");
  code = code.replace(/import React from "react";\r?\n/g, '');
  code = code.replace(/import React from 'react';\r?\n/g, '');

  if (relPath === 'src/views/NotificacionesView.jsx') {
    code = code.replace(/import \{([^}]*)\} from "lucide-react";/, (_, p1) => {
      const updated = p1
        .split(',')
        .map((s) => s.trim())
        .filter((item) => item !== 'AlertTriangle')
        .join(', ');
      return `import { ${updated} } from "lucide-react";`;
    });
  }

  if (relPath === 'src/views/RolesView.jsx') {
    code = code.replace(/import \{([^}]*)\} from "lucide-react";/, (_, p1) => {
      const updated = p1
        .split(',')
        .map((s) => s.trim())
        .filter((item) => item !== 'Users' && item !== 'UserCheck')
        .join(', ');
      return `import { ${updated} } from "lucide-react";`;
    });
  }

  if (relPath === 'src/views/DashboardView.jsx') {
    code = code.replace(/\nconst ESTADO_LABEL = \{[\s\S]*?\};\r?\n/, '\n');
  }

  if (relPath === 'src/services/apiClient.js') {
    code = code.replace(/catch \(([^)]*)\)/, 'catch (_$1)');
  }

  if (code !== original) {
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`patched ${relPath}`);
  }
}

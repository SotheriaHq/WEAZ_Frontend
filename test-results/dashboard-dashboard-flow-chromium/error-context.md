# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"@/lib/utils\" from \"src/components/dashboard/DashboardSidebar.tsx\". Does the file exist?"
  - generic [ref=e5]: C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/src/components/dashboard/DashboardSidebar.tsx:3:19
  - generic [ref=e6]: "17 | import React from \"react\"; 18 | import { NavLink } from \"react-router-dom\"; 19 | import { cn } from \"@/lib/utils\"; | ^ 20 | export const DashboardSidebar = ({ isOpen, onClose }) => { 21 | const navItems = ["
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:31470:43) at TransformPluginContext.error (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:31467:14) at normalizeUrl (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:30010:18) at process.processTicksAndRejections (node:internal/process/task_queues:105:5) at async file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:30068:32 at async Promise.all (index 5) at async TransformPluginContext.transform (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:30036:4) at async EnvironmentPluginContainer.transform (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:31284:14) at async loadAndTransform (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:26454:26) at async viteTransformMiddleware (file:///C:/Users/UTL_ADMIN/Desktop/Shawn/threadly/fthreadly/node_modules/vite/dist/node/chunks/dep-Bg4HVnP5.js:27539:20)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```
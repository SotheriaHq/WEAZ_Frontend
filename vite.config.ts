import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            "@": "/src",
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('/node_modules/')) {
                        if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
                            return 'react-vendor';
                        }
                        if (id.includes('/react-router')) {
                            return 'router-vendor';
                        }
                        if (id.includes('/@reduxjs/') || id.includes('/react-redux/')) {
                            return 'redux-vendor';
                        }
                    }
                    if (id.includes('/pages/admin/') || id.includes('/components/admin/')) {
                        return 'admin';
                    }
                },
            },
        },
    },
});

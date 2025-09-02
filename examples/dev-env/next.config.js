const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@vocoder/react', '@vocoder/types'],
  productionBrowserSourceMaps: true, // Enable source maps in production
  webpack: (config, { dev, isServer }) => {
    // Enable source maps in development
    if (dev) {
      config.devtool = 'eval-source-map';
    }
    
    // Ensure workspace packages are properly handled
    config.resolve.symlinks = false;
    
    // In development, resolve workspace packages to their source files
    if (dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@vocoder/react': path.resolve(__dirname, '../../packages/react/src'),
        '@vocoder/types': path.resolve(__dirname, '../../packages/types/src'),
      };
    }
    
    // Watch workspace packages for changes
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.git'],
      };
    }
    
    // Disable minification in development for better debugging
    if (dev) {
      config.optimization.minimize = false;
      config.optimization.minimizer = [];
      
      // Preserve debugger statements in development
      config.optimization.removeAvailableModules = false;
      config.optimization.removeEmptyChunks = false;
      config.optimization.splitChunks = false;
    }
    
    // Ensure source maps are preserved for workspace packages
    config.module.rules.forEach(rule => {
      if (rule.use && Array.isArray(rule.use)) {
        rule.use.forEach(use => {
          if (use.loader && use.loader.includes('babel-loader')) {
            use.options = use.options || {};
            use.options.sourceMaps = true;
            use.options.retainLines = true;
            // Preserve debugger statements
            use.options.plugins = use.options.plugins || [];
            use.options.plugins = use.options.plugins.filter(plugin => 
              !Array.isArray(plugin) || !plugin[0] || !plugin[0].includes('transform-remove-console')
            );
          }
        });
      }
    });
    
    return config;
  },
}

module.exports = nextConfig 
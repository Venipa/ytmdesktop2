// Create README
export const EXAMPLE_PLUGINS_README = `# YTMDesktop Plugins

This directory is where you can add your own custom plugins for YTMDesktop.

## Plugin Structure

A plugin is a JavaScript file with the extension \`.plugin.mjs\`. It should export the following:

1. \`meta\` object with plugin information:
   \`\`\`js
   export const meta = {
       name: "Your Plugin Name",
       description: "Description of what your plugin does",
       author: "Your Name",
       version: "1.0.0",
       enabled: true
   };
   \`\`\`

2. A default export function that is called when the plugin is loaded:
   \`\`\`js
   export default function(context) {
       // Your plugin code here
       const { settings } = context;
       
       // Return a cleanup function (optional)
       return function() {
           // Cleanup code here
       };
   }
   \`\`\`

3. An \`afterInit\` function that is called after the YouTube Music player is initialized (optional):
   \`\`\`js
   export function afterInit(context) {
       // Code to run after player initialization
   }
   \`\`\`

## Example Plugin

See \`example.plugin.mjs\` for a complete example of a plugin.

## Plugin Context

The \`context\` object passed to your plugin functions contains:

- \`settings\`: Access to the app settings
- More properties may be added in future versions

## Best Practices

1. Always provide a cleanup function if your plugin modifies the DOM or adds event listeners
2. Use descriptive names and provide documentation in the meta object
3. Test your plugin thoroughly before sharing
4. Keep your plugin code modular and maintainable

## Security Guidelines

1. Never use eval() or similar functions
2. Avoid direct DOM manipulation when possible
3. Don't include external scripts or resources
4. Keep your plugin code simple and focused
5. Don't attempt to access system resources or files
6. Don't try to bypass security restrictions

## Troubleshooting

If your plugin isn't loading:
1. Make sure the file has the \`.plugin.mjs\` extension
2. Check the browser console for any errors
3. Verify that the meta object is properly formatted
4. Ensure all required exports are present
5. Check if your plugin contains any restricted code

## Sharing Plugins

To share your plugin with others:
1. Host your plugin file somewhere accessible
2. Share the link with other users
3. They can download and place the file in this directory

Happy plugin development!`;

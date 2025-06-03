export const EXAMPLE_PLUGINS_CONTENT = `// Example plugin for YTMDesktop
const meta = {
    name: "Example Plugin",
    description: "A simple example plugin that shows how to create plugins for YTMDesktop",
    author: "Your Name",
    version: "1.0.0",
    enabled: true
};

// This function is called when the plugin is loaded
const handler = (context) => {
    const { settings } = context;
    
    // Log when the plugin is loaded
    console.log("Example plugin loaded!");
    
    // Example: Add a custom CSS class to the player
    const style = document.createElement('style');
    style.textContent = \`
        .ytmusic-player-bar {
            background: rgba(0, 0, 0, 0.8) !important;
        }
    \`;
    document.head.appendChild(style);
    
    // Return a cleanup function that will be called when the plugin is unloaded
    return function() {
        style.remove();
        console.log("Example plugin unloaded!");
    };
}

// This function is called after the YouTube Music player is initialized
const afterInit = (context) => {
    console.log("Example plugin afterInit called!");
};
module.exports = {
	handler,
	meta,
	afterInit,
};
`;

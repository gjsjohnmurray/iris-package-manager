const vscode = acquireVsCodeApi();

// Handle the message inside the webview
window.addEventListener('message', event => {

  const message = event.data; // The JSON data our extension sent
  switch (message.command) {
    case 'load':
      console.log(message.serverSpec);
      console.log(message.namespace);
      console.log(message.rows);
      break;
  }
});

window.onload = function() {
    vscode.postMessage({ command: 'ready' });
  };
  
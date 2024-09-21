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
    case 'output':
      console.log(message.text);
      const taOutput = document.querySelector('#taOutput');
      taOutput.value = message.text;
      const tfCommand = document.querySelector('#tfCommand');
      tfCommand.wrappedElement.setSelectionRange(0, tfCommand.value.length);
      break;
  }
});

window.onload = function() {
  const taOutput = document.querySelector('#taOutput');
  const tfCommand = document.querySelector('#tfCommand');
  tfCommand.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && tfCommand.value.length > 0) {
      vscode.postMessage({ command: 'run', text: tfCommand.value });
    }
  });
  tfCommand.style.width = taOutput.offsetWidth + 'px';

  taOutput.wrappedElement.style.whiteSpaceCollapse = 'preserve';
  taOutput.wrappedElement.style.textWrap = 'nowrap';

  vscode.postMessage({ command: 'ready' });
  };
  
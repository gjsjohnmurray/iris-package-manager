const vscode = acquireVsCodeApi();

var tmrPlaceholder = null;

// Handle the message inside the webview
window.addEventListener('message', event => {

  const message = event.data; // The JSON data our extension sent
  const tfCommand = document.querySelector('#tfCommand');
  const taOutput = document.querySelector('#taOutput');
  switch (message.command) {
    case 'load':
      //console.log(message.serverSpec);
      //console.log(message.namespace);
      //console.log(message.rows);
      break;
    case 'output':
      //console.log(message.text);
      taOutput.value += message.text;
      taOutput.wrappedElement.scrollTop = taOutput.wrappedElement.scrollHeight;
      tfCommand.wrappedElement.setSelectionRange(0, tfCommand.value.length);
      break;
    case 'setCommand':
      if (message.text === '') {
        if (message.placeholder) {
          tmrPlaceholder = setTimeout(() => {
            tfCommand.value = message.text;
            tfCommand.placeholder = message.placeholder;
          }, 1000);
        } else if (tmrPlaceholder) {
          // Another setCommand of empty text but with no placeholder text, restart the timer
          tmrPlaceholder.refresh();
        }
      } else {
        tfCommand.value = message.text;
        if (tmrPlaceholder) {
          clearTimeout(tmrPlaceholder);
          tmrPlaceholder = null;
        }
        if (message.placeholder) {
          tfCommand.placeholder = message.placeholder;
        }
      }
      setTimeout(() => {
        tfCommand.wrappedElement.setSelectionRange(0, tfCommand.value.length);
      }, 0);
      break;
  }
});

window.onload = function() {
  const taOutput = document.querySelector('#taOutput');
  const tfCommand = document.querySelector('#tfCommand');
  tfCommand.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      vscode.postMessage({ command: 'input', text: tfCommand.value });
    }
  });
  tfCommand.style.width = taOutput.offsetWidth + 'px';

  taOutput.wrappedElement.style.whiteSpaceCollapse = 'preserve';
  taOutput.wrappedElement.style.textWrap = 'nowrap';

  const btnHelp = document.querySelector('#btnHelp');
  btnHelp.addEventListener('click', (_event) => {
    vscode.postMessage({ command: 'help'});
  });
  const btnClear = document.querySelector('#btnClear');
  btnClear.addEventListener('click', (_event) => {
    tfCommand.value = '';
    taOutput.value = '';
  });

  vscode.postMessage({ command: 'ready' });
  };
  
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
      //console.log(message.registryRows);
      //console.log(message.moduleRows);
      break;
    case 'output':
      //console.log(message.text);
      taOutput.value += message.text;
      setTimeout(() => {
        taOutput.wrappedElement.scrollTop = taOutput.wrappedElement.scrollHeight;
      }, 0);
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

  const tfCommand = document.querySelector('#tfCommand');
  const taOutput = document.querySelector('#taOutput');

  document.querySelector('#radioRepoNoModule').checked = true;
  document.querySelectorAll('.radioRepoModule').forEach((radio) => {
    if (radio.id === 'radioRepoNoModule') {
      radio.addEventListener('click', (_event) => {
        document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
          btn.disabled = true;
        });
      });
    } else {
      radio.addEventListener('click', (_event) => {
        document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
          btn.disabled = false;
        });
      });
    }
  });

  document.querySelectorAll('.cmdRepoButton').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      var repo = btn.dataset.reponame;
      var module;
      document.querySelectorAll('.radioRepoModule').forEach((el) => {
        if (el.checked) {
          module = el.dataset.module;
        }
      });
      if (repo && module) {
        const text = `${btn.dataset.command} ${repo}/${module}`;
        vscode.postMessage({ command: 'input', text });
        tfCommand.value = text;
        tfCommand.wrappedElement.setSelectionRange(0, text.length);
        tfCommand.wrappedElement.focus();
      }
    });
  });

  document.querySelectorAll('.radioModule').forEach((radio) => {
    radio.addEventListener('click', (_event) => {
      document.querySelectorAll('.cmdButton').forEach((btn) => {
        btn.disabled = false;
      });
    });
  });

  document.querySelectorAll('.btnOpenModuleRepo').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      vscode.postMessage({ command: 'openExternal', url: btn.dataset.url });
    });
  });

  document.querySelectorAll('.cmdButton').forEach((btn) => {
    btn.addEventListener('click', (_event) => {
      var module;
      document.querySelectorAll('.radioModule').forEach((el) => {
        if (el.checked) {
          module = el.dataset.module;
        }
      });
      if (module) {
        const text = `${btn.dataset.command} ${module}`;
        vscode.postMessage({ command: 'input', text });
        tfCommand.value = text;
        tfCommand.wrappedElement.setSelectionRange(0, text.length);
        tfCommand.wrappedElement.focus();
      }
    });
  });

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
    vscode.postMessage({ command: 'openExternal', url: 'https://github.com/intersystems/ipm/wiki/02.-CLI-commands' });
  });
  const btnClear = document.querySelector('#btnClear');
  btnClear.addEventListener('click', (_event) => {
    tfCommand.value = '';
    taOutput.value = '';
  });

  vscode.postMessage({ command: 'ready' });
  };
  
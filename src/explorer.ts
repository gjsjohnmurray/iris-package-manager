import * as vscode from 'vscode';
import { makeRESTRequest, resolveCredentials } from './makeRESTRequest';
import { IServerSpec, mapExplorers, ourExtensionUri, serverManagerApi } from './extension';

export class Explorer extends vscode.Disposable {

    public serverId: string;
    public namespace: string;

    private _disposables: vscode.Disposable[] = [];
    private _panel: vscode.WebviewPanel | undefined;

    constructor(serverId: string, namespace: string) {
        super(() => {
            this.dispose();
        });
        this.serverId = serverId;
        this.namespace = namespace;
    }

    public async initialize(): Promise<string> {
        if (!ourExtensionUri) {
            return 'Error: ourAssetPath is not set.';
        }
		const serverSpec: IServerSpec = await serverManagerApi.getServerSpec(this.serverId);
		if (!serverSpec) {
			return `Server definition '${this.serverId}' not found.`;
		}


		// Always resolve credentials because even though the /api/mgmnt endpoint may permit unauthenticated access the endpoints we are interested in may not.
		await resolveCredentials(serverSpec);
		const response = await makeRESTRequest('POST', serverSpec, { apiVersion: 1, namespace: this.namespace, path: '/action/query' }, { query: 'SELECT * FROM %ZPM_PackageManager_Developer."Module"' });
		if (!response) {
			return `Failed to retrieve server '${this.serverId}' information.`;
		}
        if (response?.status !== 200) {
            return `Failed to retrieve server '${this.serverId}' information. Status: ${response?.status}`;
        }
        const rows = response.data?.result?.content;

		// Create and show a new webview
        const assetsUri = vscode.Uri.joinPath(ourExtensionUri, 'assets');
        const elementsUri = vscode.Uri.joinPath(ourExtensionUri, 'node_modules', '@vscode-elements', 'elements');
		const panel = vscode.window.createWebviewPanel(
            'georgejames.iris-package-manager.explorer',
            `IPM (${this.namespace} on ${this.serverId})`,
            vscode.ViewColumn.Active,
            {
                localResourceRoots: [
                    assetsUri,
                    elementsUri,
                ],
                retainContextWhenHidden: true, // Keep the page when its tab is not visible, otherwise it will be reloaded when the tab is revisited.
                enableScripts: true,
                enableFindWidget: true,
            }
		);
        panel.onDidDispose(() => {
            this.dispose();
        }, null, this._disposables);
        panel.iconPath = vscode.Uri.joinPath(assetsUri, 'fileIcon.svg');
        this._panel = panel;

		const webview = panel.webview;
		webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'ready':
						webview.postMessage({ command: 'load', serverSpec, namespace: this.namespace, rows });
						return;
				}
			},
			undefined,
			this._disposables,
		);

    // We are using VSCode Elements (see https://vscode-elements.github.io/)

		const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>IPM</title>
  </head>
  <body>
    <vscode-table class="packages" zebra bordered-columns resizable columns='["15%", "10%", "15%", "60%"]'>
      <vscode-table-header slot="header">
        <vscode-table-header-cell>Name</vscode-table-header-cell>
        <vscode-table-header-cell>Version</vscode-table-header-cell>
        <vscode-table-header-cell>Display Name</vscode-table-header-cell>
        <vscode-table-header-cell>Description</vscode-table-header-cell>
      </vscode-table-header>
      <vscode-table-body slot="body">`
        + (rows ? rows.map((row: any) => `
        <vscode-table-row>
          <vscode-table-cell>${row.Name}</vscode-table-cell>
          <vscode-table-cell>${row.VersionString}</vscode-table-cell>
          <vscode-table-cell>${row.ExternalName}</vscode-table-cell>
          <vscode-table-cell>${row.Description}</vscode-table-cell>
        </vscode-table-row>`).join('') : '')
        + `
      </vscode-table-body>
    </vscode-table>

    <script
      src="${webview.asWebviewUri(vscode.Uri.joinPath(elementsUri, 'dist', 'bundled.js'))}"
      type="module"
    ></script>
    <script
      src="${webview.asWebviewUri(vscode.Uri.joinPath(assetsUri, 'explorerScript.js'))}"
      type="module"
    ></script>
  </body>
</html>`;

		webview.html = html;
        return '';
    }

    public show() {
        if (this._panel) {
            this._panel.reveal();
        }
    }

    dispose() {
        this._disposables.forEach(d => d.dispose());
        mapExplorers.delete(`${this.serverId}:${this.namespace}`);
    }
}
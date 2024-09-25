import * as vscode from 'vscode';
import WebSocket = require("ws");
import { makeRESTRequest, resolveCredentials } from './makeRESTRequest';
import { IServerSpec, mapExplorers, ourExtensionUri, serverManagerApi } from './extension';
import { AxiosResponse } from 'axios';
import { registryRESTRequest } from './registryRESTRequest';

/** Data received from the WebSocket */
interface WebSocketMessage {
    /** The type of the message */
    type: "prompt" | "read" | "error" | "output" | "init" | "color";
    /** The text of the message. Present for all types but "read" and "init". */
    text?: string;
    /** The WebSocket protocol version. Only present for "init". */
    protocol?: number;
    /** The InterSystems IRIS `$ZVERSION`. Only present for "init". */
    version?: string;
}

const COMMAND_PLACEHOLDER = "Enter an IPM command. Enter '?' for brief help or click the \u24D8 icon for more.";
  
export class Explorer extends vscode.Disposable {
    public serverId: string;
    public namespace: string;

    private _disposables: vscode.Disposable[] = [];
    private _serverSpec: IServerSpec | undefined;
    private _cookies: string[] = [];
    private _panel: vscode.WebviewPanel | undefined;
    private _socket: WebSocket | undefined;
    private _commandCounter = 0;
    private _state: "prompt" | "read" | "eval" = "eval";
    private _lastCommand = "";

    constructor(serverId: string, namespace: string) {
        super(() => {
            this.dispose();
        });
        this.serverId = serverId;
        this.namespace = namespace;
    }

    public async initialize(): Promise<string> {
        let response: AxiosResponse | undefined;
        if (!ourExtensionUri) {
            return "Error: ourAssetPath is not set.";
        }
        this._serverSpec = await serverManagerApi.getServerSpec(
            this.serverId
        );
        if (!this._serverSpec) {
            return `Server definition '${this.serverId}' not found.`;
        }

        // Always resolve credentials because even though the /api/mgmnt endpoint may permit unauthenticated access the endpoints we are interested in may not.
        await resolveCredentials(this._serverSpec);
        
        response = await makeRESTRequest(
            "POST",
            this._serverSpec,
            { apiVersion: 1, namespace: this.namespace, path: "/action/query" },
            { query: 'SELECT Name, Details, URL FROM %ZPM_PackageManager_Client.RemoteServerDefinition ORDER BY Name' }
        );
        if (!response) {
            return `Failed to retrieve server '${this.serverId}' registries information for namespace ${this.namespace}.`;
        }
        if (response?.status !== 200) {
            return `Failed to retrieve server '${this.serverId}' registries information for namespace ${this.namespace}. Status: ${response?.status}`;
        }
        this._cookies = response.headers["set-cookie"] || [];
        const registryRows = response.data?.result?.content;

        response = await makeRESTRequest(
            "POST",
            this._serverSpec,
            { apiVersion: 1, namespace: this.namespace, path: "/action/query" },
            { query: 'SELECT * FROM %ZPM_PackageManager_Developer."Module" ORDER BY Name' }
        );
        if (!response) {
            return `Failed to retrieve server '${this.serverId}' modules information for namespace ${this.namespace}.`;
        }
        if (response?.status !== 200) {
            return `Failed to retrieve server '${this.serverId}' modules information for namespace ${this.namespace}. Status: ${response?.status}`;
        }
        this._cookies = response.headers["set-cookie"] || [];
        const moduleRows = response.data?.result?.content;

        // Create and show a new webview
        const assetsUri = vscode.Uri.joinPath(ourExtensionUri, "assets");
        const nodeModulesUri = vscode.Uri.joinPath(ourExtensionUri, "node_modules");
        const panel = vscode.window.createWebviewPanel(
            "georgejames.iris-package-manager.explorer",
            `IPM (${this.namespace} on ${this.serverId})`,
            vscode.ViewColumn.Active,
            {
                localResourceRoots: [assetsUri, nodeModulesUri],
                retainContextWhenHidden: true, // Keep the page when its tab is not visible, otherwise it will be reloaded when the tab is revisited.
                enableScripts: true,
                enableFindWidget: false, // TODO - enable when https://github.com/microsoft/vscode/issues/177046 is fixed.
            }
        );
        panel.onDidDispose(
            () => {
                this.dispose();
            },
            null,
            this._disposables
        );
        panel.iconPath = vscode.Uri.joinPath(assetsUri, "fileIcon.svg");
        this._panel = panel;

        const webview = panel.webview;
        webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case "ready":
                        webview.postMessage({
                            command: "load",
                            serverSpec: this._serverSpec,
                            namespace: this.namespace,
                            registryRows,
                            moduleRows,
                        });
                        this._state = "prompt";
                        return;
                    case "input":
                        const input = message.text;
                        if (this._socket) {
                            if (this._state === "prompt") {
                                if (input !== "") {
                                    this._lastCommand = input;
                                    this.output(`\n[${++this._commandCounter}]zpm:${this.namespace}> ${input}\n`);
                                    webview.postMessage({
                                        command: "setCommand",
                                        text: "",
                                        placeholder: `Command '${input}' is running. If this message persists, check for input question below.`
                                    });
                                    this._socket.send(JSON.stringify({ type: "prompt", input: `if $zpm("${input.replace(/"/g, '""')}")` }));
                                    this._state = "eval";
                                }
                            } else if (this._state === "read") {
                                this.output(`${input}\n`);
                                this._socket.send(JSON.stringify({ type: "read", input: input }));
                                this._state = "eval";
                            }
                        }
                        return;
                    case "openExternal":
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        return;
                }
            },
            undefined,
            this._disposables
        );

        // We are using VSCode Elements (see https://vscode-elements.github.io/)

        //TODO get actual repo contents
        const repoName = registryRows[0]?.Name;
        let repoRows = [];
        if (registryRows[0]?.URL) {
            const url = registryRows[0].URL;
            response = await registryRESTRequest('GET', url + '/packages/-/all');
            if (!response) {
                return `Failed to retrieve from ${url}.`;
            }
            if (response?.status !== 200) {
                return `Failed to retrieve from ${url}. Status: ${response?.status}`;
            }
            repoRows = response.data;
        }

        const html =
`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>IPM</title>
    <link
      rel="stylesheet"
      href="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          nodeModulesUri,
          "@vscode",
          "codicons",
          "dist",
          "codicon.css"
        )
      )}"
      id="vscode-codicon-stylesheet"
    />
  </head>
  <body>
    <p>
    <vscode-collapsible title="Available" description="${repoRows.length} package${repoRows.length === 1 ? '' : 's'} in remote repository '${repoName}' at ${registryRows[0].Details}">
        <vscode-table zebra bordered-columns resizable columns='["25%", "55%", "15%", "5%"]' style="height: 300px;">
          <vscode-table-header slot="header">
            <vscode-table-header-cell>Name</vscode-table-header-cell>
            <vscode-table-header-cell>Description</vscode-table-header-cell>
            <vscode-table-header-cell>Versions</vscode-table-header-cell>
            <vscode-table-header-cell>Source</vscode-table-header-cell>
          </vscode-table-header>
    <!-- TODO filtering
          <vscode-table-header slot="header">
            <vscode-table-header-cell><vscode-textfield title="Filter the Names"></vscode-textfield></vscode-table-header-cell>
            <vscode-table-header-cell><vscode-textfield title="Filter the Descriptions"></vscode-textfield></vscode-table-header-cell>
            <vscode-table-header-cell></vscode-table-header-cell>
            <vscode-table-header-cell></vscode-table-header-cell>
          </vscode-table-header>
    -->
          <vscode-table-body slot="body">`
+   (repoRows
        ? repoRows
            .map((row: any, index: number) => `
            <vscode-table-row>
              <vscode-table-cell>
                <vscode-radio class="radioRepoModule" name="radioRepoModule" title="Select" data-module="${row.name}">
                  ${row.name}
                </vscode-radio>
              </vscode-table-cell>
              <vscode-table-cell>${row.description}</vscode-table-cell>
              <vscode-table-cell>${row.versions.join(', ')}</vscode-table-cell>
              <vscode-table-cell><vscode-icon class="btnOpenModuleRepo" name="repo" action-icon title="${row.repository}" data-url="${row.repository}"></vscode-icon></vscode-table-cell>
            </vscode-table-row>`
            )
            .join("")
        : ""
    )

/* TODO - filtering
    // Two dummy rows to ensure we can scroll the final row into view, because the extra header row for filtering confuses the widget
+ `
            <vscode-table-row>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
            </vscode-table-row>
            <vscode-table-row>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
              <vscode-table-cell></vscode-table-cell>
            </vscode-table-row>
          </vscode-table-body>`
*/
+ `
        </vscode-table>
        <vscode-divider></vscode-divider>`
+   (repoRows?.length === 0
        ? '&nbsp&No packages found<br/>&nbsp'
        : `
        &nbsp;&nbsp;
        <vscode-radio class="radioRepoModule" id="radioRepoNoModule" name="radioRepoModule" title="Deselect"></vscode-radio>
        <vscode-button class="cmdRepoButton" title="Install Selected Package Here" data-command="install" data-repoName="${repoName}" disabled>Install</vscode-button>
        <br/>&nbsp;`
    )
+ `
    </vscode-collapsible>
    </p>
    <p>
    <vscode-collapsible title="Installed" description="${moduleRows.length} package${moduleRows.length === 1 ? '' : 's'} in this namespace" open>
        <vscode-table class="packages" zebra bordered-columns resizable columns='["15%", "10%", "15%", "60%"]'>
          <vscode-table-header slot="header">
            <vscode-table-header-cell>Name</vscode-table-header-cell>
            <vscode-table-header-cell>Version</vscode-table-header-cell>
            <vscode-table-header-cell>Display Name</vscode-table-header-cell>
            <vscode-table-header-cell>Description</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body slot="body">`
+   (moduleRows
        ? moduleRows
            .map((row: any) => `
            <vscode-table-row>
              <vscode-table-cell>
                <vscode-radio class="radioModule" name="radioModule" data-module="${row.Name}"}>
                  ${row.Name}
                </vscode-radio>
              </vscode-table-cell>
              <vscode-table-cell>${row.VersionString}</vscode-table-cell>
              <vscode-table-cell>${row.ExternalName}</vscode-table-cell>
              <vscode-table-cell>${row.Description}</vscode-table-cell>
            </vscode-table-row>`
            )
            .join("")
        : ""
    )
+ `
          </vscode-table-body>
        </vscode-table>
        <vscode-divider></vscode-divider>`
+   (moduleRows?.length === 0
        ? '&nbsp&No packages found<br/>&nbsp'
        : `
        &nbsp;
        <vscode-button class="cmdButton" title="Install Latest Version" data-command="install" disabled>Install Latest</vscode-button>
        <vscode-button class="cmdButton" title="Find Selected Package in Configured Repositories" data-command="search" disabled>Find in Repositories</vscode-button>
        <vscode-button class="cmdButton" title="List Packages Depending on Selected Package" data-command="list-dependents" disabled>List Dependents</vscode-button>
        <vscode-button class="cmdButton" title="Reinstall Selected Package" data-command="reinstall" disabled>Reinstall</vscode-button>
        <vscode-button class="cmdButton" title="Uninstall Selected Package" icon="warning" secondary data-command="uninstall -recurse" disabled>Uninstall</vscode-button>
        <br/>&nbsp;`
    )
+ `
    </vscode-collapsible>
    </p>
    <p>
      <vscode-textfield
        id="tfCommand"
        placeholder="${COMMAND_PLACEHOLDER}"
      >
        <vscode-badge
          slot="content-before"
        >zpm:${this.namespace}&gt;</vscode-badge>
        <vscode-icon
          slot="content-after"
          id="btnClear"
          name="clear-all"
          title="Clear Input and Output"
          action-icon
        ></vscode-icon>
        <vscode-icon
          slot="content-after"
          id="btnHelp"
          name="info"
          title="IPM Commands Documentation on GitHub"
          action-icon
        ></vscode-icon>
      </vscode-textfield>
      <br/>
      <br/>
      <vscode-textarea
        id="taOutput"
        placeholder="\n Output from commands will appear here.\n\n If a command prompts for input while executing, respond in the text field above."
        readonly
        monospace
        cols="80"
        rows="24"
        resize="both"
      >
      </vscode-textarea>
    </p>
    
    <script
      src="${webview.asWebviewUri(
        vscode.Uri.joinPath(
          nodeModulesUri,
          "@vscode-elements",
          "elements",
          "dist",
          "bundled.js"
        )
      )}"
      type="module"
    ></script>
    <script
      src="${webview.asWebviewUri(
        vscode.Uri.joinPath(assetsUri, "explorerScript.js")
      )}"
      type="module"
    ></script>
  </body>
</html>`;

        webview.html = html;

        this.createSocket();
        
        return "";
    }

    public show() {
        if (this._panel) {
            this._panel.reveal();
        }
    }
    
    private createSocket() {
        if (!this._serverSpec) {
            return;
        }
        const { scheme, host, port, pathPrefix } = this._serverSpec?.webServer;
        try {
            // Open the WebSocket
            this._socket = new WebSocket(`${scheme === "https" ? "wss" : "ws"}://${host}:${port}${pathPrefix}/api/atelier/v7/${encodeURIComponent("%SYS")}/terminal`, {
                rejectUnauthorized: vscode.workspace
                    .getConfiguration("http")
                    .get("proxyStrictSSL"),
                headers: {
                    cookie: this._cookies,
                },
            });
        } catch (error) {
            return;
        }
        // Add event handlers to the socket
        this._socket
            .on("error", (error) => {
                // TODO
            })
            .on("close", () => {
                // TODO
            })
            .on("message", (data: string) => {
                let message: WebSocketMessage;
                try {
                    message = JSON.parse(data);
                } catch {
                    return;
                }

                // Bizarrely this is needed to avoid us being told later it could be undefined
                if (!this._socket) {
                    return;
                }
                switch (message.type) {
                    case "error":
                        // TODO
                        break;
                    case "output":
                        if (message.text) {
                            this.output(message.text);
                        }
                        if (this._panel) {
                            // Delay appearance of input prompt placeholder until after the output stops
                            this._panel.webview.postMessage({
                                command: "setCommand",
                                text: "",
                            });
                        }
                        break;
                    case "read":
                        this._state = "read";
                        break;
                    case "prompt":
                        // Write an end-of-output marker the same length as the prompt part of the echoed next command
                        if (this._commandCounter > 0) {
                            this.output(`\n\u2500[${this._commandCounter}]${"\u2500".repeat(4 + this.namespace.length)}`);
                        }
                        if (this._panel) {
                            this._panel.webview.postMessage({
                                command: "setCommand",
                                text: this._lastCommand,
                                placeholder: COMMAND_PLACEHOLDER,
                            });
                        }
                        this._state = "prompt";
                        break;
                    case "init":
                        this._socket.send(
                            JSON.stringify({
                                type: "config",
                                // Start in the current namespace
                                namespace: this.namespace,
                                // We don't want the server to send ANSI escape codes since we can't handle them in our textarea
                                rawMode: true,
                            })
                        );
                        break;
                    case "color": {
                        // TODO - will this ever happen with rawmode true?
                        break;
                    }
                }
            });
    }

    private output(text: string) {
        if (this._panel) {
            this._panel.webview.postMessage({
                command: "output",
                text,
            });
        }
    }

    dispose() {
        if (
            this._socket &&
            this._socket.readyState !== this._socket.CLOSED &&
            this._socket.readyState !== this._socket.CLOSING
        ) {
            this._socket.close();
        }
        this._disposables.forEach((d) => d.dispose());
        mapExplorers.delete(`${this.serverId}:${this.namespace}`);
    }
}
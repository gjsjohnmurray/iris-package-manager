import * as vscode from 'vscode';
import { IServerSpec, ServerManagerAPI } from "@intersystems-community/intersystems-servermanager";
import { Explorer } from './explorer';

export let ourExtensionUri: vscode.Uri | undefined = undefined;

// Map to limit to one explorer per server:namespace
export const mapExplorers: Map<string, Explorer> = new Map<string, Explorer>();

export let serverManagerApi: ServerManagerAPI; 
export async function activate(context: vscode.ExtensionContext) {
	ourExtensionUri = context.extensionUri;

	// We will use the Server Manager extension to get the server definitions
	const smExtension = vscode.extensions.getExtension('intersystems-community.servermanager');
	if (!smExtension) {
		vscode.window.showErrorMessage('The InterSystems Server Manager extension is not installed.');
		return;
	}
	if (!smExtension.isActive) {
		await smExtension.activate();
	}
	serverManagerApi = smExtension.exports;
  
	// The command we add to the Server Manager tree at the namespace level
	context.subscriptions.push(vscode.commands.registerCommand('iris-package-manager.intersystems-servermanager', async (serverTreeItem) => {
        const idArray: string[] = serverTreeItem.id.split(':');
        const serverId = idArray[1];
        const namespace = idArray[3];
		const keyInMap = `${serverId}:${namespace}`;
		let explorer = mapExplorers.get(keyInMap);
		if (explorer) {
			explorer.show();
			return;
		}
		
		explorer = new Explorer(serverId, namespace);
		const errorText = await explorer.initialize();
		if (errorText) {
			vscode.window.showErrorMessage(errorText);
			return;
		}

		mapExplorers.set(keyInMap, explorer);
		context.subscriptions.push(explorer);
 	}));
  
	// The command we add to a root node of the ObjectScriptExplorer view's tree
	context.subscriptions.push(vscode.commands.registerCommand('iris-package-manager.ObjectScriptExplorer', async (explorerRootItem) => {
		const conn = explorerRootItem.conn;
		if (conn.apiVersion < 7) {
			vscode.window.showErrorMessage('Package Manager only available on InterSystems IRIS 2023.2 and later.');
			return;
		}
		const serverId = `${conn.host}:${conn.port}`;
		const namespace = explorerRootItem.namespace;
		const keyInMap = `${serverId}:${namespace}`;
		let explorer = mapExplorers.get(keyInMap);
		if (explorer) {
			explorer.show();
			return;
		}
		
		explorer = new Explorer(serverId, namespace);
		const serverSpec: IServerSpec = {
			name: serverId,
			webServer: {
				scheme: conn.https ? 'https' : 'http',
				host: conn.host,
				port: conn.port,
				pathPrefix: conn.pathPrefix
			},
			username: conn.username,
			password: conn.password
		};
		const errorText = await explorer.initialize(serverSpec);
		if (errorText) {
			vscode.window.showErrorMessage(errorText);
			return;
		}

		mapExplorers.set(keyInMap, explorer);
		context.subscriptions.push(explorer);
 	}));
}

export function deactivate() {

}

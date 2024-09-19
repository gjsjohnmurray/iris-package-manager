import * as vscode from 'vscode';
import { Explorer } from './explorer';

export interface IWebServerSpec {
    scheme?: string;
    host: string;
    port: number;
    pathPrefix?: string;
}

export interface IServerSpec {
    name: string;
    webServer: IWebServerSpec;
    username?: string;
    password?: string;
    description?: string;
}

export let ourExtensionUri: vscode.Uri | undefined = undefined;

// Map to limit to one explorer per server:namespace
export const mapExplorers: Map<string, Explorer> = new Map<string, Explorer>();

export let serverManagerApi: any; 
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
}

export function deactivate() {

}

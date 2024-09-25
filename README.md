# InterSystems IRIS Package Manager

This extension works with the [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension to manage IPM / ZPM packages on servers.

## Use

1. In Server Manager expand the Namespaces folder of the IRIS server **(2023.2 or later)** where you want to manage packages.
2. Use the new Package Manager action button on the row of the namespace you want to work in. The first time you do this for a server you will be prompted to permit this extension to use the server credentials. Approve this.
3. In the IPM tab that appears in the editor area you can:
   - Browse a list of packages published by the remote repository your server namespace is configured to use. View their source repositories. Install them into your namespace.
   - Perform a range of operations on installed packages, including installing the latest version, reinstalling the current package, or uninstalling it.
   - Enter any IPM command. The output will display in the textarea.

A few IPM commands prompt for user input, in which case you should respond in the same field that you ran the command from.

This extension uses the InterSystems Lite Terminal's REST endpoint and websocket mechanism. Information [here](https://docs.intersystems.com/components/csp/docbook/DocBook.UI.Page.cls?KEY=GVSCO_debug#GVSCO_debug_websocket_debug) can help to debug in situations where Lite Terminal isn't working.

## Known Issues

1. License starvation occurs. Workaround is to use the server's `/XXX/csp/sys/op/%25CSP.UI.Portal.CSPSessions.zen` IRIS Portal page to end your `/XXX/api/atelier` web sessions. A shortcut to IRIS Portal is available in Server Manager.
2. Assumes IPM is already installed on the server. See [the IPM project](https://github.com/intersystems/ipm#installing-objectscript-package-manager-client) for instructions.
3. Tables do not refresh. For example after installing / updating / uninstalling a package its entry doesn't appear / update / disappear. Workaround is to close the tab and reopen it.
4. The 'Available' table is currently hardwired to the first remote repository your IPM is configured to use.
5. VS Code's built-in Find widget (Ctrl/Cmd+F) has been disabled until it no longer causes a [crash](https://github.com/microsoft/vscode/issues/177046).

## Release Notes

See the [CHANGELOG](CHANGELOG.md) for changes in each release.

## Feedback

Please open issues on [GitHub](https://github.com/gjsjohnmurray/iris-package-manager/issues).

## About George James Software

Known for our expertise in InterSystems technologies, George James Software has been providing innovative software solutions for over 35 years. We focus on activities that can help our customers with the support and maintenance of their systems and applications. Our activities include consulting, training, support, and developer tools - with Deltanji source control being our flagship tool. Our tools augment InterSystems' technology and can help customers with the maintainability and supportability of their applications over the long term. 

To find out more, go to our website - [georgejames.com](https://georgejames.com)
